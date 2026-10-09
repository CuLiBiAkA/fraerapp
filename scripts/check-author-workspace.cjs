// Browser contract checks. All network requests are intercepted; no real accounts or writes.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
async function audit(page,label){if(!process.env.AUTHOR_AXE_PATH)return;await page.addScriptTag({path:process.env.AUTHOR_AXE_PATH});const violations=await page.evaluate(async()=>{const result=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return result.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));});assert.deepEqual(violations,[],label);}
(async()=>{const browser=await chromium.launch();try{
for(const language of ['ru','en'])for(const width of [320,390,768,1440]){
 const context=await browser.newContext({viewport:{width,height:1000}});
 await context.addInitScript(lang=>localStorage.setItem('fraerapp.language',lang),language);
 const words=(ru,en)=>language==='ru'?ru:en,errors=[],writes=[],queries=[];
 let generation=1,conflict=false,roles=['author'],imported=false,holdSave=false,releaseSave;
 let document={schemaVersion:2,key:'doors',title:'Open doors',description:'A cat loves every open door.',genre:'Fantasy',type:'story',coverUrl:'/assets/door.svg',completionStatus:'in_development',items:[{target:{kind:'scenario',id:'chapter',key:'chapter'},season:'Spring'},{target:{kind:'scenario',id:'chapter2',key:'chapter2'},season:'Summer'}],transitions:[]};
 let soloDoc={key:'solo',title:'Old story',description:'A standalone story',version:1,startSceneId:'start',variables:{},assets:[],scenes:[{id:'start',title:'Start',text:'Hello',choices:[],ending:{type:'ending',title:'End'}}]};
 const detail=(id='work')=>({collectionId:id,id,key:'doors',kind:'collection',title:id==='deleted'?'Deleted story':document.title,description:document.description,coverUrl:document.coverUrl,generation,draftRevision:1,visibility:id==='deleted'?'deleted':'private',reviewState:'draft',draftDocument:document,dependencies:[{id:'chapter',title:'Chapter',reviewState:'draft'}],children:[]});
 const solo=()=>({id:'solo',storyId:'solo',kind:'scenario',key:'solo',title:soloDoc.title,generation,draftRevision:1,hasDraft:true,visibility:'private',reviewState:'draft',draftDocument:soloDoc,versions:[{versionNumber:1}],events:[]});
 await context.route('https://fraerapp.ru/**',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname,send=json=>route.fulfill({json});
  const body=req.headers()['content-type']?.includes('application/json')?req.postDataJSON():null;
  if(!['GET','HEAD'].includes(req.method()))writes.push({p,method:req.method(),body});
  if(p==='/auth/me')return send({id:'user',roles,email:'author@example.test'});
  if(p==='/api/moderation/folders')return send({items:[{...detail(),reviewState:'in_review'}],total:1});
  if(p==='/api/moderation/collections/work')return send({...detail(),reviewState:'in_review',submittedRevision:1});
  if(p==='/api/moderation/folders/work/review')return send({tree:{...detail(),children:[]},rootGeneration:generation,canDecide:true,items:[{kind:'collection',id:'work',generation,revision:1,document,approvalEligibility:{canApprove:true}}]});
  if(p==='/api/moderation/folders/work/decision')return conflict?route.fulfill({status:409,json:{message:'Changed application'}}):send({});
  if(p==='/api/author/folders'){queries.push(Object.fromEntries(url.searchParams));const trash=url.searchParams.get('visibility')==='deleted';return send({items:trash?[detail('deleted')]:[detail(),solo()],total:trash?1:2});}
  if(p==='/api/author/collections/targets')return send([{kind:'scenario',id:'chapter',key:'chapter',title:'Chapter',owned:true},{kind:'scenario',id:'chapter2',key:'chapter2',title:'Second chapter',owned:true}]);
  if(p==='/api/author/collections/work/export')return send({schemaVersion:1,kind:'fraerapp-work-package',root:{kind:'collection',key:document.key},collections:[document],scenarios:[soloDoc]});
  if(p==='/api/author/collections/work/covers')return send([{url:'/uploads/work/image.png',filename:'My cover'}]);
  if(p==='/api/author/collections/work/cover')return send({url:'/uploads/work/image.png'});
  if(p==='/api/author/collections/work'||p==='/api/author/collections/deleted'){
   if(req.method()==='PUT'){if(conflict)return route.fulfill({status:409,json:{message:'Concurrent update'}});if(holdSave)await new Promise(resolve=>releaseSave=resolve);document=body.document;generation++;}
   return send(detail(p.endsWith('deleted')?'deleted':'work'));
  }
  if(p==='/api/author/collections'&&req.method()==='POST'){document=body.document;return send(detail());}
  if(p==='/api/author/collections/import-preview')return send({canImport:true,items:[{key:'new-story',action:'create'}],generations:{}});
  if(p==='/api/author/collections/import'){imported=true;return send({});}
  if(p==='/api/author/stories')return send([solo()]);
  if(p==='/api/author/stories/solo'){
   if(req.method()==='PUT'){assert.equal(body.generation,generation);soloDoc=body.document;generation++;}return send(solo());
  }
  if(p==='/api/author/stories/solo/preview')return send({revision:1,document:soloDoc,validation:{valid:true}});
  if(p==='/api/author/stories/solo/assets'){assert.match(req.postData(),/name="scope"\r\n\r\nlocal/,'cover uploads must not mutate draft generation');return send({url:'/uploads/solo/cover.png'});}
  if(p.startsWith('/uploads/'))return route.fulfill({path:path.join(process.cwd(),'frontend/assets/stories/cat-sofa-background-v2.png')});
  if(p.startsWith('/api/')||p.startsWith('/auth/'))return send({notifications:[],unreadCount:0});
  let file=path.join(process.cwd(),p.startsWith('/builder/')?'story-builder':'frontend',p.startsWith('/builder/')?p.slice(9):p.slice(1));
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});
 });
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 const role=(kind,ru,en)=>page.getByRole(kind,{name:words(ru,en),exact:true});
 await page.goto('https://fraerapp.ru/my-stories/');
 await page.locator('.author-story-card').first().waitFor();assert.equal(await page.locator('.author-story-card').count(),2);
 await page.screenshot({path:`/tmp/author-list-${language}-${width}.png`,fullPage:true});
 await audit(page,`${language} ${width} author list`);
 assert.ok(await role('button','+ Создать историю','+ Create story').isVisible());
 await role('combobox','Состояние','Status').selectOption('unlisted');await page.waitForFunction(()=>!document.querySelector('main.collections-panel').inert);assert.equal(queries.at(-1).visibility,'unlisted');
 for(const status of ['approved','hidden']){await role('combobox','Состояние','Status').selectOption(status);await page.waitForFunction(()=>!document.querySelector('main.collections-panel').inert);assert.ok(queries.some(query=>query.status===status||query.visibility===status));}
 await role('combobox','Состояние','Status').selectOption('all');
 await page.locator('[data-work-id="work"]').click();await role('heading','Главы истории','Story chapters').waitFor();
 assert.ok(await page.locator('.author-list-screen').isHidden());assert.ok(await page.locator('.collection-editor').isVisible());
 await page.locator('.collection-item').first().getByRole('button',{name:words('↓ Ниже','↓ Down'),exact:true}).click();await page.waitForFunction(()=>document.activeElement.closest('.collection-item')?.querySelector('h4').textContent.includes('Chapter'));await role('button','Сохранить','Save').click();await page.waitForFunction(()=>!document.querySelector('main.collections-panel').inert);assert.equal(document.items[1].target.id,'chapter');assert.equal(document.items[1].season,'Spring');
 await role('tab','Главы','Chapters').focus();await page.keyboard.press('ArrowRight');assert.equal(await role('tab','Об истории','About story').getAttribute('aria-selected'),'true');
 await role('textbox','Название','Title').fill('Unsaved title');
 await page.evaluate(()=>{const anchor=document.querySelector('.collection-item a');for(const kind of ['ctrlKey','metaKey','shiftKey','altKey','target','download']){if(kind==='target')anchor.target='_blank';if(kind==='download')anchor.setAttribute('download','draft');document.addEventListener('click',event=>event.preventDefault(),{once:true});anchor.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0,[kind]:true}));anchor.removeAttribute('target');anchor.removeAttribute('download');}});
 page.once('dialog',dialog=>dialog.dismiss());await page.goBack();await page.waitForURL('**collection=work');
 assert.equal(await role('textbox','Название','Title').inputValue(),'Unsaved title');
 conflict=true;await role('button','Сохранить','Save').click();await page.getByText(/Concurrent update/).waitFor();assert.equal(await role('textbox','Название','Title').inputValue(),'Unsaved title');
 conflict=false;await role('button','Сохранить','Save').click();await page.getByText(words('Черновик сохранён. Публикация не изменилась.','Draft saved. Publication is unchanged.'),{exact:true}).waitFor();assert.equal(document.title,'Unsaved title');
 holdSave=true;await role('button','Сохранить','Save').click();await page.waitForFunction(()=>document.querySelector('main.collections-panel').inert);await page.goBack();await page.waitForURL('**collection=work');assert.ok(await page.locator('.collection-editor').isVisible());holdSave=false;releaseSave();await page.getByText(words('Черновик сохранён. Публикация не изменилась.','Draft saved. Publication is unchanged.'),{exact:true}).waitFor();
 await role('button','Выбрать обложку','Choose cover').click();await role('dialog','Обложка истории','Story cover').waitFor();
 await audit(page,`${language} ${width} cover picker`);
 await role('button','Открытая дверь','Open door').click();await role('button','Сохранить','Save').click();await page.waitForFunction(()=>!document.querySelector('main.collections-panel').inert);assert.equal(document.coverUrl,'/assets/door.svg');
 await role('button','Выбрать обложку','Choose cover').click();await role('textbox','Путь к изображению','Image path').count();
 await role('button','Закрыть','Close').click();
 await role('button','Выбрать обложку','Choose cover').click();await page.getByLabel(words('Загрузить свою обложку','Upload your cover'),{exact:true}).setInputFiles({name:'cover.png',mimeType:'image/png',buffer:Buffer.from('89504e470d0a1a0a','hex')});
 await page.locator('.author-cover-dialog').waitFor({state:'detached'});await role('button','Сохранить','Save').click();await page.waitForFunction(()=>!document.querySelector('main.collections-panel').inert);assert.equal(document.coverUrl,'/uploads/work/image.png');assert.ok(writes.some(write=>write.p==='/api/author/collections/work/cover'));assert.ok(!writes.some(write=>write.p==='/api/author/stories/import'),'cover upload must never create a fake chapter');
 await page.screenshot({path:`/tmp/author-editor-${language}-${width}.png`,fullPage:true});
 await audit(page,`${language} ${width} editor`);
 await role('button','Промпты для ИИ','AI prompts').click();await page.getByRole('dialog',{name:words('Промпты для создания истории','Story creation prompts'),exact:true}).waitFor();await page.getByLabel(words('Включить текущее содержимое в промпт','Include current content in the prompt'),{exact:true}).check();await page.getByRole('button',{name:words('Подготовить промпт','Prepare prompt'),exact:true}).click();await page.waitForFunction(()=>document.querySelector('#prompt-output').value.includes('Unsaved title'));await page.getByRole('button',{name:words('Закрыть','Close'),exact:true}).click();assert.equal(await page.evaluate(()=>document.activeElement.textContent),words('Промпты для ИИ','AI prompts'),'prompt dialog returns focus to its opener');
 await role('button','← К моим историям','← My stories').click();await page.locator('.author-list-screen').waitFor({state:'visible'});await page.waitForFunction(()=>document.activeElement.dataset.workId==='work');
 await role('button','Корзина','Trash').click();await page.getByRole('heading',{name:'Deleted story',exact:true}).waitFor();assert.equal(queries.at(-1).visibility,'deleted');
 await role('button','Просмотреть','View').click();await page.getByText(words('Только чтение. Данные сохранены; восстановить доступ может модератор.','Read only. Data is retained; a moderator can restore access.'),{exact:true}).waitFor();assert.equal(await role('button','+ Добавить главу','+ Add chapter').count(),0);assert.equal(await role('button','Сохранить','Save').count(),0);
 await role('button','← К моим историям','← My stories').click();await role('button','Истории','Stories').click();
 await role('button','Импорт истории из файла','Import story from a file').click();await role('dialog','Импорт истории из файла','Import story from a file').waitFor();
 await role('button','Закрыть','Close').click();assert.equal(await role('dialog','Импорт истории из файла','Import story from a file').count(),0);
 await role('button','Импорт истории из файла','Import story from a file').click();await role('button','Закрыть','Close').focus();await page.keyboard.press('Escape');
 await role('button','Импорт истории из файла','Import story from a file').click();await page.getByLabel(words('Импорт пакета','Import package'),{exact:true}).setInputFiles({name:'story.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":2}')});
 await role('button','Применить этот импорт','Apply this import').waitFor();assert.equal(imported,false);await role('button','Применить этот импорт','Apply this import').click();await page.locator('.author-list-screen').waitFor({state:'visible'});assert.equal(imported,true);
 await page.locator('[data-work-id="solo"]').click();await page.waitForURL('**?story=solo');await role('tab','Об истории','About story').click();assert.ok(await page.locator('.workspace-detail').isVisible());assert.ok(await page.locator('.workspace-list').isHidden());
 await role('textbox','Название','Title').fill('Same standalone ID');await role('button','Сохранить','Save').click();await page.getByText(words('Черновик сохранён. Публикация не изменилась.','Draft saved. Publication is unchanged.'),{exact:true}).waitFor();assert.equal(soloDoc.title,'Same standalone ID');assert.ok(writes.some(write=>write.p==='/api/author/stories/solo'&&write.method==='PUT'));assert.equal(await role('button','+ Добавить главу','+ Add chapter').count(),0);
 await role('button','Выбрать обложку','Choose cover').click();await role('button','Открытая дверь','Open door').click();await role('button','Сохранить','Save').click();await page.getByText(words('Черновик сохранён. Публикация не изменилась.','Draft saved. Publication is unchanged.'),{exact:true}).waitFor();assert.equal(soloDoc.metadata.coverUrl,'/assets/door.svg');assert.equal(soloDoc.scenes[0].background,undefined,'cover must not overwrite scene background');
 await role('button','Выбрать обложку','Choose cover').click();await page.getByLabel(words('Загрузить свою обложку','Upload your cover'),{exact:true}).setInputFiles({name:'cover.png',mimeType:'image/png',buffer:Buffer.from('89504e470d0a1a0a','hex')});await page.locator('.author-cover-dialog').waitFor({state:'detached'});await role('button','Сохранить','Save').click();await page.getByText(words('Черновик сохранён. Публикация не изменилась.','Draft saved. Publication is unchanged.'),{exact:true}).waitFor();assert.equal(soloDoc.metadata.coverUrl,'/uploads/solo/cover.png');assert.equal(soloDoc.scenes[0].background,undefined);
 await role('textbox','Название','Title').fill('Kept after role loss');roles=[];await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>document.querySelector('.author-metadata input').readOnly);assert.equal(await role('textbox','Название','Title').inputValue(),'Kept after role loss');await role('textbox','Название','Title').focus();assert.equal(await page.evaluate(()=>document.activeElement.value),'Kept after role loss','read-only text remains keyboard accessible for recovery');assert.ok(await role('button','Сохранить','Save').isDisabled());
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${language} ${width}: no overflow`);assert.deepEqual(errors,[]);
 await page.screenshot({path:`/tmp/author-workspace-${language}-${width}.png`,fullPage:true});
 roles=['moderator'];const moderator=await context.newPage();moderator.on('pageerror',error=>errors.push(error.message));await moderator.goto('https://fraerapp.ru/moderation/');
 await moderator.getByRole('button',{name:words('Проверить заявку','Review application'),exact:true}).click();
 const approve=moderator.getByRole('button',{name:words('Одобрить и опубликовать заявку','Approve and publish application'),exact:true});await approve.waitFor();assert.ok(await approve.isVisible());assert.ok(await approve.isDisabled());assert.ok(await moderator.locator('.author-list-screen').isHidden());
 await audit(moderator,`${language} ${width} moderation`);
 await moderator.locator('.folder-review-part>summary').click();await moderator.getByRole('checkbox',{name:words('Эту часть проверил(а)','I have reviewed this part'),exact:true}).check();assert.ok(await approve.isEnabled());
 await moderator.getByRole('textbox',{name:words('Замечания автору','Feedback to the author'),exact:true}).fill('Retained review feedback');conflict=true;moderator.once('dialog',dialog=>dialog.accept());await approve.click();await moderator.getByText(/Changed application/).waitFor();assert.equal(await moderator.getByRole('textbox',{name:words('Замечания автору','Feedback to the author'),exact:true}).inputValue(),'Retained review feedback');
 assert.ok(await moderator.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);console.log(language,width,'cards / tabs / history cancellation / conflict / upload / trash / import / legacy save / role loss / moderation');await context.close();
}
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1);});
