// All identities and APIs are synthetic; this fixture never contacts production.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),origin='https://standalone-recovery.test';
function deferred(){let resolve;return {promise:new Promise(done=>{resolve=done}),resolve:()=>resolve()};}

(async()=>{
 const browser=await chromium.launch();
 try{
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   await context.addInitScript(()=>{localStorage.setItem('fraerapp.language','ru');localStorage.setItem('fraerapp.cookieConsent','accepted');});
   const stories=['a','b'].map(key=>({key,slug:key,title:`История ${key.toUpperCase()}`,completionStatus:'completed',coverUrl:'/assets/door.svg'}));
   const state={sessionId:'old-save',status:'active',story:{key:'a',title:'История A'},scene:{id:'start',title:'Дверь',text:'Кошка у двери.',choices:[]},statsVariables:{}};
   let detailGate=null,startGate=null,stateGate=null,detailStatus=200,saved=false,authenticated=true,startCount=0;
   const gates=[];
   const gate=()=>{const value=deferred();gates.push(value);return value;};
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),p=url.pathname,send=(json,status=200)=>route.fulfill({json,status});
    if(url.origin!==origin)return route.abort();
    if(p==='/auth/me')return send(authenticated?{email:'fixture@example.test',roles:['player']}:{},authenticated?200:401);
    if(p==='/auth/logout'){authenticated=false;return send({});}
    if(p==='/auth/refresh')return send({},authenticated?200:401);
    if(p==='/api/account')return send({notifications:[],unreadCount:0});
    if(p==='/api/catalog/stories')return send(stories);
    if(p==='/api/catalog/engagement')return send(stories.map(story=>({slug:story.slug,views:1})));
    if(p==='/api/catalog/collections')return send([]);
    if(p==='/api/catalog/stories/a'){if(detailGate)await detailGate.promise;return send(detailStatus===200?stories[0]:{message:'Unavailable'},detailStatus);}
    if(p==='/api/catalog/stories/b')return send(stories[1]);
    if(/^\/api\/catalog\/engagement\/[ab]$/.test(p))return send({slug:p.at(-1),views:1});
    if(p==='/api/stories/a/sessions')return send(saved?[{sessionId:'old-save',status:'active',saveName:'Existing save'}]:[]);
    if(p.endsWith('/entry-context'))return send({allowIndependentStart:true,parents:[],prerequisites:[],sources:[]});
    if(p==='/api/sessions'&&req.method()==='POST'){startCount++;if(startGate)await startGate.promise;return send(state);}
    if(p==='/api/sessions/old-save/state'){if(stateGate)await stateGate.promise;return send(state);}
    if(p.startsWith('/api/')||p.startsWith('/auth/'))return send([]);
    let file=path.join(root,'frontend',p.slice(1));
    if(p==='/'||p==='/history'||/^\/(history|read)\//.test(p))file=path.join(root,'frontend/index.html');
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:''});
   });
   const page=await context.newPage(),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(error.message));
   const card=key=>page.locator(`#stories a[href="/history/${key}"]`);
   async function reset({hasSave=false}={}){detailGate=startGate=stateGate=null;detailStatus=200;saved=hasSave;authenticated=true;await page.goto(origin+'/history');await card('a').waitFor();await page.waitForLoadState('networkidle');}
   async function open(key){await card(key).click();await page.locator('#story-detail-title').filter({hasText:`История ${key.toUpperCase()}`}).waitFor();await page.waitForFunction(()=>!document.querySelector('#story-detail-action').disabled);}
   async function release(value,endpoint){const response=page.waitForResponse(result=>new URL(result.url()).pathname===endpoint);value.resolve();await response;await page.waitForLoadState('networkidle');}
   async function stillOnB(label){assert.equal(new URL(page.url()).pathname,'/history/b',label);assert.equal(await page.locator('#story-detail-title').textContent(),'История B',label);assert.equal(await page.locator('#scene-screen').isVisible(),false,label);assert.equal(await page.evaluate(()=>localStorage.getItem('fraerapp.sessionId')),null,label);}
   try{
    // A delayed non-idempotent start must not revive a closed/replaced detail.
    await reset();await open('a');startGate=gate();let requested=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/sessions'&&request.method()==='POST');
    await page.locator('#story-detail-action').click();await requested;await page.locator('#story-detail-back').click();await open('b');await release(startGate,'/api/sessions');await stillOnB('Late start cannot replace B or persist A');

    // The same rule covers Continue from the shared story dialog.
    await reset({hasSave:true});await open('a');stateGate=gate();requested=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/sessions/old-save/state');
    await page.locator('#story-detail-action').click();await requested;await page.locator('#story-detail-back').click();await open('b');await release(stateGate,'/api/sessions/old-save/state');await stillOnB('Late continue cannot replace B');

    // Initial detail success and error must both respect the latest navigation.
    for(const status of [200,404]){
     await reset();detailStatus=status;detailGate=gate();requested=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/catalog/stories/a');
     await card('a').click();await requested;await open('b');await release(detailGate,'/api/catalog/stories/a');await stillOnB(`Late detail ${status} cannot replace or redirect B`);
    }

    // Back from a pending /read route also invalidates state loading.
    await reset();stateGate=gate();requested=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/sessions/old-save/state');
    await page.evaluate(()=>{history.pushState({},'', '/read/old-save');dispatchEvent(new PopStateEvent('popstate'));});await requested;
    await page.goBack();await card('b').waitFor();await open('b');await release(stateGate,'/api/sessions/old-save/state');await stillOnB('Back invalidates a pending direct read route');

    // Language changes rebuild controls but cannot allow duplicate Start writes.
    await reset();await open('a');startGate=gate();const before=startCount;requested=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/sessions'&&request.method()==='POST');
    await page.locator('#story-detail-action').click();await requested;await page.locator('#modal-lang-en').evaluate(button=>button.click());
    assert.equal(await page.locator('#story-detail-action').isDisabled(),true,'A rerender preserves the pending Start lock');
    await page.locator('#story-detail-action').evaluate(button=>button.click());assert.equal(startCount,before+1,'Pending Start is sent only once');
    await page.locator('#story-detail-back').click();await release(startGate,'/api/sessions');assert.equal(await page.locator('#scene-screen').isVisible(),false);

    // Logging out while a response is in flight must not restore its session.
    await reset();await open('a');startGate=gate();requested=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/sessions'&&request.method()==='POST');
    await page.locator('#story-detail-action').click();await requested;await page.locator('#story-detail-back').click();await page.locator('#site-controls [data-site-account]').click();await page.locator('#profile-logout').click();
    await page.waitForFunction(()=>!localStorage.getItem('fraerapp.email'));await release(startGate,'/api/sessions');
    assert.equal(await page.evaluate(()=>localStorage.getItem('fraerapp.sessionId')),null,'A late response cannot repopulate a logged-out session');assert.equal(await page.locator('#scene-screen').isVisible(),false);
    assert.deepEqual(errors,[]);console.log(width,'standalone stale start/continue/detail/404/direct-read, rerender lock, logout passed');
   }finally{gates.forEach(value=>value.resolve());await context.close();}
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
