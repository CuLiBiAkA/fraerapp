// Isolated UI fixtures: no real account or production writes.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try{for(const language of ['ru','en'])for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}});
  await context.addInitScript(lang=>{localStorage.setItem('fraerapp.language',lang);localStorage.setItem('fraerapp.storyBuilderLanguage',lang);},language);
  let blocked=true,saved=null;const mutations=[],errors=[];
  const doc={schemaVersion:2,key:'book',title:'My story',type:'story',description:'',completionStatus:'in_development',items:[{target:{kind:'scenario',id:'chapter',key:'chapter'}}],transitions:[]};
  const detail=()=>({collectionId:'book',id:'book',key:'book',title:doc.title,reviewState:'draft',visibility:'private',generation:1,draftRevision:1,draftDocument:doc,reviewLimitReached:blocked});
  await context.route('https://fraerapp.ru/**',route=>{
   const req=route.request(),p=new URL(req.url()).pathname,send=value=>route.fulfill({json:value});
   if(!['GET','HEAD'].includes(req.method()))mutations.push(p);
   if(p==='/auth/me')return send({email:'author@example.test',roles:['author']});
   if(p==='/api/author/home')return send({stories:saved?[{storyId:'chapter',title:saved.title,reviewState:'draft',visibility:'private',draftRevision:1,reviewLimitReached:blocked}]:[]});
   if(p==='/api/author/stories/import'){saved=req.postDataJSON();return send({storyId:'chapter',generation:1,draftRevision:1});}
   if(p==='/api/author/folders')return send({items:[{...detail(),kind:'collection',children:[]}],total:1});
   if(p==='/api/author/collections/book')return send(detail());
   if(p==='/api/author/collections/targets')return send([{kind:'scenario',id:'chapter',key:'chapter',title:'Chapter',owned:true}]);
   if(p.startsWith('/auth/')||p.startsWith('/api/'))return send({notifications:[],unreadCount:0});
   let file=path.join(process.cwd(),p.startsWith('/builder/')?'story-builder':'frontend',p.startsWith('/builder/')?p.slice(9):p.slice(1));
   if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
   return route.fulfill({path:file});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://fraerapp.ru/my-stories/?view=collections&collection=book');
  const submit=page.locator('[data-review-submit]').first();await submit.waitFor();
  assert.ok(await submit.isDisabled());assert.ok(await page.locator('.review-limit-notice').isVisible());
  const title=page.getByLabel(language==='ru'?'Название':'Title',{exact:true});await title.fill('Unsaved story title');
  const save=page.getByRole('button',{name:language==='ru'?'Сохранить':'Save',exact:true});assert.ok(await save.isEnabled());
  blocked=false;
  await page.getByRole('button',{name:language==='ru'?'Обновить список':'Refresh list',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('[data-review-submit]').disabled);
  assert.equal(await title.inputValue(),'Unsaved story title');assert.ok(await page.locator('.review-limit-notice').isHidden());
  assert.equal(mutations.length,0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  // Reload in a fresh page to avoid deliberately unsaved form navigation.
  const builder=await context.newPage();builder.on('pageerror',e=>errors.push(e.message));
  await builder.goto('https://fraerapp.ru/builder/');await builder.waitForFunction(()=>!document.body.classList.contains('builder-locked'));
  await builder.locator('#import-runtime').click();await builder.waitForFunction(()=>document.querySelector('#server-draft-state').textContent.length>0);
  await builder.waitForFunction(()=>document.querySelector('#chapter-status').textContent.length>0);
  blocked=true;await builder.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await builder.waitForFunction(()=>document.querySelector('#publish-runtime').disabled);
  await builder.locator('[data-meta="title"]').fill('Unsaved chapter title');await builder.locator('[data-meta="title"]').blur();
  assert.ok(await builder.locator('#import-runtime').isEnabled());
  await builder.locator('#tab-publication').click();
  assert.match(await builder.locator('[data-panel-text="submitHint"]').textContent(),language==='ru'?/друг|Другая/:/another|Another/);
  blocked=false;await builder.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await builder.waitForFunction(()=>!document.querySelector('#publish-runtime').disabled);
  assert.equal(await builder.locator('[data-meta="title"]').inputValue(),'Unsaved chapter title');
  assert.ok(await builder.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(mutations,['/api/author/stories/import']);assert.deepEqual(errors,[]);
  console.log(language,width,'quota blocks submission, drafts remain editable, refresh preserves unsaved work, no overflow');
  await context.close();
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
