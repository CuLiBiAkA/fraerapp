import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { filterAfterSubmit } from "../frontend/story-workflow.js";

const source = fs.readFileSync(new URL("./app.js", import.meta.url), "utf8");
function harness(names, overrides = {}) {
  const calls = [];
  const values = new Map();
  const context = vm.createContext({
    draft: { key: "story-a", variables: [], assets: [], scenes: [] },
    localStorage: { setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    storageKey: "draft", t: key => key, render() {}, saveDraft() {},
    els: { runtimeUrl: { value: "https://example.test" }, apiResult: {}, authorAnalytics: {} },
    canAuthor: () => true, authorHeaders: () => ({}), loadAuthorHome: async () => {},
    importDraftToRuntime: async () => { calls.push("import"); },
    fetchJson: async url => { calls.push(url); return {}; },
    authorFetch: async url => { calls.push(url); return {}; },
    prompt: () => null,
    confirm: () => true,
    window: {location:{}},
    authorHomeCache: null, authorFilter: "all", builderWorkflowBusy: false,
    filterAfterSubmit, updateAuthorGate() {},
    toStoryJson: () => ({key:"story-a"}),
    ...overrides,
  });
  for (const name of names) {
    const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));
    assert.ok(match, `missing function ${name}`);
    vm.runInContext(match[0], context);
  }
  return { context, calls, values };
}

test("import/export preserves global definitions shadowed in one scene", () => {
  const { context } = harness(["fromStoryJson", "toStoryJson", "serializeVariable", "variableValue", "detectType", "coerceValue", "parseMetadata"], {
    serializeEffects: () => [], serializeConditions: () => [], parseEffects: () => [],
  });
  const story = {
    key: "scoped", title: "Scoped", startSceneId: "local",
    variables: { score: { value: 7, showInStats: true } },
    assets: [{ id: "bg", type: "image", url: "/global.png" }],
    scenes: [
      { id: "local", variables: { score: "local" }, assets: [{ id: "bg", type: "image", url: "/local.png" }], background: "bg", choices: [] },
      { id: "global", background: "bg", choices: [] },
    ],
  };
  context.fromStoryJson(story);
  const result = JSON.parse(JSON.stringify(context.toStoryJson()));
  assert.deepEqual(result.variables, story.variables);
  assert.deepEqual(result.assets, story.assets);
  assert.equal(result.scenes[0].variables.score, "local");
  assert.equal(result.scenes[0].assets[0].url, "/local.png");
  assert.equal(result.scenes[1].background, "bg");
});

test("checking a saved story never imports or changes publication", async () => {
  const { context, calls } = harness(["runtimeCall"], { getDraftStoryId: () => "story-a-id" });
  await context.runtimeCall("validate");
  assert.deepEqual(calls, ["https://example.test/api/author/stories/story-a-id/validate"]);
});

test("inspecting or archiving another story leaves the editor binding alone", async () => {
  const { context } = harness(["showAuthorAnalytics", "showAuthorPreview", "showAuthorVersions", "authorWorkflow", "getDraftStoryId", "bindDraftStory"]);
  context.bindDraftStory("story-a-id");
  for (const name of ["showAuthorAnalytics", "showAuthorPreview", "showAuthorVersions"]) await context[name]("story-b-id");
  await context.authorWorkflow("story-b-id", "archive");
  assert.equal(context.getDraftStoryId(), "story-a-id");
});

test("saved identity belongs to the current draft key and runtime, including after reload", () => {
  const { context } = harness(["getDraftStoryId", "bindDraftStory"]);
  context.bindDraftStory("story-a-id");
  context.draft = JSON.parse(JSON.stringify(context.draft));
  assert.equal(context.getDraftStoryId(), "story-a-id");
  context.draft.key = "story-b";
  assert.equal(context.getDraftStoryId(), null);
  context.draft.key = "story-a";
  context.els.runtimeUrl.value = "https://other.test";
  assert.equal(context.getDraftStoryId(), null);
  context.draft = { key: "story-a" };
  context.els.runtimeUrl.value = "https://example.test";
  assert.equal(context.getDraftStoryId(), null);
});

