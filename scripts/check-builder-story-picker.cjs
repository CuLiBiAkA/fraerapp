const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch();try{for(const width of [390,1440]){
 const c=await browser.newContext({viewport:{width,height:1100}}),writes=[],errors=[];
 const doc={key:'draft',title:'Незваный гость',version:1,startSceneId:'start',variables:{trust:2},assets:[],scenes:[{id:'start',title:'Начало',text:'Текст главы',effects:[],choices:[],ending:{type:'good',title:'Конец'}}]};
 const chapters={draft:{storyId:'draft',generation:2,draftRevision:1,reviewState:'rejected',visibility:'private',reason:'Добавьте предупреждение о пугающей сцене.',draftDocument:doc},pub:{storyId:'pub',generation:1,draftRevision:1,publishedRevision:1,reviewState:'approved',canEditDraft:false,visibility:'public',draftDocument:{...doc,title:'Опубликованная'},publishedDocument:{...doc,title:'Опубликованная'}}};
 const work={collectionId:'work',title:'Мира и искусство открытых дверей',generation:3,draftDocument:{schemaVersion:2,key:'work',type:'story',title:'Мира и искусство открытых дверей',completionStatus:'in_development',items:[{target:{kind:'scenario',id:'pub',key:'pub'}},{target:{kind:'scenario',id:'draft',key:'draft'}}],transitions:[]}};
 let unread=true;
 await c.addInitScript(()=>{localStorage.setItem('fraerapp.language','ru');localStorage.setItem('fraerapp.storyBuilderLanguage','ru');});
 await c.route('https://fraerapp.ru/**',r=>{const req=r.request(),u=new URL(req.url()),p=u.pathname,send=json=>r.fulfill({json});
  if(!['GET','HEAD'].includes(req.method()))writes.push({p,body:req.postData()?JSON.parse(req.postData()):null});
  if(p==='/auth/me')return send({id:'author',roles:['author']});
  if(p==='/api/author/home')return send({stories:Object.values(chapters)});
  if(p==='/api/account')return send({notifications:[{id:'note',kind:'moderation',storyId:'draft',unread}]});
  if(p==='/api/account/notifications/note/read'){unread=false;return send({});}
  if(p==='/api/author/folders')return send({items:[{kind:'collection',id:'work',title:work.title,completionStatus:'in_development'},{kind:'scenario',id:'draft',title:'Самостоятельная история',completionStatus:'in_development'},{kind:'collection',id:'finished',title:'Законченная история',completionStatus:'completed'}],total:3});
  if(p==='/api/author/collections/parents')return send([{collectionId:'work'}]);
  if(p==='/api/author/collections/work'){if(req.method()==='PUT'){const b=req.postDataJSON();assert.equal(b.generation,3);work.draftDocument=b.document;}return send(work);}
  if(p==='/api/author/stories/import'){const d=req.postDataJSON();assert.equal(d.variables.trust,2);chapters.new={storyId:'new',generation:1,draftRevision:1,reviewState:'draft',draftDocument:d};return send(chapters.new);}
  if(p.startsWith('/api/author/stories/')){const id=p.split('/').pop();if(req.method()==='PUT'){chapters[id].draftDocument=req.postDataJSON().document;}return send(chapters[id]);}
  if(p.startsWith('/api/')||p.startsWith('/auth/'))return send({});
  let file=path.join(process.cwd(),p.startsWith('/builder/')?'story-builder':'frontend',p.startsWith('/builder/')?p.slice(9):p.slice(1));if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');return fs.existsSync(file)?r.fulfill({path:file}):r.fulfill({status:404,body:''});
 });
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('https://fraerapp.ru/builder/?story=draft');
 await p.waitForFunction(()=>document.querySelector('#builder-chapter-select')?.value==='draft');
 assert.equal(await p.locator('#builder-story-select option[value="finished"]').count(),0);
 assert.equal(await p.locator('#builder-story-select option[value="draft"]').count(),1);
 await p.locator('#builder-story-select').selectOption('draft');await p.waitForFunction(()=>document.querySelector('#builder-chapter-select')?.options.length===2);assert.ok(await p.locator('#builder-add-chapter').isDisabled());
 await p.locator('#builder-story-select').selectOption('work');await p.waitForFunction(()=>document.querySelector('#builder-chapter-select')?.options.length===3);
 await p.locator('#chapter-review-feedback summary').click();await p.waitForFunction(()=>document.querySelector('.feedback-unread').hidden);assert.equal(unread,false);assert.match(await p.locator('#chapter-review-comment').innerText(),/предупреждение/);
 await p.screenshot({path:`/tmp/builder-story-picker-${width}.png`,fullPage:false});
 await p.locator('[data-meta="title"]').fill('Несохранённое название');
 await p.locator('#builder-chapter-select').selectOption('pub');await p.getByRole('button',{name:'Открыть для просмотра',exact:true}).click();await p.getByRole('button',{name:'Остаться',exact:true}).click();assert.equal(await p.locator('[data-meta="title"]').inputValue(),'Несохранённое название');
 await p.locator('#builder-chapter-select').selectOption('pub');await p.getByRole('button',{name:'Открыть для просмотра',exact:true}).click();await p.getByRole('button',{name:'Перейти без сохранения',exact:true}).click();
 await p.waitForFunction(()=>document.querySelector('#chapter-status')?.textContent==='Опубликована · Только просмотр');assert.ok(await p.locator('[data-meta="title"]').isDisabled());await p.waitForFunction(()=>!document.querySelector('#builder-chapter-select').disabled,{},{timeout:5000}).catch(async e=>{console.log(await p.locator('#builder-story-picker').innerText(),await p.locator('#api-result').innerText(),errors);throw e;});
 await p.locator('#builder-chapter-select').selectOption('draft');await p.waitForFunction(()=>document.querySelector('[data-meta="title"]')?.value==='Незваный гость');assert.ok(await p.locator('[data-meta="title"]').isEnabled());
 await p.locator('[data-meta="title"]').fill('Сохранённое название');
 await p.locator('#builder-chapter-select').selectOption('pub');await p.getByRole('button',{name:'Открыть для просмотра',exact:true}).click();await p.getByRole('button',{name:'Сохранить и перейти',exact:true}).click();
 await p.waitForFunction(()=>document.querySelector('#chapter-status')?.textContent==='Опубликована · Только просмотр');await p.waitForFunction(()=>!document.querySelector('#builder-chapter-select').disabled);assert.equal(chapters.draft.draftDocument.title,'Сохранённое название');
 await p.locator('#builder-chapter-select').selectOption('draft');await p.waitForFunction(()=>document.querySelector('[data-meta="title"]')?.value==='Сохранённое название');
 await p.locator('#builder-add-chapter').click();await p.getByRole('textbox',{name:'Название главы',exact:true}).fill('Новая глава');await p.locator('dialog[open]').getByRole('button',{name:'Добавить главу',exact:true}).click();
 await p.waitForFunction(()=>document.querySelector('[data-meta="title"]')?.value==='Новая глава');assert.ok(work.draftDocument.items.some(i=>i.target.id==='new'));assert.equal(writes.filter(w=>w.p==='/api/author/stories/import').length,1);assert.deepEqual(errors,[]);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log(width,'unfinished stories, feedback read receipt, unsaved cancel, published lock, draft switch and chapter creation');await c.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
