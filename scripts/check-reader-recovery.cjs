// Independent regression proof for switching runs/routes while requests are pending.
// All APIs and accounts are synthetic. Production is never contacted.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const origin = 'https://reader-recovery.test';
const deferred = () => { let resolve; return {promise:new Promise(done=>{resolve=done}),resolve:()=>resolve()}; };

(async()=>{
  const browser=await chromium.launch();
  try {
    for(const width of [390,1440]) {
      const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
      await context.addInitScript(()=>{localStorage.setItem('fraerapp.language','ru');localStorage.setItem('fraerapp.cookieConsent','accepted')});
      const ordinary={kind:'scenario',key:'ordinary',slug:'ordinary',title:'Обычная история',completionStatus:'completed',coverUrl:'/assets/platform.svg'};
      const cat={kind:'collection',schemaVersion:2,key:'cat',id:'cat',collectionId:'cat',title:'Кошка и двери',completionStatus:'completed',items:[{id:'chapter',key:'chapter',title:'Глава 1',kind:'scenario',allowIndependentStart:true}]};
      const run=id=>({id,completionStatus:'completed',items:[{...cat.items[0],sessionId:id==='older'?'old-save':'save',status:id==='older'?'finished':'active'}]});
      let empty=false, stateGate=null, detailFails=false;
      await context.route('**/*',async route=>{
        const url=new URL(route.request().url()),p=url.pathname,send=json=>route.fulfill({json});
        if(url.origin!==origin)return route.abort();
        if(p==='/auth/me')return send({email:'fixture@example.test',roles:['player']});
        if(p==='/api/account')return send({notifications:[],unreadCount:0});
        if(p==='/api/catalog/stories')return send([ordinary]);
        if(p==='/api/catalog/engagement')return send([{slug:'ordinary',views:1}]);
        if(p==='/api/catalog/collections')return send([cat]);
        if(p==='/api/catalog/collections/cat')return detailFails?route.fulfill({status:503,json:{message:'Temporarily unavailable'}}):send(empty?{...cat,items:[]}:cat);
        if(p==='/api/collections/cat/runs')return send([run('latest'),run('older')]);
        if(p.startsWith('/api/collection-runs/'))return send(run(p.split('/').at(-1)));
        if(p==='/api/sessions/save/state') {
          if(stateGate)await stateGate.promise;
          return send({sessionId:'save',status:'active',story:{key:'chapter',title:'Глава 1'},scene:{id:'scene',title:'Дверь',text:'Кошка у двери.',choices:[]},statsVariables:{}});
        }
        if(p==='/api/catalog/stories/ordinary')return send(ordinary);
        if(p==='/api/catalog/engagement/ordinary')return send({slug:'ordinary',views:1});
        if(p.startsWith('/auth/')||p.startsWith('/api/'))return send([]);
        let file=path.join(root,'frontend',p.slice(1));
        if(p==='/'||p==='/history'||/^\/(collections|history|read)\//.test(p))file=path.join(root,'frontend/index.html');
        if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
        return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:''});
      });
      const page=await context.newPage(),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(error.message));
      await page.goto(origin+'/collections/cat');
      await page.locator('#collection-screen select').selectOption('older');
      await page.waitForFunction(()=>document.querySelector('#story-reader-progress-label').textContent.includes('1 из 1'));
      await page.locator('#modal-lang-en').evaluate(node=>node.click());
      await page.waitForFunction(()=>document.documentElement.lang==='en'&&document.querySelector('#story-reader-progress-label').textContent.includes('1 of 1'));
      assert.equal(await page.locator('#collection-screen select').inputValue(),'older','Changing language preserves the selected run');

      // A row-level request must not reopen a reader after its contents were closed.
      await page.locator('#collection-screen select').selectOption('latest');
      await page.waitForFunction(()=>document.querySelector('#story-reader-progress-label').textContent.includes('0 of 1'));
      stateGate=deferred();
      let requested=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/sessions/save/state');
      await page.locator('#collection-screen').getByRole('button',{name:'Continue save',exact:true}).click();await requested;
      await page.locator('#story-detail-back').click();
      let responded=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/sessions/save/state');
      stateGate.resolve();await responded;await page.waitForLoadState('networkidle');
      assert.equal(new URL(page.url()).pathname,'/history','Late row response cannot navigate after close');
      assert.equal(await page.locator('#scene-screen').isVisible(),false);

      // Reopening while an old main-action request is in flight must stay usable.
      await page.locator('#stories a[href="/collections/cat"]').click();
      await page.waitForFunction(()=>!document.querySelector('#story-detail-action').disabled);
      stateGate=deferred();requested=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/sessions/save/state');
      await page.locator('#story-detail-action').click();await requested;
      await page.locator('#story-detail-back').click();await page.locator('#stories a[href="/collections/cat"]').click();
      await page.locator('#collection-screen select').waitFor();
      responded=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/sessions/save/state');
      stateGate.resolve();await responded;await page.waitForLoadState('networkidle');
      assert.equal(new URL(page.url()).pathname,'/collections/cat');
      assert.equal(await page.locator('#story-detail-action').isDisabled(),false,'A completed obsolete request cannot leave reopened controls disabled');

      // Selecting another run invalidates the old primary reading action too.
      stateGate=deferred();requested=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/sessions/save/state');
      await page.locator('#story-detail-action').click();await requested;
      await page.locator('#collection-screen select').selectOption('older');
      await page.waitForFunction(()=>document.querySelector('#story-reader-progress-label').textContent.includes('1 of 1'));
      responded=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/sessions/save/state');
      stateGate.resolve();await responded;await page.waitForLoadState('networkidle');
      assert.equal(new URL(page.url()).pathname,'/collections/cat','Late primary response cannot open a run after another run was selected');
      assert.equal(await page.locator('#collection-screen select').inputValue(),'older');
      assert.equal(await page.locator('#scene-screen').isVisible(),false);
      assert.equal(await page.locator('#story-detail-action').isDisabled(),false);

      // A cached previous visit cannot swallow a new detail request failure in a hidden panel.
      await page.locator('#story-detail-back').click();detailFails=true;
      responded=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/catalog/collections/cat'&&response.status()===503);
      await page.locator('#stories a[href="/collections/cat"]').click();await responded;await page.waitForLoadState('networkidle');
      const visibleErrors=page.getByText(/Could not load stories|Не удалось загрузить истории|Temporarily unavailable/).filter({visible:true});
      assert.ok(await visibleErrors.count(),'A repeated contents failure has a visible recovery message');
      detailFails=false;await page.getByRole('button',{name:'Try again',exact:true}).click();
      await page.locator('#collection-screen select').waitFor();
      assert.equal(await page.locator('#story-detail-screen').isVisible(),true,'The visible retry action recovers after the server returns');

      // Empty or temporarily unavailable chapter collections cannot hide another story's Start.
      empty=true;stateGate=null;await page.goto(origin+'/collections/cat');
      await page.locator('#story-detail-screen').waitFor({state:'visible'});await page.locator('#story-detail-back').click();
      await page.locator('#stories a[href="/history/ordinary"]').click();
      await page.locator('#story-detail-title').filter({hasText:ordinary.title}).waitFor();
      assert.equal(await page.locator('#story-detail-action').isVisible(),true,'Standalone Start must not inherit a hidden collection action');
      assert.equal(await page.locator('#story-detail-action').isDisabled(),false);
      assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      console.log(width,'selected run/language, stale row response, reopen during request, run switch during request, visible repeated-load failure/recovery, empty collection→standalone');
      await context.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
