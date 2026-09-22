import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

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

test("inspecting or publishing another story leaves the editor binding alone", async () => {
  const { context } = harness(["showAuthorAnalytics", "showAuthorPreview", "showAuthorVersions", "authorWorkflow", "getDraftStoryId", "bindDraftStory"]);
  context.bindDraftStory("story-a-id");
  for (const name of ["showAuthorAnalytics", "showAuthorPreview", "showAuthorVersions"]) await context[name]("story-b-id");
  await context.authorWorkflow("story-b-id", "publish");
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

test("switching stories during publish cannot publish the newly opened story", async () => {
  let context;
  const runtime = harness(["runtimeCall", "getDraftStoryId"], {
    importDraftToRuntime: async () => {
      context.draft = {key:"b",runtimeStory:{key:"b",base:"https://example.test",storyId:"b-id"}};
      return {storyId:"a-id"};
    },
  });
  context=runtime.context;
  await context.runtimeCall("publish");
  assert.deepEqual(runtime.calls,[]);
  assert.equal(context.els.apiResult.textContent,"draftChanged");
});

test("publish uses the identity returned by its own import", async () => {
  const {context,calls}=harness(["runtimeCall"],{getDraftStoryId:()=>null,importDraftToRuntime:async()=>({storyId:"new-id"})});
  await context.runtimeCall("publish");
  assert.deepEqual(calls,["https://example.test/api/author/stories/new-id/publish"]);
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
