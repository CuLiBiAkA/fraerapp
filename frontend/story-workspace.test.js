import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const workspace = fs.readFileSync(new URL("./story-workspace.js", import.meta.url), "utf8");
const engine = fs.readFileSync(new URL("./engine.js", import.meta.url), "utf8");
const access = fs.readFileSync(new URL("./workspace-access.js", import.meta.url), "utf8");
function loadFunction(source, name, values) {
  const context = vm.createContext({ URLSearchParams, ...values });
  const code = source.match(new RegExp(`async function ${name}\\([^]*?\\n\\}`));
  assert.ok(code, `missing function ${name}`); vm.runInContext(code[0], context); return context;
}

test("workspace access recovery refreshes an expired access session once and rechecks current roles", async () => {
  const calls=[];
  const responses=[{status:401,ok:false},{status:200,ok:true},{status:200,ok:true,json:async()=>({id:"owner",roles:["player"]})}];
  const context=loadFunction(access,"readCurrentSession",{fetch:async(path,options)=>{calls.push({path,options});return responses.shift();}});
  const user=await context.readCurrentSession();
  assert.deepEqual(calls.map(call=>call.path),["/auth/me","/auth/refresh","/auth/me"]);
  assert.equal(calls[1].options.method,"POST");
  assert.equal(calls[1].options.headers["X-Fraer-Request"],"same-origin");
  assert.deepEqual(user.roles,["player"]);
});

test("workspace recovery does not refresh forbidden sessions or loop after failed refresh", async () => {
  for (const status of [401,403]) {
    let count=0;
    const context=loadFunction(access,"readCurrentSession",{fetch:async()=>{count++;return {status,ok:false};}});
    await assert.rejects(context.readCurrentSession(),error=>error.status===status);
    assert.equal(count,status===401?2:1);
  }
});

test("a decision that empties the last queue page reloads the preceding page", async () => {
  const calls = [], rendered = [];
  const state = {page:1,listRequest:0,items:[],totalPages:2};
  const context = loadFunction(workspace,"loadList",{
    state, moderation:true, apiBase:"/api/moderation/stories", pageSize:20,
    list:{setAttribute(){}}, choose:ru=>ru, setStatus(){},
    search:{value:""}, filter:{control:{value:"in_review"}}, visibility:{control:{value:"all"}},
    renderList:()=>rendered.push(state.items),
    request:async path=>{calls.push(path);return calls.length===1?{totalPages:1,items:[]}:{totalPages:1,items:[{storyId:"remaining"}]};},
  });
  await context.loadList();
  assert.equal(state.page,0); assert.equal(calls.length,2);
  assert.match(calls[1],/page=0/);
  assert.deepEqual(rendered,[[{storyId:"remaining"}]]);
});

test("unlisted direct detail loads published metadata, per-story metrics and latest save without adding a catalogue entry", async () => {
  const calls = [];
  const catalogStories = [{slug:"public-story"}];
  const context=loadFunction(engine,"loadPublicStoryDetail",{
    storage:{email:"fixture@example.test"},catalogStories,
    request:async path=>{
      calls.push(path);
      if(path==="/api/catalog/stories/secret-slug")return {slug:"secret-slug",key:"unlisted_key",title:"Published revision"};
      if(path==="/api/catalog/engagement/secret-slug")return {slug:"secret-slug",views:3,discoveredEndings:1};
      if(path==="/api/stories/unlisted_key/sessions")return [{sessionId:"latest",status:"active",completionRate:45,updatedAt:"2026-10-05"},{sessionId:"older",status:"finished"}];
      if(path==="/api/catalog/stories/secret-slug/entry-context")return {allowIndependentStart:false,parents:[],sources:[{sourceSessionId:"previous",relationId:"sequel"}]};
      throw new Error(`Unexpected path ${path}`);
    },
  });
  const detail=await context.loadPublicStoryDetail("secret-slug");
  assert.equal(detail.title,"Published revision"); assert.equal(detail.lastSessionId,"latest");
  assert.equal(detail.lastSessionStatus,"active"); assert.equal(detail.completionRate,45); assert.equal(detail.discoveredEndings,1);
  assert.equal(calls.length,4); assert.deepEqual(catalogStories,[{slug:"public-story"}]);
  assert.equal(detail.entryContext.allowIndependentStart,false);
  assert.equal(detail.entryContext.sources[0].sourceSessionId,"previous");
});

test("guest direct detail relies on server visibility check and does not request reader saves", async () => {
  const calls=[];
  const context=loadFunction(engine,"loadPublicStoryDetail",{
    storage:{email:null},request:async path=>{calls.push(path);return {slug:"demo",key:"demo_key"};},
  });
  await context.loadPublicStoryDetail("demo");
  assert.deepEqual(calls,["/api/catalog/stories/demo","/api/catalog/engagement/demo"]);
  const denied=loadFunction(engine,"loadPublicStoryDetail",{storage:{email:null},request:async()=>{const error=new Error("Sign in");error.status=401;throw error;}});
  await assert.rejects(denied.loadPublicStoryDetail("unlisted"),error=>error.status===401);
});

test("per-story engagement refresh updates an unlisted card without leaking it into catalogue", async () => {
  const catalogStories=[{slug:"listed",views:1}];
  const story={slug:"unlisted",views:2};
  const context=loadFunction(engine,"refreshStoryMetrics",{catalogStories,request:async()=>({slug:"unlisted",views:3})});
  await context.refreshStoryMetrics(story);
  assert.equal(story.views,3); assert.deepEqual(catalogStories,[{slug:"listed",views:1}]);
});
