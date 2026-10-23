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
 try{
  for(const width of [320,390,1440]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   await context.addCookies(input.cookies);
   await context.addInitScript(()=>localStorage.setItem('fraerapp.cookieConsent','accepted'));
   const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(input.base+'/?previewStory='+input.storyId+'&revision='+input.revision,{waitUntil:'domcontentloaded'});
   await page.locator('#choices button').first().waitFor({timeout:30000});
   await page.waitForFunction(()=>{const n=document.querySelector('#scene-image');return n.complete&&n.naturalWidth>0;});
   assert.equal(await page.locator('#scene-title').textContent(),byId.get('arrival').title);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:path.join(input.output,'reader-'+width+'.png'),fullPage:true});
   let scene=byId.get('arrival');
   const choices=width===390?route.choices:route.choices.slice(0,5);
   for(const id of choices){
    const choice=scene.choices.find(c=>c.id===id);assert.ok(choice,scene.id+'/'+id);
    const expected=byId.get(choice.target);
    await page.getByRole('button',{name:choice.label,exact:true}).click();
    await page.waitForFunction(title=>document.querySelector('#scene-title')?.textContent===title,expected.title);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),expected.id);
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
  await page.goto(input.base+'/builder/?story='+input.storyId+'&work='+input.collectionId,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(title=>document.querySelector('#chapter-title')?.textContent===title,story.title,{timeout:30000});
  const downloadPromise=page.waitForEvent('download');await page.locator('#download-json').click();
  const download=await downloadPromise;
  const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  assert.equal(exported.key,story.key);assert.equal(exported.scenes.length,60);
  assert.deepEqual(exported.scenes,story.scenes);assert.deepEqual(exported.variables,story.variables);
  results.push({builderExport:true,scenes:60});await context.close();
  console.log(JSON.stringify({browserChecks:results}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exit(1);});
