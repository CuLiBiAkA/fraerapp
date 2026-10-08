// Isolated browser journeys exercising the real engine/request adapter and admin UI.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=process.cwd();
async function staticFile(route){if(process.env.CHECK_LIVE_STATIC==='1')return route.continue();const p=new URL(route.request().url()).pathname;let file=p==='/auth/admin'?path.join(root,'auth-service/src/main/resources/admin.html'):path.join(root,p.startsWith('/builder/')?'story-builder':'frontend',p.startsWith('/builder/')?p.slice(9):p);if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');if(!fs.existsSync(file))file=path.join(root,'frontend/index.html');return route.fulfill({path:file});}
(async()=>{const browser=await chromium.launch();try{
 for(const language of ['ru','en'])for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:900}}),errors=[];let count=0,claims=0,pending=null,fail=false,delay=false,release;
  await context.addInitScript(lang=>{localStorage.setItem('fraerapp.language',lang);localStorage.setItem('fraerapp.cookieConsent','accepted');},language);
  // Choices may lead back to the same scene; each server response is still new progress.
  const state=()=>({sessionId:'fixture',story:{key:'ad-fixture',title:'История'},scene:{id:'loop',title:'Сцена',text:'Сохранённый текст сцены '+count,choices:[{id:'next',label:'Дальше'}]},statsVariables:{},status:'active',readerAd:pending?{id:pending}:null});
  await context.route('https://fraerapp.ru/**',async route=>{
   const p=new URL(route.request().url()).pathname,send=(value,status=200)=>route.fulfill({json:value,status});
   if(p==='/auth/me')return send({email:'reader@example.test',roles:['player'],subscriptionActive:false});
   if(p==='/api/account')return send({unreadCount:0,notifications:[]});
   if(p==='/api/sessions/fixture/state')return send(state());
   if(p.endsWith('/choice')){count++;if(count%5===0)pending='offer-'+count;return send(state());}
   if(p==='/api/reader-ads/claim'){claims++;assert.deepEqual(route.request().postDataJSON(),{offerId:pending});if(fail)return send({},500);const id=pending;pending=null;if(delay)await new Promise(resolve=>{release=resolve;});return send({ad:{id,title:count===10?'<img src=x onerror=alert(1)>':'',body:'',linkUrl:count===10?'javascript:alert(1)':'',buttonLabel:''}});}
   if(p.startsWith('/api/')||p.startsWith('/auth/'))return send([]);return staticFile(route);
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://fraerapp.ru/read/fixture');await page.locator('#choices button').waitFor();
  for(let i=1;i<=5;i++){await page.locator('#choices button').click();await page.waitForFunction(n=>document.querySelector('#scene-text').textContent.endsWith(' '+n),i);if(i<5)assert.ok(!await page.locator('#reader-ad-dialog').isVisible());}
  await page.locator('#reader-ad-dialog').waitFor();assert.equal(claims,1);assert.equal(await page.locator('#reader-ad-continue').textContent(),language==='en'?'Continue story':'Продолжить историю');assert.ok(await page.locator('#reader-ad-link').isHidden());assert.equal(await page.locator('#reader-ad-subscribe').getAttribute('href'),'/subscription/');
  assert.ok(await page.locator('#reader-ad-dialog').evaluate(n=>n.scrollWidth<=n.clientWidth));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`/tmp/reader-ad-${language}-${width}.png`,fullPage:true});await page.keyboard.press('Escape');assert.ok(!await page.locator('#reader-ad-dialog').isVisible());
  await page.reload();await page.locator('#choices button').waitFor();assert.equal(claims,1);assert.ok(!await page.locator('#reader-ad-dialog').isVisible());
  for(let i=6;i<=10;i++){await page.locator('#choices button').click();await page.waitForFunction(n=>document.querySelector('#scene-text').textContent.endsWith(' '+n),i);}
  await page.locator('#reader-ad-dialog').waitFor();assert.equal(await page.locator('#reader-ad-title').textContent(),'<img src=x onerror=alert(1)>');assert.equal(await page.locator('#reader-ad-title img').count(),0);assert.ok(await page.locator('#reader-ad-link').isHidden());await page.locator('#reader-ad-continue').click();
  fail=true;for(let i=11;i<=15;i++){await page.locator('#choices button').click();await page.waitForFunction(n=>document.querySelector('#scene-text').textContent.endsWith(' '+n),i);}await page.waitForLoadState('networkidle');assert.ok(!await page.locator('#reader-ad-dialog').isVisible());assert.ok(await page.locator('#choices button').isEnabled());
  fail=false;await page.locator('#choices button').click();await page.locator('#reader-ad-dialog').waitFor();assert.equal(count,16);assert.equal(claims,4);await page.locator('#reader-ad-continue').click();
  delay=true;for(let i=17;i<=20;i++){await page.locator('#choices button').click();await page.waitForFunction(n=>document.querySelector('#scene-text').textContent.endsWith(' '+n),i);}while(!release)await new Promise(r=>setTimeout(r,10));
  await page.locator('#choices button').click();await page.waitForFunction(()=>document.querySelector('#scene-text').textContent.endsWith(' 21'));release();await page.waitForLoadState('networkidle');assert.ok(!await page.locator('#reader-ad-dialog').isVisible());assert.deepEqual(errors,[]);
  console.log('reader',language,width,'five transitions, JSON contract, Escape, refresh, text safety, failed/late response, no overflow');await context.close();
 }
 for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000}}),errors=[],saves=[];let allowed=true,conflict=true;let settings={enabled:true,intervalScenes:5,title:'',body:'',linkUrl:'',buttonLabel:'',version:1};
  await context.route('https://fraerapp.ru/**',async route=>{
   const p=new URL(route.request().url()).pathname,send=(value,status=200)=>route.fulfill({json:value,status});
   if(p==='/auth/me')return send({email:'admin@example.test',roles:['admin']});if(p==='/auth/admin/author-requests')return send([]);
   if(p==='/api/admin/reader-ads'){if(!allowed)return send({},403);if(route.request().method()==='PUT'){saves.push(route.request().postDataJSON());if(conflict){conflict=false;return send({},409);}settings={...saves.at(-1),version:2,updatedBy:'admin@example.test',updatedAt:new Date().toISOString()};}return send(settings);}
   if(p.startsWith('/api/')||p.startsWith('/auth/')&&p!=='/auth/admin')return send({notifications:[],unreadCount:0});return staticFile(route);
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://fraerapp.ru/auth/admin#advertising');await page.waitForFunction(()=>!document.querySelector('#ad-intervalScenes').disabled&&!document.querySelector('#advertising-form fieldset').disabled);
  assert.equal(await page.locator('#ad-intervalScenes').inputValue(),'5');await page.locator('#ad-title').fill('Объявление');await page.locator('#ad-intervalScenes').fill('8');await page.locator('#ad-linkUrl').fill('javascript:alert(1)');await page.locator('#advertising-save').click();assert.equal(saves.length,0);
  await page.locator('#ad-linkUrl').fill('https://example.test/offer');await page.locator('#advertising-save').click();await page.getByText('Настройки изменил другой администратор.',{exact:false}).waitFor();assert.equal(await page.locator('#ad-title').inputValue(),'Объявление');
  await page.locator('#advertising-refresh').click();await page.locator('#confirm-submit').click();await page.waitForFunction(()=>document.querySelector('#ad-title').value==='');
  await page.locator('#ad-intervalScenes').fill('8');await page.locator('#ad-title').fill('Объявление');await page.locator('#ad-enabled').uncheck();await page.locator('#advertising-save').click();await page.getByText('Реклама отключена.',{exact:true}).waitFor();assert.equal(saves.at(-1).intervalScenes,8);assert.equal(saves.at(-1).enabled,false);assert.equal(saves.at(-1).version,1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`/tmp/reader-ad-admin-${width}.png`,fullPage:true});allowed=false;await page.locator('#advertising-refresh').click();await page.locator('#access-denied').waitFor();assert.equal(await page.locator('#ad-title').inputValue(),'');assert.deepEqual(errors,[]);
  console.log('admin',width,'save, preview, URL validation, version conflict, draft retained, role loss, no overflow');await context.close();
 }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1);});
