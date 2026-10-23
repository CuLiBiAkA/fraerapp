// Explicit operator check. Authentication cookies arrive only over stdin and are never logged.
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const input=JSON.parse(fs.readFileSync(0,'utf8'));
 const story=JSON.parse(fs.readFileSync('story-builder/scenarios/kto-ty-po-zhizni.json','utf8'));
 const route=JSON.parse(fs.readFileSync('story-builder/fixtures/kto-ty-po-zhizni-routes.json','utf8'))[0];
 const byId=new Map(story.scenes.map(s=>[s.id,s]));
 const browser=await chromium.launch();
 const results=[];
 let activePage=null,step='initialization';
 const fit=async(page)=>{
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(requestAnimationFrame);});
  assert.ok(await page.evaluate(()=>{
   const panel=document.querySelector('#scene-screen .story-panel');
   return document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+2&&panel.scrollHeight<=panel.clientHeight+2;
  }),'Reader content must fit the viewport');
 };
 try{
  for(const width of [320,390,1440]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   await context.addCookies(input.cookies);
   await context.addInitScript(()=>localStorage.setItem('fraerapp.cookieConsent','accepted'));
   const page=await context.newPage(),errors=[];
   activePage=page;step=`${width}px: open preview`;
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(input.base+'/?previewStory='+input.storyId+'&revision='+input.revision,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('#scene-screen')?.dataset.readerReady==='true',null,{timeout:30000});
   await page.waitForFunction(()=>{const n=document.querySelector('#scene-image');return n.complete&&n.naturalWidth>0;});
   assert.equal(await page.locator('#scene-title').textContent(),byId.get('arrival').title);
   await fit(page);
   await page.screenshot({path:path.join(input.output,'reader-'+width+'.png'),fullPage:true});
   let scene=byId.get('arrival');
   const choices=width===390?route.choices:route.choices.slice(0,5);
   for(const id of choices){
    step=`${width}px: ${scene.id}/${id}`;
    const choice=scene.choices.find(c=>c.id===id);assert.ok(choice,scene.id+'/'+id);
    const expected=byId.get(choice.target);
    const answer=page.locator('#choices').getByRole('button',{name:choice.label,exact:true});
    for(let turn=0;!await answer.isVisible()&&turn<80;turn++){
     assert.ok(await page.locator('#reader-page-next').isEnabled(),`Missing choice: ${choice.id}`);
     await page.locator('#reader-page-next').click();
     await fit(page);
    }
    const [response]=await Promise.all([
     page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname===`/api/author/stories/${input.storyId}/playtest`),
     answer.click(),
    ]);assert.ok(response.ok());
    assert.equal((await response.json()).scene.id,expected.id);
    await page.waitForFunction(title=>document.querySelector('#scene-title')?.textContent===title&&!document.querySelector('#choices')?.hasAttribute('aria-busy'),expected.title);
    await fit(page);
    scene=expected;
   }
   if(width===390){
    assert.equal(scene.id,'end_authority');
    assert.equal(await page.locator('#choices button').count(),0);
    await page.screenshot({path:path.join(input.output,'ending-390.png'),fullPage:true});
   }
   assert.deepEqual(errors,[]);results.push({width,transitions:choices.length,noOverflow:true});
   await context.close();
  }
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  await context.addCookies(input.cookies);
  const page=await context.newPage();
  activePage=page;step='Builder export';
  await page.goto(input.base+'/builder/?story='+input.storyId+'&work='+input.collectionId,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(title=>document.querySelector('#chapter-title')?.textContent===title,story.title,{timeout:30000});
  const downloadPromise=page.waitForEvent('download');await page.locator('#download-json').click();
  const download=await downloadPromise;
  const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  assert.equal(exported.key,story.key);assert.equal(exported.scenes.length,60);
  assert.deepEqual(exported.scenes,story.scenes);assert.deepEqual(exported.variables,story.variables);
  results.push({builderExport:true,scenes:60});await context.close();
  console.log(JSON.stringify({browserChecks:results}));
 }catch(error){
  if(activePage&&!activePage.isClosed()){
   await activePage.screenshot({path:path.join(input.output,'failed-check.png'),fullPage:true}).catch(()=>{});
   const state=await activePage.evaluate(()=>({title:document.querySelector('#scene-title')?.textContent,status:document.querySelector('#status')?.textContent,page:document.querySelector('#scene-screen')?.dataset.readerPage,pages:document.querySelector('#scene-screen')?.dataset.readerPages,busy:document.querySelector('#choices')?.hasAttribute('aria-busy')})).catch(()=>null);
   console.error(JSON.stringify({step,state}));
  }
  throw error;
 }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exit(1);});