test("an import completing after switching drafts cannot bind the new draft", async () => {
  let resolve;
  const { context } = harness(["importDraftToRuntime", "getDraftStoryId", "bindDraftStory"], {
    fetchJson: () => new Promise(done => { resolve = done; }), toStoryJson: () => ({key:"story-a"}),
  });
  const operation = context.importDraftToRuntime();
  context.draft = { key: "story-b" };
  resolve({ storyId: "story-a-id" });
  await operation;
  assert.equal(context.getDraftStoryId(), null);
});

test("renaming a scene updates start, target and fallback without changing other links", () => {
  const scene = { id: "start", choices: [{target:"end",fallbackTarget:"start"}] };
  const other = { id: "end", choices: [{target:"start"}] };
  const { context } = harness(["renameScene"], {draft:{startSceneId:"start",scenes:[scene,other]}, renderMeta() {}});
  context.renameScene(scene, "");
  context.renameScene(scene, "intro");
  assert.equal(context.draft.startSceneId,"intro");
  assert.equal(other.choices[0].target,"intro");
  assert.equal(scene.choices[0].fallbackTarget,"intro");
  assert.equal(scene.choices[0].target,"end");
});

test("renaming global artwork preserves a local shadow with the same name", () => {
  const global = {id:"bg"};
  const local = {id:"bg"};
  const a = {background:"bg",assets:[]};
  const b = {background:"bg",music:"bg",assets:[local]};
  const {context}=harness(["renameAsset"],{draft:{assets:[global],scenes:[a,b]}});
  context.renameAsset(global,"sky");
  assert.equal(a.background,"sky");
  assert.equal(b.background,"bg");
  context.renameAsset(local,"room",b);
  assert.equal(b.background,"room");
  assert.equal(b.music,"room");
  assert.equal(a.background,"sky");
});

test("malformed imports leave the current draft untouched", () => {
  const {context}=harness(["fromStoryJson"]);
  const original=context.draft;
  for (const invalid of [null, [], {}, {scenes:[null]}]) {
    assert.throws(()=>context.fromStoryJson(invalid));
    assert.equal(context.draft,original);
  }
});

test("switching stories while saving cannot submit the newly opened story", async () => {
  let context;
  const runtime = harness(["runtimeCall", "getDraftStoryId"], {
    importDraftToRuntime: async () => {
      context.draft = {key:"b",runtimeStory:{key:"b",base:"https://example.test",storyId:"b-id"}};
      return {storyId:"a-id"};
    },
  });
  context=runtime.context;
  await context.runtimeCall("review");
  assert.deepEqual(runtime.calls,[]);
  assert.equal(context.els.apiResult.textContent,"draftChanged");
});

test("review uses the identity and generation returned by its own save", async () => {
  let sent;
  const {context}=harness(["runtimeCall","authorWorkflow"],{
    getDraftStoryId:()=>null,
    importDraftToRuntime:async()=>({storyId:"new-id",generation:8,draftRevision:4,reviewState:"draft"}),
    authorFetch:async(path,options)=>{sent={path,body:JSON.parse(options.body)};return {submittedRevision:4};},
  });
  await context.runtimeCall("review");
  assert.deepEqual(sent,{path:"/api/author/stories/new-id/review",body:{generation:8,replaceReview:false}});
});

test("editing the same draft while saving stops submission and retains local changes", async () => {
  let context;
  const {context:runtime,calls}=harness(["runtimeCall"],{
    getDraftStoryId:()=>"a-id", toStoryJson:()=>({key:context.draft.key,title:context.draft.title}),
    importDraftToRuntime:async()=>{context.draft.title="New unsaved title";return {storyId:"a-id"};},
  });
  context=runtime;
  await context.runtimeCall("review");
  assert.deepEqual(calls,[]);
  assert.equal(context.els.apiResult.textContent,"draftChanged");
  assert.equal(context.draft.title,"New unsaved title");
});

