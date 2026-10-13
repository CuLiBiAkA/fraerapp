// Isolated chapter-state/notification/device-preview checks; no live writes.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch();try{
for(const width of [320,390,768,1440]){
 const context=await browser.newContext({viewport:{width,height:1000}}),errors=[],writes=[];
 const chapters=['published','in_review','rejected','approved','draft'].map((state,i)=>({id:'c'+i,storyId:'c'+i,kind:'scenario',title:['Каждая щёлочка — обещание','Записка','Закрытая дверь','Встреча','Развязка'][i],generation:2,draftRevision:1,submittedRevision:state==='draft'?null:1,publishedRevision:state==='published'?1:null,visibility:state==='published'?'public':'private',reviewState:state==='published'?'approved':state,reason:state==='rejected'?'Добавьте предупреждение о пугающей сцене.':'',events:state==='rejected'?[{action:'reject',reason:'Добавьте предупреждение о пугающей сцене.',createdAt:'2026-10-12T12:00:00Z'}]:[],draftDocument:{title:['Каждая щёлочка — обещание','Записка','Закрытая дверь','Встреча','Развязка'][i]}}));
 const document={schemaVersion:2,key:'city',type:'story',title:'Тайны города',description:'В городе исчезают люди, а прошлое оставляет подсказки.',coverUrl:'/assets/door.svg',items:chapters.map(c=>({target:{kind:'scenario',id:c.id,key:c.id}})),transitions:[]};
 const story={id:'city',collectionId:'city',kind:'collection',...document,generation:1,draftRevision:1,reviewState:'draft',draftDocument:document,children:chapters};
 let unread=true;
 await context.route('https://fraerapp.ru/**',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname,send=json=>route.fulfill({json});if(req.method()!=='GET')writes.push(p);
  if(p==='/auth/me')return send({id:'author',roles:['author'],email:'author@example.test'});
  if(p==='/api/account')return send({notifications:[{id:'notice',kind:'moderation',storyId:'c2',unread}],unreadCount:unread?1:0});
  if(p==='/api/account/notifications/notice/read'){unread=false;return send({});}
  if(p==='/api/author/folders')return send({items:[story,{...story,id:'cat',collectionId:'cat',title:'Как погладить кота и никого не убить'}],total:2});
  if(p==='/api/author/collections/targets')return send(chapters);
  if(p==='/api/author/collections/city')return send(story);
  if(p.startsWith('/api/author/stories/'))return send(chapters.find(c=>c.id===p.split('/').pop())||{});
  if(p==='/'&&u.searchParams.has('previewStory'))return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Private reader fixture</title>'});
  if(p.startsWith('/api/')||p.startsWith('/auth/'))return send({});
  let file=path.join(process.cwd(),p.startsWith('/builder/')?'story-builder':'frontend',p.startsWith('/builder/')?p.slice(9):p.slice(1));if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:''});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://fraerapp.ru/my-stories/');
 await page.locator('[data-work-id=city]').click();const rows=page.locator('.collection-item');await rows.last().waitFor();assert.equal(await rows.count(),5);
 assert.equal(await page.locator('.accordion-story .collection-editor').count(),1);
 assert.equal(await page.getByRole('tab',{name:'Главы',exact:true}).count(),0);
 assert.equal(await rows.first().getByRole('button',{name:'Предпросмотр',exact:true}).count(),0);
 assert.equal(await rows.first().getByRole('button',{name:'Читать',exact:true}).count(),1);
 assert.equal(await page.locator('.chapter-settings').count(),0);
 await page.getByRole('button',{name:'Об истории',exact:true}).click();
 const about=page.getByRole('dialog',{name:'Об истории',exact:true});await about.waitFor();
 assert.equal(await about.getByLabel('Описание',{exact:true}).inputValue(),document.description);
 await about.getByRole('button',{name:'Закрыть',exact:true}).click();
 assert.equal(await page.locator('[data-work-id=cat]').isVisible(),true);
 assert.equal(await rows.nth(1).getByRole('link',{name:'Редактировать',exact:true}).count(),0);
 assert.equal(await rows.nth(1).locator('.chapter-buttons').getByRole('button').count(),1);
 assert.equal(await rows.nth(2).getByRole('button',{name:'Опубликовать',exact:true}).count(),0);
 assert.ok(await rows.nth(2).getByRole('button',{name:'Отправить повторно',exact:true}).isVisible());
 assert.ok(await rows.nth(3).getByRole('button',{name:'Опубликовать',exact:true}).isVisible());
 assert.ok(await rows.nth(4).getByRole('button',{name:'На модерацию',exact:true}).isVisible());
 assert.ok(await rows.nth(2).getByText('Добавьте предупреждение о пугающей сцене.',{exact:true}).isVisible());
 assert.deepEqual(writes,[],'opening must not mark feedback read');
 const advanced=page.locator('.collection-editor > details').filter({has:page.locator('label')});
 await advanced.locator(':scope > summary').click();
 const keyBox=await advanced.locator(':scope > label').boundingBox(),exportBox=await advanced.getByRole('button',{name:'Экспорт истории',exact:true}).boundingBox();
 assert.ok(exportBox.y-keyBox.y-keyBox.height>=15,'Key and utility buttons have a separate 16px gap');
 await advanced.locator(':scope > summary').click();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:`/tmp/accordion-chapters-${width}.png`,fullPage:true});
 await rows.nth(2).getByRole('button',{name:'Отметить просмотренным'}).click();await page.waitForFunction(()=>!document.querySelector('main.collections-panel').inert);
 assert.equal(await page.locator('.story-unread').count(),0);assert.deepEqual(writes,['/api/account/notifications/notice/read']);
 await rows.first().getByRole('button',{name:'Читать',exact:true}).click();await page.waitForURL('**/history/c0');await page.goBack();await rows.last().waitFor();
 if(width===1440)assert.ok(await rows.first().locator('h4').evaluate(node=>node.getBoundingClientRect().height<=parseFloat(getComputedStyle(node).lineHeight)+1),'Desktop chapter title fits one line');
 await rows.nth(4).getByRole('button',{name:'Предпросмотр',exact:true}).click();await page.waitForURL('**/author-preview.html?**');
 const frame=page.locator('iframe');await frame.waitFor();assert.match(await frame.getAttribute('src'),/previewStory=c4&revision=1/);
 await page.locator('#device').selectOption('390px');const box=await frame.boundingBox();assert.ok(box.width<=390&&box.width<=width);
 assert.deepEqual(errors,[]);console.log(width,'chapter states / inline expansion / comments / explicit notification read / device preview');await context.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
