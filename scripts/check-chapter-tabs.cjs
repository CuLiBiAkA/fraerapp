const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch();
for(const width of [1722,1440,1024,768,390,320]){
 const c=await browser.newContext({viewport:{width,height:1000}});const mutations=[];let review='draft',saved=null;
 await c.route('https://fraerapp.ru/**',r=>{
  const req=r.request(),p=new URL(req.url()).pathname;const send=json=>r.fulfill({json});
  if(req.method()==='POST')mutations.push(p);
  if(p==='/auth/me')return send({email:'author@example.test',roles:['author']});
  if(p==='/api/author/home')return send({stories:saved?[{storyId:'chapter',title:saved.title,reviewState:review,visibility:'private',draftRevision:1}]:[]});
  if(p==='/api/author/stories/import'){saved=req.postDataJSON();return send({storyId:'chapter',generation:1,draftRevision:1});}
  if(p==='/api/author/stories/chapter/review'){review='in_review';return send({submittedRevision:1});}
  if(p.startsWith('/auth/')||p.startsWith('/api/'))return send({notifications:[],unreadCount:0});
  let f=path.join(process.cwd(),p.startsWith('/builder/')?'story-builder':'frontend',p.startsWith('/builder/')?p.slice(9):p.slice(1));
  if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');return r.fulfill({path:f});
 });
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('https://fraerapp.ru/builder/');
 await p.waitForFunction(()=>!document.body.classList.contains('builder-locked'));
 await p.locator('#import-runtime').waitFor();
 assert.deepEqual(await p.getByRole('tab').allTextContents(),['Моя глава','Проверка','Публикация']);
 assert.equal(await p.locator('#author-search, #author-story-select, #author-filter').count(),0);
 await p.locator('#tab-chapter').focus();await p.keyboard.press('ArrowDown');
 assert.equal(await p.locator('#tab-check').getAttribute('aria-selected'),'true');
 await p.locator('#validate-runtime').click();assert.equal(mutations.length,0);
 await p.locator('#tab-chapter').click();await p.locator('#preview-chapter').click();
 assert.ok(await p.locator('#chapter-preview-dialog').isVisible());await p.keyboard.press('Escape');
 await p.locator('[data-meta="title"]').fill('');await p.locator('[data-meta="title"]').blur();
 await p.locator('#tab-publication').click();await p.locator('#publish-runtime').click();
 assert.equal(await p.locator('#tab-check').getAttribute('aria-selected'),'true');assert.equal(mutations.length,0);
 await p.locator('[data-meta="title"]').fill('Ночной звонок');await p.locator('[data-meta="title"]').blur();
 await p.locator('#tab-chapter').click();await p.locator('#import-runtime').click();
 await p.waitForFunction(()=>document.querySelector('#server-draft-state').textContent.includes('сервер'));
 await p.locator('#tab-publication').click();await p.locator('#publish-runtime').click();
 await p.getByText('На модерации',{exact:true}).waitFor();
 assert.ok(mutations.includes('/api/author/stories/chapter/review'));
 for(const tab of ['chapter','check','publication']){
  await p.locator('#tab-'+tab).click();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await p.locator('#chapter-workspace').evaluate(n=>n.scrollWidth<=n.clientWidth));
  if([1440,390].includes(width))await p.locator('#chapter-workspace').screenshot({path:`/tmp/chapter-tabs-${width}-${tab}.png`});
 }
 assert.deepEqual(errors,[]);console.log(width,'tabs, keyboard, current JSON, invalid submission blocked, save/review, preview, no overflow');await c.close();
}await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
