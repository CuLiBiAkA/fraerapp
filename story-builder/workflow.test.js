import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { filterAfterSubmit } from "../frontend/story-workflow.js";
import { validateStory as validateStoryDocument } from "./core.js";

const source = fs.readFileSync(new URL("./app.js", import.meta.url), "utf8");
function harness(names, overrides = {}) {
  const calls = [];
  const values = new Map();
  const context = vm.createContext({
    draft: { key: "story-a", variables: [], assets: [], scenes: [] },
    localStorage: { setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    storageKey: "draft", t: key => key, render() {}, saveDraft() {}, structuredClone,
    sceneTextControls: new WeakMap(),
    els: { runtimeUrl: { value: "https://example.test" }, apiResult: {}, authorAnalytics: {} },
    canAuthor: () => true, authorHeaders: () => ({}), loadAuthorHome: async () => {},
    importDraftToRuntime: async () => { calls.push("import"); },
    fetchJson: async url => { calls.push(url); return {}; },
    authorFetch: async url => { calls.push(url); return {}; },
    prompt: () => null,
    confirm: () => true,
    window: {location:{}}, URLSearchParams,
    authorHomeCache: null, authorFilter: "all", builderWorkflowBusy: false,
    filterAfterSubmit, updateAuthorGate() {}, renderAuthorWorkspace() {}, acceptOwnGeneration() {},
    validateStory: () => [], renderPreview() {}, selectChapterTab() {},
    toStoryJson: () => ({key:"story-a"}), ensureDraftKey() {}, crypto: webcrypto,
    prepareImage: async file => file, applyAssetTypeFromFile() {},
    ...overrides,
  });
  for (const name of names) {
    const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));
    assert.ok(match, `missing function ${name}`);
    vm.runInContext(match[0], context);
  }
  return { context, calls, values };
}

test("a moderation limit keeps the saved draft and explains waiting instead of a stale revision", async () => {
  const error=Object.assign(new Error('Only one story'),{status:409,code:'REVIEW_LIMIT_REACHED'});
  const {context}=harness(["authorWorkflow"],{authorFetch:async()=>{throw error;}});
  await assert.rejects(()=>context.authorWorkflow('second','review',{generation:1,reviewState:'draft'}),e=>e.code==='REVIEW_LIMIT_REACHED');
  assert.equal(context.builderWorkflowBusy,false);
});

test("Builder validates the supplied document independently of the active draft", () => {
  const { context } = harness(["validateStory"], {
    currentLanguage: "en", validateStoryDocument,
    draft: { variables: [{ name: "score", type: "boolean", value: false }], scenes: [{ id: "start", variables: [] }] },
  });
  const story = { key: "other", title: "Other document", startSceneId: "start", variables: { score: { value: 3, showInStats: true } }, assets: [], scenes: [
    { id: "start", text: "{{score}}", effects: [{ inc: "score", value: 1 }], choices: [] },
  ] };
  assert.deepEqual(Array.from(context.validateStory(story)), []);
  context.draft.variables[0].type = "number";
  story.variables.score = false;
  assert.match(context.validateStory(story).join("\n"), /must target number variable score/);
  context.currentLanguage = "ru";
  assert.match(context.validateStory(story).join("\n"), /числовую переменную score/);
});

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

test("Builder keeps chapter input contracts, relations and completion through editing and export", () => {
  const { context } = harness(["fromStoryJson", "toStoryJson", "serializeVariable", "variableValue", "detectType", "coerceValue", "parseMetadata"], {
    serializeEffects: () => [], serializeConditions: () => [], parseEffects: () => [],
  });
  const metadata = {schemaVersion:1,relations:[{id:"next",type:"sequel",target:{kind:"scenario",key:"second"},stateTransfer:{mode:"mapped",contractVersion:1,mapping:[{from:"score",to:"courage",type:"number"}]}}],inputContract:{version:1,allowIndependentStart:true,fields:[{name:"score",type:"number",required:false,defaultValue:0}]}};
  const story = {key:"first",title:"First",completionStatus:"completed",metadata,startSceneId:"end",variables:{score:7},assets:[],scenes:[{id:"end",title:"End",text:"End",choices:[],ending:{type:"ending"}}]};
  context.fromStoryJson(story);
  context.draft.title = "Edited title";
  const result = JSON.parse(JSON.stringify(context.toStoryJson()));
  assert.deepEqual(result.metadata,metadata);
  assert.equal(result.completionStatus,"completed");
  result.metadata.relations[0].id = "changed-copy";
  assert.equal(context.draft.metadata.relations[0].id,"next");
});

test("checking a saved story never imports or changes publication", async () => {
  const { context, calls } = harness(["runtimeCall"], { getDraftStoryId: () => "story-a-id" });
  await context.runtimeCall("validate");
  assert.deepEqual(calls, ["https://example.test/api/author/stories/story-a-id/validate"]);
});