test("replacement needs confirmation and a rejected request keeps the drafts filter", async () => {
  const summary={storyId:"a",generation:9,submittedRevision:3,draftRevision:4,reviewState:"in_review"};
  const denied=harness(["authorWorkflow"],{confirm:()=>false,authorFilter:"drafts"});
  await denied.context.authorWorkflow("a","review",summary);
  assert.deepEqual(denied.calls,[]);
  assert.equal(denied.context.authorFilter,"drafts");
  const failed=harness(["authorWorkflow"],{authorFilter:"drafts",authorFetch:async()=>{throw new Error("Failed");}});
  await assert.rejects(failed.context.authorWorkflow("a","review",summary),/Failed/);
  assert.equal(failed.context.authorFilter,"drafts");
  const accepted=harness(["authorWorkflow"],{authorFilter:"drafts",authorFetch:async()=>({submittedRevision:4})});
  await accepted.context.authorWorkflow("a","review",summary);
  assert.equal(accepted.context.authorFilter,"review");
});

test("legacy publish action has no Builder execution path", async () => {
  const {context,calls}=harness(["runtimeCall","authorWorkflow"]);
  await context.runtimeCall("publish");
  await assert.rejects(context.authorWorkflow("a","publish"),/authorRoleMissing/);
  assert.deepEqual(calls,[]);
});

test("first global and scene-local upload saves a draft, uploads, and saves the URL without publishing", async () => {
  for (const scope of ["global","local"]) {
    const steps=[];let context, uploadedForm;
    const asset={id:"new-image",type:"image",url:""};
    const setup=harness(["uploadAssetFile","getDraftStoryId","bindDraftStory"],{
      FormData:class { constructor(){this.data=new Map();} append(key,value){this.data.set(key,value);} get(key){return this.data.get(key);} },
      renderPreview(){},
      importDraftToRuntime:async()=>{steps.push("save");context.bindDraftStory("new-story");return {storyId:"new-story",draftRevision:steps.length};},
      fetchJson:async(path,options)=>{steps.push("upload");uploadedForm=options.body;assert.equal(path,"https://example.test/api/author/stories/new-story/assets");return {id:"new-image",type:"image",url:"/uploads/new-story/immutable.png"};},
    });
    context=setup.context;
    await context.uploadAssetFile(asset,"fake-file",scope);
    assert.deepEqual(steps,["save","upload","save"]);
    assert.equal(uploadedForm.get("scope"),scope==="local"?"local":undefined);
    assert.equal(asset.url,"/uploads/new-story/immutable.png");
    assert.equal(context.getDraftStoryId(),"new-story");
  }
});

test("opening a server draft binds the document and revision from the same response", async () => {
  let context;
  const setup=harness(["openAuthorStory","bindDraftStory","getDraftStoryId"],{
    hasUnsavedChanges:()=>false,
    authorHomeCache:{stories:[{storyId:"a",draftRevision:2}]},
    authorFetch:async path=>{assert.equal(path,"/api/author/stories/a");return {draftRevision:4,draftDocument:{key:"a",title:"Working draft"},submittedDocument:{key:"a",title:"Submitted text"}};},
    fromStoryJson:value=>{context.draft={...value};},
    toStoryJson:()=>({key:context.draft.key,title:context.draft.title}),
  });
  context=setup.context;
  await context.openAuthorStory("a");
  assert.equal(context.draft.title,"Working draft");
  assert.equal(context.draft.runtimeStory.revision,4);
  assert.equal(context.draft.runtimeStory.savedDocument,JSON.stringify({key:"a",title:"Working draft"}));
});

test("scenario map edits preserve the saved draft identity", () => {
  const board=fs.readFileSync(new URL("./board.js",import.meta.url),"utf8");
  const stored={key:"a",runtimeStory:{storyId:"a-id",key:"a",base:"https://example.test"},scenes:[]};
  let value=JSON.stringify(stored);
  const context=vm.createContext({draftStorageKey:"draft",localStorage:{getItem:()=>value,setItem:(key,next)=>{value=next;}}});
  for(const name of ["loadDraft","persistDraft"]) vm.runInContext(board.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0],context);
  context.draft=context.loadDraft();
  context.draft.scenes.push({id:"new"});
  context.persistDraft();
  assert.deepEqual(JSON.parse(value).runtimeStory,stored.runtimeStory);
  assert.equal(JSON.parse(value).scenes[0].id,"new");
});
