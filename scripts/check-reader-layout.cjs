const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch();
for(const width of [1722,1024,768,700,390,320]){
 const context=await browser.newContext({viewport:{width,height:900}});let selected=false;const choiceCount=width===320?1:width===1024?6:3;
 await context.addInitScript(()=>localStorage.setItem('fraerapp.cookieConsent','accepted'));
 const state=()=>({sessionId:'fixture',story:{key:'kak_pogladit_kota_ne_ubiv',title:'Бархатная лапа · Глава 1'},scene:{id:'start',title:'Как подойти к коту?',text:selected?'Кот довольно замурлыкал.':'Кот устроился на диване и внимательно следит за твоей рукой.',backgroundUrl:'/assets/platform.svg',choices:selected?[]:Array.from({length:choiceCount},(_,i)=>({id:i?'wait'+i:'pet',label:i?'Подождать и посмотреть, что будет дальше '+i:'Медленно протянуть руку'}))},statsVariables:{trust:selected?7:6,cat_mood:2,noise:0,scratches:0,treats:2,distance:3},status:selected?'finished':'active'});
 await context.route('https://fraerapp.ru/**',async r=>{
  const u=new URL(r.request().url()),p=u.pathname;
  if(p==='/auth/me')return r.fulfill({json:{email:'reader@example.test',roles:['author','admin']}});
  if(p==='/api/account')return r.fulfill({json:{unreadCount:0,notifications:[]}});
  if(p==='/api/sessions/fixture/state')return r.fulfill({json:state()});
  if(p.includes('/choice')){selected=true;return r.fulfill({json:state()});}
  if(p.startsWith('/api/')||p.startsWith('/auth/'))return r.fulfill({json:[]});
  if(process.env.CHECK_LIVE_STATIC==='1')return r.continue();
  let f=path.join(process.cwd(),p.startsWith('/builder/')?'story-builder':'frontend',p.startsWith('/builder/')?p.slice(9):p.slice(1));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f))f=path.join(process.cwd(),'frontend/index.html');return r.fulfill({path:f});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://fraerapp.ru/',{waitUntil:'domcontentloaded'});await page.locator('#home-search-form').waitFor({state:'visible'});
 const search=await page.locator('#home-search-form').boundingBox(),icons=await page.locator('[data-site-account]').boundingBox();assert.ok(Math.abs(search.y+search.height/2-icons.y-icons.height/2)<2);assert.ok(search.x+search.width<icons.x);
 await page.locator('[data-site-account]').click();await page.locator('#profile-modal').waitFor({state:'visible'});
 const buttons=await page.locator('#profile-modal .outline-button:visible').all();for(let i=1;i<buttons.length;i++){const a=await buttons[i-1].boundingBox(),b=await buttons[i].boundingBox();assert.ok(b.y-a.y-a.height>=11);}
 if(width===390)await page.screenshot({path:'/tmp/unified-account.png',animations:'disabled'});
 await page.keyboard.press('Escape');await page.goto('https://fraerapp.ru/read/fixture',{waitUntil:'domcontentloaded'});await page.locator('#scene-screen').waitFor({state:'visible'});
 assert.equal(await page.locator('#scene-stats').evaluate(n=>n.open),false);
 await page.locator('#scene-stats summary').click();await page.locator('#scene-stats summary').click();
 assert.ok(await page.locator('[data-site-account]').isVisible());assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.waitForFunction(()=>{const image=document.querySelector('#scene-image');return image.complete&&image.naturalWidth>0;});
 await page.screenshot({path:'/tmp/reader-layout-'+width+'.png',fullPage:true});
 assert.equal(await page.locator('#choices').isVisible(),true);
 assert.equal(await page.locator('#choices button').count(),choiceCount);
 assert.equal(await page.locator('#scene-text').isVisible(),true);
 assert.equal(await page.locator('.reader-continue').count(),0);
 assert.ok(await page.locator('#scene-image').evaluate(n=>n.complete&&n.naturalWidth>0&&n.src.includes('cat-sofa-background-v2.png')));
 const textBox=await page.locator('#scene-text').boundingBox(),choiceBox=await page.locator('#choices').boundingBox();
 assert.ok(textBox.y+textBox.height<=choiceBox.y);
 await page.locator('#scene-stats summary').click();
 assert.equal(await page.locator('#scene-stats').evaluate(n=>n.open),true);
 await page.screenshot({path:'/tmp/reader-stats-'+width+'.png',fullPage:true});
 await page.locator('#scene-stats summary').click();
 await page.getByRole('button',{name:'Медленно протянуть руку',exact:true}).click();await page.getByText('Кот довольно замурлыкал.',{exact:true}).waitFor();assert.ok(selected);assert.deepEqual(errors,[]);
 console.log(width+': header alignment, account spacing, stats toggle, scene choice and no overflow passed');await context.close();
}await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