test("archiving another story leaves the editor binding alone", async () => {
  const { context } = harness(["authorWorkflow", "getDraftStoryId", "bindDraftStory"]);
  context.bindDraftStory("story-a-id");
  await context.authorWorkflow("story-b-id", "archive");
  assert.equal(context.getDraftStoryId(), "story-a-id");
});

test("invalid current JSON opens validation without saving or submitting", async () => {
  let selected;
  const {context,calls}=harness(["runtimeCall"],{
    currentLanguage:'ru', validateStory:()=>['Missing target'],
    selectChapterTab:name=>{selected=name;},
  });
  await context.runtimeCall('review');
  assert.equal(selected,'check');
  assert.deepEqual(calls,[]);
  assert.match(context.els.apiResult.textContent,/Исправьте ошибки/);
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

test("bound chapter saves use the original generation and never retry a conflict with a refreshed generation", async () => {
  const requests=[];let context;
  const setup=harness(['importDraftToRuntime','getDraftStoryId','bindDraftStory'],{
    toStoryJson:()=>({key:context.draft.key,title:context.draft.title}),
    fetchJson:async(url,options)=>{requests.push({url,method:options.method,body:JSON.parse(options.body)});throw Object.assign(new Error('Changed elsewhere'),{status:409});},
  });
  context=setup.context;context.draft.title='Unsaved text';context.bindDraftStory('bound-id','previous-document',3,7);
  const before=JSON.stringify(context.draft);
  await assert.rejects(()=>context.importDraftToRuntime(),error=>error.status===409);
  assert.equal(JSON.stringify(context.draft),before,'Conflict preserves local text and its original binding');
  assert.deepEqual(requests,[{url:'https://example.test/api/author/stories/bound-id',method:'PUT',body:{generation:7,document:{key:'story-a',title:'Unsaved text'}}}]);
});

test("an older saved draft without generation cannot overwrite the server through import", async () => {
  let writes=0;
  const {context}=harness(['importDraftToRuntime','getDraftStoryId','bindDraftStory'],{fetchJson:async()=>{writes++;return {};}});
  context.bindDraftStory('bound-id','old-document',3);
  await assert.rejects(()=>context.importDraftToRuntime(),error=>error.code==='DRAFT_GENERATION_REQUIRED');
  assert.equal(writes,0);assert.equal(context.draft.runtimeStory.savedDocument,'old-document');
});

test("same-key AI import retains the bound chapter ID and saves by generation", async () => {
  const requests=[];let context;
  const names=['fromStoryJson','toStoryJson','serializeVariable','serializeConditions','serializeEffects','variableType','variableValue','detectType','coerceValue','parseMetadata','parseCondition','parseEffects','defaultValue','importDraftToRuntime','getDraftStoryId','bindDraftStory'];
  const setup=harness(names,{fetchJson:async(url,options)=>{requests.push({url,method:options.method,body:JSON.parse(options.body)});return {storyId:'bound-id',draftRevision:4,generation:8};}});
  context=setup.context;
  const source={key:'story-a',title:'Before AI',version:1,startSceneId:'end',variables:{},assets:[],scenes:[{id:'end',title:'End',text:'Saved text',choices:[],ending:{type:'ending',title:'End'}}]};
  context.fromStoryJson(source);context.bindDraftStory('bound-id',JSON.stringify(context.toStoryJson()),3,7);
  context.fromStoryJson({...source,title:'After AI'});await context.importDraftToRuntime();
  assert.equal(requests[0].url,'https://example.test/api/author/stories/bound-id');assert.equal(requests[0].method,'PUT');assert.equal(requests[0].body.generation,7);assert.equal(requests[0].body.document.title,'After AI');
  assert.equal(context.draft.runtimeStory.storyId,'bound-id');assert.equal(context.draft.runtimeStory.generation,8);
});

test("new unbound drafts retain POST import and bind the returned generation", async () => {
  const requests=[];
  const {context}=harness(['importDraftToRuntime','getDraftStoryId','bindDraftStory'],{fetchJson:async(url,options)=>{requests.push({url,method:options.method});return {storyId:'created-id',draftRevision:1,generation:0};}});
  await context.importDraftToRuntime();
  assert.deepEqual(requests,[{url:'https://example.test/api/author/stories/import',method:'POST'}]);assert.equal(context.draft.runtimeStory.generation,0);
});

test("new drafts get one unique key on first save and preserve it on failed save retry", async () => {
  const documents = []; let context;
  const setup = harness(['ensureDraftKey','importDraftToRuntime','getDraftStoryId','bindDraftStory'], {
    draft: { key:'new_story', pendingKey:true, title:'My story' },
    toStoryJson: () => ({key:context.draft.key,title:context.draft.title}),
    fetchJson: async (_url,options) => { documents.push(JSON.parse(options.body)); if (documents.length===1) throw new Error('Offline'); return {storyId:'created-id',generation:1}; },
  });
  context = setup.context;
  await assert.rejects(context.importDraftToRuntime(),/Offline/);
  assert.match(context.draft.key,/^story_[a-f0-9]{32}$/);
  const generated = context.draft.key;
  await context.importDraftToRuntime();
  assert.equal(documents[0].key,generated); assert.equal(documents[1].key,generated);
  assert.equal(context.getDraftStoryId(),'created-id');
  context.draft = {key:'new_story',pendingKey:true}; context.ensureDraftKey();
  assert.notEqual(context.draft.key,generated);
  context.draft = {key:'imported_authored_key'}; context.ensureDraftKey();
  assert.equal(context.draft.key,'imported_authored_key');
});

test("a generated-key response never binds to a replacement draft", async () => {
  let complete; const original = {key:'new_story',pendingKey:true}; let context;
  const setup = harness(['ensureDraftKey','importDraftToRuntime','getDraftStoryId','bindDraftStory'], {
    draft:original, toStoryJson:()=>({key:context.draft.key}),
    fetchJson:()=>new Promise(resolve=>{complete=resolve;}),
  }); context=setup.context;
  const operation=context.importDraftToRuntime();
  const replacement={key:'new_story',pendingKey:true}; context.draft=replacement;
  complete({storyId:'previous-id',generation:1}); await operation;
  assert.equal(context.draft,replacement); assert.equal(context.getDraftStoryId(),null);
  assert.equal(context.draft.key,'new_story'); assert.equal(context.draft.pendingKey,true);
});

test("importing a legacy new_story key preserves its authored identity", () => {
  const {context}=harness(['fromStoryJson','ensureDraftKey','getDraftStoryId']);
  context.fromStoryJson({key:'new_story',title:'Legacy story',scenes:[]});
  context.ensureDraftKey();
  assert.equal(context.draft.key,'new_story');assert.equal(context.draft.pendingKey,false);
});

test("explicit exports assign unique keys, preserve reimported identity, and leave inspection pure", () => {
  const fresh=()=>({key:'new_story',pendingKey:true,title:'New draft',variables:[],assets:[],scenes:[]});
  const {context}=harness(['ensureDraftKey','exportStoryJson','toStoryJson','fromStoryJson','getDraftStoryId'],{draft:fresh()});
  assert.equal(context.toStoryJson().key,'new_story');assert.equal(context.draft.pendingKey,true);
  const exported=JSON.parse(JSON.stringify(context.exportStoryJson()));
  assert.match(exported.key,/^story_[a-f0-9]{32}$/);assert.equal(Object.hasOwn(exported,'pendingKey'),false);
  assert.equal(context.exportStoryJson().key,exported.key,'Repeated exports keep the same story identity');
  context.fromStoryJson(exported);
  assert.equal(context.exportStoryJson().key,exported.key,'Export then import does not fork or rename the story');
  context.draft=fresh();const other=context.exportStoryJson();
  assert.notEqual(other.key,exported.key,'Independent new drafts cannot export the same default key');
  context.fromStoryJson({...exported,key:'new_story'});
  assert.equal(context.exportStoryJson().key,'new_story','An explicit legacy imported key is never replaced');
});

test("cancelling image preparation leaves an unsaved draft and media untouched", async () => {
  const asset={id:'picture',type:'music',url:'/existing.mp3'}, original={key:'new_story',pendingKey:true};
  const {context,calls}=harness(['uploadAssetFile','ensureDraftKey','getDraftStoryId'], {draft:original,prepareImage:async()=>null});
  assert.equal(await context.uploadAssetFile(asset,{type:'image/png'}),null);
  assert.deepEqual(calls,[]);assert.equal(context.draft,original);assert.equal(original.key,'new_story');
  assert.deepEqual(asset,{id:'picture',type:'music',url:'/existing.mp3'});
});

test("cover selection preserves other metadata and cannot change a replacement draft", async () => {
  let options; const original={key:'a',metadata:{schemaVersion:1,relations:[{id:'next'}]}};
  const {context}=harness(['openCoverPicker'], {draft:original,chooseCover:async value=>{options=value;}});
  await context.openCoverPicker();options.onSelect('/assets/door.svg');
  assert.equal(original.metadata.coverUrl,'/assets/door.svg');assert.equal(original.metadata.relations[0].id,'next');
  const replacement={key:'b'};context.draft=replacement;options.onSelect('/assets/platform.svg');
  assert.equal(replacement.metadata,undefined);assert.equal(context.els.apiResult.textContent,'draftChanged');
});

test("choosing a first cover serializes scenario metadata version 1 without exporting local key state", async () => {
  let options;
  const draft={key:'new_story',pendingKey:true,title:'A draft',variables:[],assets:[],scenes:[]};
  const {context}=harness(['openCoverPicker','toStoryJson'], {draft,chooseCover:async value=>{options=value;}});
  const before=JSON.stringify(draft);
  await context.openCoverPicker();
  assert.equal(JSON.stringify(draft),before,'Opening and leaving the picker without selection cannot change the draft');
  options.onSelect('/assets/door.svg');
  const document=JSON.parse(JSON.stringify(context.toStoryJson()));
  assert.deepEqual(document.metadata,{schemaVersion:1,coverUrl:'/assets/door.svg'});
  assert.equal(Object.hasOwn(document,'pendingKey'),false);
  assert.equal(draft.pendingKey,true,'Choosing a library cover does not save or generate the draft key');
});

test("successful own review advances only the matching saved document generation", async () => {
  const {context}=harness(['authorWorkflow','acceptOwnGeneration','getDraftStoryId','bindDraftStory'],{
    authorFetch:async()=>({storyId:'bound-id',draftRevision:3,generation:8,submittedRevision:3}),
  });
  context.bindDraftStory('bound-id','saved-document',3,7);
  await context.authorWorkflow('bound-id','review',{generation:7,reviewState:'draft'});
  assert.equal(context.draft.runtimeStory.generation,8);assert.equal(context.draft.runtimeStory.savedDocument,'saved-document');
  context.acceptOwnGeneration({storyId:'bound-id',draftRevision:4,generation:9});
  assert.equal(context.draft.runtimeStory.generation,8,'Another revision cannot silently replace our saved base');
  context.acceptOwnGeneration({storyId:'another-id',draftRevision:3,generation:9});assert.equal(context.draft.runtimeStory.generation,8);
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
  for (const invalid of [null, [], {}, {scenes:[null]}, {scenes:[],metadata:[]}, {scenes:[],metadata:{relations:{}}}, {scenes:[],metadata:{relations:[{stateTransfer:{mapping:{}}}]}}, {scenes:[],metadata:{inputContract:{fields:{}}}}]) {
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
    assert.equal(uploadedForm.get("scope"),"local",'Upload stores bytes only; document references use the later generation-checked save');
    assert.equal(asset.url,"/uploads/new-story/immutable.png");
    assert.equal(context.getDraftStoryId(),"new-story");
  }
});

test("removing uploaded media is a local draft change until the generation-checked document save", async () => {
  const asset={id:'bg',type:'image',url:'/uploads/bound-id/cover.png'};
  const {context,calls}=harness(['removeAssetAt'],{draft:{key:'story-a',assets:[asset],scenes:[{background:'bg',music:'',assets:[]},{background:'bg',assets:[{id:'bg',url:'/assets/platform.svg'}]}],runtimeStory:{storyId:'bound-id',generation:7}}});
  await context.removeAssetAt(context.draft.assets,0);
  assert.deepEqual(calls,[],'No separate server asset mutation can invalidate the document generation');
  assert.equal(context.draft.assets.length,0);assert.equal(context.draft.scenes[0].background,'');assert.equal(context.draft.scenes[1].background,'bg');assert.equal(context.draft.runtimeStory.generation,7);
});

test("opening a server draft binds the document and revision from the same response", async () => {
  let context;
  const setup=harness(["openAuthorStory","bindDraftStory","getDraftStoryId"],{
    hasUnsavedChanges:()=>false,
    authorHomeCache:{stories:[{storyId:"a",draftRevision:2}]},
    authorFetch:async path=>{if(path==="/api/author/collections/parents?scenarioId=a")return [{collectionId:"work-a"}];if(path==="/api/author/collections/work-a")return {collectionId:"work-a",title:"Parent",draftDocument:{items:[]}};assert.equal(path,"/api/author/stories/a");return {draftRevision:4,draftDocument:{key:"a",title:"Working draft"},submittedDocument:{key:"a",title:"Submitted text"}};},
    URL, location:{href:"https://example.test/builder/?story=a"},
    history:{replaceState:(_state,_title,url)=>assert.equal(url.searchParams.get("work"),"work-a")},
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
  const context=vm.createContext({draftStorageKey:"draft",failedStorageKeys:new Set(),renderStorageWarning(){},localStorage:{getItem:()=>value,setItem:(key,next)=>{value=next;}}});
  for(const name of ["readLocalStorage","writeLocalStorage","loadDraft","persistDraft"]) vm.runInContext(board.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0],context);
  context.draft=context.loadDraft();
  context.draft.scenes.push({id:"new"});
  context.persistDraft();
  assert.deepEqual(JSON.parse(value).runtimeStory,stored.runtimeStory);
  assert.equal(JSON.parse(value).scenes[0].id,"new");
});
