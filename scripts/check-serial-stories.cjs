const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch();
for(const width of [1440,768,390,320]){
 const context=await browser.newContext({viewport:{width,height:900}});let work=null,chapter=null,chapterReview='draft';const mutations=[];
 const summary=()=>({id:'work',collectionId:'work',key:'city',title:work.title,kind:'collection',type:'story',generation:1,draftRevision:1,visibility:'private',reviewState:'draft',draftDocument:work,children:chapter?[{id:'chapter',kind:'scenario',title:chapter.title,reviewState:'draft'}]:[]});
 await context.route('https://fraerapp.ru/**',async route=>{
  const req=route.request(),p=new URL(req.url()).pathname,body=req.postDataJSON();
  const send=json=>route.fulfill({json});
  if(req.method()!=='GET')mutations.push({p,body});
  if(p==='/auth/me')return send({email:'author@example.test',roles:['author']});
  if(p==='/auth/refresh')return send({user:{email:'author@example.test',roles:['author']}});
  if(p==='/api/account')return send({unreadCount:0,notifications:[]});
  if(p==='/api/author/folders')return send({items:work?[summary()]:[],total:work?1:0});
  if(p==='/api/author/collections/targets')return send(chapter?[{id:'chapter',key:chapter.key,kind:'scenario',type:'scenario',title:chapter.title,owned:true,reviewState:'draft'}]:[]);
  if(p==='/api/author/collections/parents')return send(work?[summary()]:[]);
  if(p==='/api/author/collections'&&req.method()==='POST'){work=body.document;return send(summary());}
  if(p==='/api/author/collections/work'){if(req.method()==='PUT')work=body.document;return send({...summary(),dependencies:chapter?[{id:'chapter',reviewState:chapterReview}]:[]});}
  if(p==='/api/author/stories/import'){chapter=body;return send({storyId:'chapter',key:chapter.key,draftRevision:1});}
  if(p==='/api/author/stories/chapter')return send({storyId:'chapter',generation:1,draftRevision:1,draftDocument:chapter});
  if(p==='/api/author/collections/work/chapters/review'){chapterReview='in_review';return send({items:[],atomic:true});}
  if(p==='/api/catalog/collections/city')return send({...summary(),schemaVersion:2,completionStatus:'in_development',items:[{id:'chapter',title:'Глава 1',kind:'scenario',season:'Сезон 1',allowIndependentStart:true}]});
  if(p==='/api/collections/work/runs')return send([{id:'reading'}]);
  if(p==='/api/collection-runs/reading')return send({id:'reading',completionStatus:'in_development',items:[{id:'chapter',title:'Глава 1',season:'Сезон 1',status:'finished',sessionId:'save'}]});
  if(p==='/api/author/home')return send({stories:chapter?[{storyId:'chapter',key:chapter.key,title:chapter.title,draftRevision:1,reviewState:'draft',visibility:'private'}]:[]});
  if(p.startsWith('/api/')||p.startsWith('/auth/'))return send([]);
  let f=path.join(process.cwd(),p.startsWith('/builder/')?'story-builder':'frontend',p.startsWith('/builder/')?p.slice(9):p.slice(1));
  if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');
  if(!fs.existsSync(f))f=path.join(process.cwd(),'frontend/index.html');return route.fulfill({path:f});
 });
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('https://fraerapp.ru/');await p.locator('#home-create').click();
 await p.waitForURL('**/my-stories/');await p.getByRole('button',{name:'+ Создать историю',exact:true}).click();
 await p.getByLabel('Название',{exact:true}).fill('Тайны города');
 await p.getByLabel('Описание',{exact:true}).fill('История, которая выходит по главам.');
 await p.getByRole('button',{name:'+ Добавить главу',exact:true}).click();
 await p.waitForURL('**/builder/?story=chapter&work=work');
 await p.getByRole('heading',{name:'Конструктор главы',exact:true}).waitFor();
 assert.equal(work.schemaVersion,2);assert.equal(work.items.length,1);assert.equal(work.items[0].target.id,'chapter');assert.equal(chapter.title,'Глава 1');
 assert.equal(await p.locator('#relations-editor').isVisible(),false);
 assert.equal(await p.locator('.topbar a[href*="my-stories"]').count(),0);
 assert.equal(await p.locator('.builder-home').getAttribute('href'),'/my-stories/?collection=work');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'chapter navigation fits the viewport');
 await p.locator('[data-meta="title"]').fill('Новая глава');await p.locator('[data-meta="title"]').blur();
 p.once('dialog',dialog=>dialog.dismiss());
 await p.getByRole('link',{name:'К главам истории',exact:true}).click();
 assert.ok(p.url().includes('/builder/'),'cancel preserves unsaved chapter edits');
 assert.equal(await p.locator('[data-meta="title"]').inputValue(),'Новая глава');
 await p.locator('#import-runtime').click();await p.waitForFunction(()=>document.querySelector('#server-draft-state').textContent.includes('сервер'));
 await p.getByRole('link',{name:'К главам истории',exact:true}).click();
 await p.getByRole('heading',{name:'Главы истории',exact:true}).waitFor();
 assert.equal(await p.getByRole('button',{name:/Добавить в папку|Создать папку/}).count(),0);
 await p.getByLabel('Сезон (необязательно)',{exact:true}).fill('Сезон 1');
 await p.getByRole('button',{name:'Сохранить',exact:true}).click();
 await p.getByText('Черновик сохранён. Публикация не изменилась.',{exact:true}).waitFor();
 assert.equal(work.items[0].season,'Сезон 1');
 await p.getByRole('button',{name:'Отправить главу на проверку',exact:true}).click();
 await p.getByText('Глава отправлена на проверку. Остальные черновики сохранены.',{exact:true}).waitFor();
 assert.ok(mutations.some(m=>m.p==='/api/author/collections/work/chapters/review'&&m.body.storyId==='chapter'));
 assert.match(await p.locator('.collection-item small').first().innerText(),/На согласовании/);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log(width+': create story → add chapter → builder → chapter list → season saved');
 if(width===1440)await p.screenshot({path:'/tmp/serial-author.png',fullPage:true});
 await p.goto('https://fraerapp.ru/collections/city');await p.getByText('Вы прочитали все вышедшие главы. Продолжение готовится.',{exact:true}).waitFor();
 assert.equal(await p.locator('#collection-screen').getByText('Глава 1',{exact:true}).count(),1,'one chapter list after starting a run');
 assert.doesNotMatch(await p.locator('#collection-screen select').textContent(),/reading/,'run IDs are not reader-facing labels');
 assert.equal(await p.getByRole('button',{name:'Начать сначала',exact:true}).count(),1);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log(width+': reader sees one story, season, restart and awaiting release');await context.close();
}await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
