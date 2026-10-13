const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch();
for(const width of [1722,1440,1024,768,390,320]){
 const c=await browser.newContext({viewport:{width,height:1000}});const mutations=[];let review='draft',saved=null,generation=0;
 const comment='Добавьте предупреждение о пугающей сцене.\n'+('Уточните описание выбора, чтобы читателю было понятно действие героя. ').repeat(12);
 await c.route('https://fraerapp.ru/**',r=>{
  const req=r.request(),p=new URL(req.url()).pathname;const send=json=>r.fulfill({json});
  if(['POST','PUT'].includes(req.method()))mutations.push(p);
  if(p==='/auth/me')return send({email:'author@example.test',roles:['author']});
  if(p==='/api/author/home')return send({stories:saved?[{storyId:'chapter',title:saved.title,reviewState:review,visibility:'private',draftRevision:1,generation,reason:comment}]:[]});
  if(p==='/api/author/stories/import'){saved=req.postDataJSON();generation=1;return send({storyId:'chapter',generation,draftRevision:1});}
  if(p==='/api/author/stories/chapter'&&req.method()==='PUT'){const body=req.postDataJSON();assert.equal(body.generation,generation);saved=body.document;generation++;return send({storyId:'chapter',generation,draftRevision:1});}
  if(p==='/api/author/stories/chapter/review'){review='in_review';return send({submittedRevision:1});}
  if(p.startsWith('/auth/')||p.startsWith('/api/'))return send({notifications:[],unreadCount:0});
  let f=path.join(process.cwd(),p.startsWith('/builder/')?'story-builder':'frontend',p.startsWith('/builder/')?p.slice(9):p.slice(1));
  if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');return r.fulfill({path:f});
 });
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('https://fraerapp.ru/builder/');
 await p.waitForFunction(()=>!document.body.classList.contains('builder-locked'));
 await p.locator('#import-runtime').waitFor();
 assert.equal(await p.locator('[data-meta="version"]').count(),0);
 for(const selector of ['.active-context-kicker','.status-badge']){
  const style=await p.locator(selector).first().evaluate(el=>{const s=getComputedStyle(el);return [s.fontFamily,s.fontSize,s.lineHeight,s.fontWeight];});
  assert.match(style[0],/Montserrat/);assert.deepEqual(style.slice(1),['18px','25px','400']);
 }
 const textStyle=await p.locator('[data-meta="title"]').evaluate(el=>{const s=getComputedStyle(el);return [s.fontFamily,s.fontSize,s.lineHeight,s.fontWeight];});
 assert.match(textStyle[0],/Inter/);assert.deepEqual(textStyle.slice(1),['14px','18px','400']);
 const scene= p.locator('.collapsible-item:has(> .scene-order)').first();
 if(await scene.count()){
  await scene.evaluate(el=>el.open=true);
  const remove=await scene.locator(':scope > .collapsible-tools .danger').boundingBox(),order=await scene.locator(':scope > .scene-order').boundingBox();
  assert.ok(order.y-remove.y-remove.height>=12,'Delete and reorder controls have at least 12px separation');
 }
 assert.equal(await p.locator('#chapter-review-feedback').isVisible(),false);
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
 assert.doesNotMatch(await p.locator('#server-draft-state').innerText(),/v\d/);
 assert.doesNotMatch(await p.locator('#chapter-status').innerText(),/v\d/);
 await p.locator('#tab-publication').click();await p.locator('#publish-runtime').click();
 await p.getByText('На модерации',{exact:true}).waitFor();
 assert.ok(mutations.includes('/api/author/stories/chapter/review'));
 const feedback=p.locator('#chapter-review-feedback'),summary=feedback.locator('summary');
 assert.equal(await feedback.getAttribute('open'),null);
 const before=(await p.locator('#chapter-workspace').boundingBox()).height;
 await summary.focus();await p.keyboard.press('Enter');
 assert.equal(await p.locator('#chapter-review-comment').textContent(),comment);
 assert.ok((await p.locator('#chapter-workspace').boundingBox()).height>before+100);
 assert.ok(await feedback.evaluate(n=>n.scrollHeight<=n.clientHeight+2));
 assert.equal(await feedback.evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(248, 220, 227)');
 assert.equal(await feedback.evaluate(n=>getComputedStyle(n).borderTopColor),'rgb(164, 70, 94)');
 for(const node of [summary,p.locator('#chapter-review-comment')])assert.deepEqual(await node.evaluate(n=>{const s=getComputedStyle(n);return [s.fontSize,s.lineHeight,s.fontWeight,s.letterSpacing];}),['18px','25px','400','normal']);
 assert.ok(await summary.locator('img').evaluate(n=>n.complete&&n.naturalWidth>0&&Math.abs(n.getBoundingClientRect().width-23.3118)<.1));
 if([1440,390].includes(width))await p.locator('#chapter-workspace').screenshot({path:`/tmp/chapter-feedback-${width}.png`});
 await summary.click();assert.equal(await feedback.getAttribute('open'),null);
 for(const tab of ['chapter','check','publication']){
  await p.locator('#tab-'+tab).click();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await p.locator('#chapter-workspace').evaluate(n=>n.scrollWidth<=n.clientWidth));
  if([1440,390].includes(width))await p.locator('#chapter-workspace').screenshot({path:`/tmp/chapter-tabs-${width}-${tab}.png`});
 }
 assert.deepEqual(errors,[]);console.log(width,'tabs, keyboard, current JSON, invalid submission blocked, save/review, preview, no overflow');await c.close();
}await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
