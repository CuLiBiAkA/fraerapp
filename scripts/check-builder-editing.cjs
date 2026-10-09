const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const chapter={key:'editing-fixture',title:'Мира у двери',version:1,startSceneId:'start',variables:{score:0},assets:[],scenes:[
 {id:'start',title:'Порог',text:'Счёт: {{ score }}',variables:{},assets:[],effects:[],choices:[{id:'open',label:'Открыть дверь',target:'end',conditions:[],effects:[{inc:'score',value:1}]}]},
 {id:'end',title:'Дом',text:'Локальный счёт: {{score}}',variables:{score:10},assets:[],effects:[],ending:{type:'good',title:'Дом'},choices:[]},
]};
(async()=>{
 const browser=await chromium.launch();
 try {
  for(const width of [1440,768,390,320])for(const lang of ['ru','en']){
   const context=await browser.newContext({viewport:{width,height:900}});
   await context.addInitScript(lang=>localStorage.setItem('fraerapp.storyBuilderLanguage',lang),lang);
   await context.route('https://fraerapp.ru/**',route=>{
    const req=route.request(),p=new URL(req.url()).pathname,send=json=>route.fulfill({json});
    if(p==='/auth/me')return send({id:'fixture-author',email:'editing@example.test',roles:['author']});
    if(p==='/api/author/home')return send({stories:[{storyId:'sample',key:chapter.key,title:chapter.title,generation:1,draftRevision:1,reviewState:'draft',visibility:'private'}]});
    if(p==='/api/author/stories/sample')return send({storyId:'sample',generation:1,draftRevision:1,draftDocument:chapter});
    if(p==='/api/author/collections/parents')return send([]);
    if(p.startsWith('/auth/')||p.startsWith('/api/'))return send({notifications:[],unreadCount:0});
    let file=path.join(process.cwd(),p.startsWith('/builder/')?'story-builder':'frontend',p.startsWith('/builder/')?p.slice(9):p.slice(1));
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    return route.fulfill({path:file});
   });
   const page=await context.newPage(),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(error.message));
   await page.goto('https://fraerapp.ru/builder/?story=sample');
   await page.locator('[data-meta="title"]').filter({visible:true}).waitFor();
   await page.waitForFunction(()=>document.querySelector('[data-meta="title"]').value==='Мира у двери');
   assert.equal(await page.locator('summary button, summary a[href], summary input').count(),0,'Disclosure controls cannot contain other interactive controls');
   const firstFolder=page.locator('#scene-outline .has-outline-moves').first();
   const disclosure=firstFolder.locator(':scope > details > summary');
   await disclosure.focus();await page.keyboard.press('Enter');
   assert.equal(await firstFolder.locator(':scope > details').evaluate(node=>node.open),false);
   const jump=firstFolder.locator(':scope > .outline-folder-tools .outline-link');
   await jump.focus();await page.keyboard.press('Enter');
   assert.equal(await firstFolder.locator(':scope > details').evaluate(node=>node.open),true);
   await firstFolder.getByRole('button',{name:lang==='ru'?'Ниже':'Down',exact:true}).focus();await page.keyboard.press('Enter');
   assert.match(await page.locator('#scene-outline .has-outline-moves').first().locator(':scope > .outline-folder-tools .outline-link').innerText(),/Дом/);
   await page.locator('#scene-outline .has-outline-moves').nth(1).getByRole('button',{name:lang==='ru'?'Выше':'Up',exact:true}).focus();await page.keyboard.press('Enter');
   assert.match(await page.locator('#scene-outline .has-outline-moves').first().locator(':scope > .outline-folder-tools .outline-link').innerText(),/Порог/);
   const preview=page.locator('#preview-chapter');await preview.click();
   await page.getByText('Открыть дверь → end',{exact:true}).waitFor();
   assert.equal(await page.locator('#chapter-preview-content').getByText(/undefined/).count(),0);
   await page.keyboard.press('Escape');assert.ok(await preview.evaluate(node=>node===document.activeElement));
   const textName=lang==='ru'?'Текст':'Text';
   assert.equal(await page.getByRole('textbox',{name:textName,exact:true}).count(),2);
   const firstText=page.getByRole('textbox',{name:textName,exact:true}).first();
   await page.locator('#variables').getByLabel(lang==='ru'?'Имя':'Name',{exact:true}).fill('trust');
   assert.equal(await firstText.inputValue(),'Счёт: {{ trust }}');
   assert.equal(await page.getByRole('textbox',{name:textName,exact:true}).nth(1).inputValue(),'Локальный счёт: {{score}}');
   await firstText.fill((await firstText.inputValue())+'!');
   await page.locator('#paste-json').click();
   const dialog=page.getByRole('dialog',{name:lang==='ru'?'Вставить JSON истории':'Paste Story JSON',exact:true});
   await dialog.waitFor();
   const jsonArea=dialog.getByRole('textbox',{name:lang==='ru'?'Вставить JSON истории':'Paste Story JSON',exact:true});
   const exported=JSON.parse(await jsonArea.inputValue());
   assert.equal(exported.scenes[0].text,'Счёт: {{ trust }}!');assert.equal(exported.scenes[0].choices[0].effects[0].inc,'trust');
   assert.equal(exported.scenes[1].variables.score,10);
   await page.keyboard.press('Escape');assert.ok(await page.locator('#paste-json').evaluate(node=>node===document.activeElement));
   assert.equal(await page.getByRole('tablist').getAttribute('aria-label'),lang==='ru'?'Работа с главой':'Chapter workspace');
   // Real Storage failure: editing must keep working and expose a recoverable warning.
   await page.evaluate(()=>{
    window.restoreBuilderStorage=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(key==='fraerapp.storyBuilderDraft')throw new DOMException('Full','QuotaExceededError');return window.restoreBuilderStorage.call(this,key,value);};
   });
   const title=page.locator('[data-meta="title"]');await title.fill('Несохранённое изменение');
   const warning=page.locator('#local-draft-warning');await warning.waitFor({state:'visible'});
   assert.match(await warning.innerText(),lang==='ru'?/Скачайте JSON/:/Download JSON/);
   assert.equal(await title.inputValue(),'Несохранённое изменение');
   await page.locator('#paste-json').click();assert.equal(JSON.parse(await page.locator('#paste-area').inputValue()).title,'Несохранённое изменение');await page.keyboard.press('Escape');
   await page.evaluate(()=>{Storage.prototype.setItem=window.restoreBuilderStorage;delete window.restoreBuilderStorage;});
   await title.fill('Восстановлено');await warning.waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('fraerapp.storyBuilderDraft')).title),'Восстановлено');
   assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.goto('https://fraerapp.ru/builder/board.html');
   await page.locator('.card-link').first().waitFor();
   assert.equal(await page.getByRole('textbox',{name:lang==='ru'?'Название раскладки':'Layout name',exact:true}).count(),1);
   assert.equal(await page.getByRole('combobox',{name:lang==='ru'?'Сохранённая раскладка':'Saved layout',exact:true}).count(),1);
   assert.equal(await page.getByRole('button',{name:lang==='ru'?'Увеличить масштаб':'Zoom in',exact:true}).count(),1);
   assert.ok(await page.locator('.card-link,.choice-label').evaluateAll(nodes=>nodes.every(node=>new URL(node.href).pathname==='/builder/index.html')));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   // Board changes must survive failed draft, canvas and named-layout writes in this tab.
   await page.evaluate(()=>{
    window.restoreBoardStorage=Storage.prototype.setItem;
    window.blockedBoardKeys=new Set(['fraerapp.storyBuilderDraft','fraerapp.storyBuilderBoardState','fraerapp.storyBuilderBoardLayouts']);
    Storage.prototype.setItem=function(key,value){if(window.blockedBoardKeys.has(key))throw new DOMException('Full','QuotaExceededError');return window.restoreBoardStorage.call(this,key,value);};
   });
   await page.locator('#add-scene').click();
   const boardWarning=page.locator('#board-storage-warning');await boardWarning.waitFor({state:'visible'});
   assert.equal(await page.locator('.board-card[data-kind="scene"]').count(),3);
   assert.match(await boardWarning.innerText(),lang==='ru'?/открытой вкладке/:/this tab/);
   await page.locator('#add-note').click();await page.locator('.note-editor').fill('Заметка, которую нельзя потерять');
   await page.locator('#layout-name').fill('У двери');await page.locator('#save-layout').click();
   assert.equal(await page.locator('#layout-select').inputValue(),'У двери');
   assert.notEqual(await page.locator('#line-hint').innerText(),lang==='ru'?'Раскладка сохранена':'Layout saved');
   const boardUrl=page.url();await page.locator('#open-builder').click();assert.equal(page.url(),boardUrl);
   assert.ok(await boardWarning.isVisible());assert.equal(await page.locator('.note-editor').inputValue(),'Заметка, которую нельзя потерять');
   const addSceneFile=page.locator('.board-card[data-kind="scene"]').first().getByRole('button',{name:lang==='ru'?'+ файл':'+ file',exact:true});
   await addSceneFile.focus();await page.keyboard.press('Enter');assert.equal(page.url(),boardUrl);
   assert.ok(await boardWarning.isVisible());
   // A successful canvas write alone must not clear warnings about unsaved story/layout data.
   await page.evaluate(()=>window.blockedBoardKeys.delete('fraerapp.storyBuilderBoardState'));
   await page.locator('#zoom-in').click();assert.ok(await boardWarning.isVisible());
   const retry=page.getByRole('button',{name:lang==='ru'?'Повторить сохранение':'Retry saving',exact:true});
   await retry.click();assert.ok(await boardWarning.isVisible());
   await page.evaluate(()=>{Storage.prototype.setItem=window.restoreBoardStorage;delete window.restoreBoardStorage;delete window.blockedBoardKeys;});
   await retry.click();await boardWarning.waitFor({state:'hidden'});
   const recovered=await page.evaluate(()=>({
    draft:JSON.parse(localStorage.getItem('fraerapp.storyBuilderDraft')),
    board:JSON.parse(localStorage.getItem('fraerapp.storyBuilderBoardState')),
    layouts:JSON.parse(localStorage.getItem('fraerapp.storyBuilderBoardLayouts')),
   }));
   assert.equal(recovered.draft.scenes.length,3);assert.equal(recovered.draft.scenes[0].assets.length,1);
   assert.equal(recovered.board.notes[0].text,'Заметка, которую нельзя потерять');
   assert.equal(recovered.layouts['У двери'].notes[0].text,'Заметка, которую нельзя потерять');
   const sceneLink=page.locator('.board-card[data-kind="scene"] .card-link').first();
   await sceneLink.focus();await page.keyboard.press('Enter');await page.waitForURL('**/builder/index.html#scene:start');
   await page.getByRole('textbox',{name:textName,exact:true}).first().waitFor();assert.deepEqual(errors,[]);
   assert.equal(await page.getByRole('textbox',{name:textName,exact:true}).count(),3);
   // An unavailable Storage getter must not prevent the board from opening or retaining new notes.
   await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('fraerapp.storyBuilder')).forEach(key=>localStorage.removeItem(key)));
   await page.addInitScript(()=>{
    if(!location.pathname.endsWith('/board.html'))return;
    window.privateBoardGet=Storage.prototype.getItem;window.privateBoardSet=Storage.prototype.setItem;
    Storage.prototype.getItem=function(key){if(key.startsWith('fraerapp.storyBuilder'))throw new DOMException('Blocked','SecurityError');return window.privateBoardGet.call(this,key);};
    Storage.prototype.setItem=function(key,value){if(key.startsWith('fraerapp.storyBuilder'))throw new DOMException('Blocked','SecurityError');return window.privateBoardSet.call(this,key,value);};
   });
   await page.goto('https://fraerapp.ru/builder/board.html');await page.locator('#board-storage-warning').waitFor({state:'visible'});
   await page.locator('#add-note').click();await page.locator('.note-editor').fill('Заметка без доступа к хранилищу');assert.deepEqual(errors,[]);
   await page.evaluate(()=>{Storage.prototype.getItem=window.privateBoardGet;Storage.prototype.setItem=window.privateBoardSet;});
   await page.locator('#retry-saving').click();await page.locator('#board-storage-warning').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('fraerapp.storyBuilderBoardState')).notes[0].text),'Заметка без доступа к хранилищу');
   assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   console.log(width,lang,'preview labels, accessible fields/dialog, keyboard focus, scoped rename, editor/board storage failure/recovery, no overflow');
   await context.close();
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
