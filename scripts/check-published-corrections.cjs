// UI fixtures only. Real authorization and revision transitions are covered by HTTP integration tests.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const output=path.join(require('os').tmpdir(),'fraer-published-lock');fs.mkdirSync(output,{recursive:true});
(async()=>{const browser=await chromium.launch();try{
 for(const width of [390,1440])for(const lang of ['ru','en']){
  const context=await browser.newContext({viewport:{width,height:1000}}),errors=[],writes=[];
  const doc={key:'chapter',title:'Published chapter',version:1,startSceneId:'end',variables:{},assets:[],scenes:[{id:'end',title:'Ending',text:'Published text',ending:{title:'End'},choices:[]}]};
  let role='author';
  let chapter={storyId:'chapter',title:doc.title,key:doc.key,ownerUserId:'author',visibility:'public',generation:3,publishedRevision:1,draftRevision:1,submittedRevision:1,reviewState:'approved',canEditDraft:false,correctionRequested:false,draftDocument:doc,publishedDocument:doc,versions:[{versionNumber:1}],events:[]};
  await context.addInitScript(language=>{localStorage.setItem('fraerapp.language',language);localStorage.setItem('fraerapp.storyBuilderLanguage',language);},lang);
  await context.route('https://fraerapp.ru/**',async route=>{
   const req=route.request(),url=new URL(req.url()),p=url.pathname,send=json=>route.fulfill({json});
   if(req.method()!=='GET')writes.push({path:p,body:req.postDataJSON()});
   if(p==='/auth/me')return send({id:role,email:role+'@example.test',roles:[role]});
   if(p==='/api/account')return send({notifications:[],unreadCount:0});
   if(p==='/api/author/home')return send({stories:[chapter]});
   if(p==='/api/moderation/stories')return send({items:[chapter],totalPages:1,totalElements:1});
   if(p==='/api/author/stories')return send([chapter]);
   if(p.endsWith('/chapter/request-correction')){
    const command=req.postDataJSON();assert.equal(command.revision,1);assert.equal(command.generation,3);assert.equal(command.reason,'Fix the serious ending error.');
    chapter={...chapter,generation:4,draftRevision:2,submittedRevision:null,reviewState:'rejected',canEditDraft:true,correctionRequested:true,correctionReason:command.reason,reason:command.reason,hasDraft:true,versions:[{versionNumber:1},{versionNumber:2}],events:[{action:'request-correction',reason:command.reason,revision:1}]};return send(chapter);
   }
   if(p.endsWith('/chapter/preview'))return send({revision:Number(url.searchParams.get('revision'))||chapter.draftRevision,document:doc,publishedDocument:doc,validation:{valid:true}});
   if(p.endsWith('/chapter/document'))return send(doc);
   if(p==='/api/author/stories/chapter'||p==='/api/moderation/stories/chapter')return send(chapter);
   if(p.startsWith('/api/')||p.startsWith('/auth/'))return send({items:[],notifications:[],unreadCount:0});
   let file=path.join(process.cwd(),p.startsWith('/builder/')?'story-builder':'frontend',p.startsWith('/builder/')?p.slice(9):p.slice(1));if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
   return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:''});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://fraerapp.ru/builder/?story=chapter');
  await page.locator('#chapter-title').filter({hasText:doc.title}).waitFor();
  assert.ok(await page.locator('[data-meta=title]').isDisabled());
  assert.ok(await page.locator('#import-runtime').isDisabled());
  assert.ok(await page.locator('#chapter-edit-notice').isVisible());
  await page.locator('#tab-publication').click();assert.ok(await page.locator('#publish-runtime').isDisabled());
  assert.equal(writes.length,0);
  role='moderator';await page.goto('https://fraerapp.ru/moderation/?story=chapter&revision=1');
  const action=page.getByRole('button',{name:lang==='ru'?'Запросить исправление опубликованной главы':'Request a published chapter correction',exact:true});await action.waitFor();
  await page.waitForFunction(()=>!document.querySelector('.workspace-detail')?.getAttribute('aria-busy')||document.querySelector('.workspace-detail')?.getAttribute('aria-busy')==='false');
  await action.click();const dialog=page.locator('dialog[open]'),reason=dialog.locator('textarea').first();
  assert.ok(await reason.evaluate(n=>n.required));
  await dialog.getByRole('button',{name:lang==='ru'?'Подтвердить':'Confirm',exact:true}).click();assert.equal(writes.length,0);
  await reason.fill('Fix the serious ending error.');await dialog.getByRole('button',{name:lang==='ru'?'Подтвердить':'Confirm',exact:true}).click();
  await dialog.waitFor({state:'hidden'});assert.equal(writes.length,1);
  role='author';await page.goto('https://fraerapp.ru/builder/?story=chapter');await page.locator('#chapter-title').filter({hasText:doc.title}).waitFor();
  assert.equal(await page.locator('[data-meta=title]').isDisabled(),false);
  assert.equal(await page.locator('#import-runtime').isDisabled(),false);
  await page.locator('#tab-publication').click();assert.equal(await page.locator('#chapter-review-comment').innerText(),'Fix the serious ending error.');
  assert.equal(await page.locator('#publish-runtime').isDisabled(),false);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(output,`correction-${lang}-${width}.png`),fullPage:true});
  for(const state of ['in_review','approved']){
   chapter={...chapter,reviewState:state,canEditDraft:false,submittedRevision:2};
   await page.goto('https://fraerapp.ru/builder/?story=chapter');await page.locator('#chapter-title').filter({hasText:doc.title}).waitFor();
   assert.ok(await page.locator('[data-meta=title]').isDisabled());
   const notice=await page.locator('#chapter-edit-notice').innerText();
   assert.match(notice,state==='in_review'?(lang==='ru'?/Исправление на проверке/:/correction is under review/):(lang==='ru'?/Исправление одобрено/:/correction is approved/));
   await page.locator('#tab-publication').click();assert.ok(await page.locator('#publish-runtime').isDisabled());
  }
  assert.deepEqual(errors,[]);console.log(width,lang,'published read-only / moderator comment required / correction unlocked / review and approval relock');await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
