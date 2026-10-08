const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const base=process.cwd();
(async()=>{const browser=await chromium.launch({headless:true});
for(const width of [1440,768,390,320]){
 const context=await browser.newContext({viewport:{width,height:900}});let signed=true,unread=true;
 await context.route('https://fraerapp.ru/**',async r=>{
  const u=new URL(r.request().url());const p=u.pathname;
  if(p==='/auth/me')return r.fulfill({status:signed?200:401,json:signed?{email:'designer@example.test',roles:['author','admin']}: {}});
  if(p==='/api/account')return r.fulfill({json:{unreadCount:unread?1:0,notifications:unread?[{id:'fixture',kind:'message',message:'Проверка уведомления',unread:true}]:[]}});
  if(p==='/api/account/notifications/fixture/read'){unread=false;return r.fulfill({json:{}});}
  if(p==='/api/author/home')return r.fulfill({json:{stories:[]}});
  if(p==='/api/catalog/stories')return r.fulfill({json:Array.from({length:4},(_,i)=>({key:'story'+i,slug:'story'+i,title:'История '+(i+1),coverUrl:'/assets/platform.svg'}))});
  if(p==='/auth/admin')return r.fulfill({response:await r.fetch()});
  if(p.startsWith('/api/')||p.startsWith('/auth/'))return r.fulfill({json:[]});
  let f=path.join(base,p.startsWith('/builder/')?'story-builder':'frontend',p.startsWith('/builder/')?p.slice(9):p.slice(1));
  if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');
  if(!fs.existsSync(f))f=path.join(base,'frontend/index.html');
  return r.fulfill({path:f});
 });
 const page=await context.newPage();
 for(const url of ['/builder/','/builder/board.html','/','/history','/my-stories/','/moderation/','/privacy-policy.html','/terms.html','/personal-data-consent.html','/workspace-access.html','/auth/admin']){
  const errors=[];const handler=e=>errors.push(e.message);page.on('pageerror',handler);
  await page.goto('https://fraerapp.ru'+url);await page.locator('#site-controls > button').first().waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-site-account]').classList.contains('account-signed'));
  assert.equal(await page.locator('#site-controls > button').count(),2);
  if(url!=='/') {
    const home=await page.locator('.builder-home, #site-controls .site-home').filter({visible:true}).boundingBox();
    const icon=await page.locator('[data-site-account]').boundingBox();
    assert.ok(Math.abs(home.y+home.height/2-icon.y-icon.height/2)<2,'home alignment '+url+' '+width);
  }
  if(url==='/history'&&width===1440)assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),'four-story desktop library should fit');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+url+' '+width);
  await page.locator('#site-controls > button').first().click();
  const main=['/','/history'].includes(url);
  const dialog=page.locator('#settings-modal');await dialog.waitFor({state:'visible'});
  assert.equal(new URL(page.url()).pathname,url);
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await page.locator('[data-site-account]').click();
  const profile=page.locator('#profile-modal');await profile.waitFor({state:'visible'});
  assert.ok(await profile.getByText('designer@example.test',{exact:true}).isVisible());
  if(url==='/builder/'&&width===1440)await page.screenshot({path:'/tmp/site-controls-profile.png'});
  await page.keyboard.press('Escape');
  if(url==='/builder/'&&[1440,390].includes(width))await page.screenshot({path:'/tmp/site-controls-builder-'+width+'.png'});
  assert.deepEqual(errors,[],'page errors '+url);page.off('pageerror',handler);
 }
 signed=false;await page.goto('https://fraerapp.ru/builder/');await page.locator('[data-site-account]').click();await page.locator('#auth-modal').waitFor({state:'visible'});assert.equal(await page.locator('.account-signed').count(),0);await page.keyboard.press('Escape');
 await page.goto('https://fraerapp.ru/?panel=account');await page.locator('#auth-modal').waitFor({state:'visible'});
 signed=true;unread=true;await page.goto('https://fraerapp.ru/builder/');await page.waitForFunction(()=>document.querySelector('[data-site-account]').classList.contains('account-unread'));await page.locator('[data-site-account]').click();await page.locator('#profile-notification-title').click();await page.getByRole('button',{name:'Прочитано',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-site-account]').classList.contains('account-unread'));
 console.log(width+': eleven pages, settings/account dialogs, roles, guest and unread states passed');await context.close();
}await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
