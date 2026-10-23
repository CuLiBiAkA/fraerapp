const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch();try{for(const width of [320,390,768,1440]){
 const c=await browser.newContext({viewport:{width,height:1000}}),writes=[],errors=[];let conflict=true;
 const doc={title:'Тайны города',description:'История о городе и его тайнах',genre:'Драма',coverUrl:'/assets/stories/cat-sofa-background-v2.png'},chapter={title:'Закрытая дверь',description:'Описание главы',scenes:[]};
 const tree={id:'work',kind:'collection',title:doc.title,document:doc,children:[{id:'one',kind:'scenario',title:chapter.title}]};
 await c.route('https://fraerapp.ru/**',r=>{const u=new URL(r.request().url()),p=u.pathname,send=json=>r.fulfill({json});
  if(p==='/auth/me')return send({id:'reviewer',roles:['moderator']});
  if(p==='/api/moderation/folders')return send({items:[{...tree,authorName:'Лисса',hasRepeatReview:true}],total:1,counts:{waiting:1,repeat:1}});
  if(p==='/api/moderation/collections/work')return send({collectionId:'work',draftDocument:doc,events:[]});
  if(p==='/api/moderation/stories/one')return send({title:chapter.title,submittedDocument:chapter,submittedRevision:2,generation:3,reviewState:'in_review',visibility:'private',ownerUserId:'author',events:[{action:'reject',reason:'Добавьте предупреждение о пугающей сцене.',revision:1,createdAt:'2026-10-22T12:00:00Z'}]});
  if(p==='/api/moderation/stories/one/approve'){writes.push(r.request().postDataJSON());return send({});}
  if(p==='/api/moderation/stories/one/preview')return send({document:{...chapter,title:'Старая дверь'}});
  if(p==='/api/moderation/folders/work/review')return send({tree,rootGeneration:4,canDecide:true,items:[{id:'one',kind:'scenario',generation:3,revision:2,document:chapter,approvalEligibility:{canApprove:true}}]});
  if(p==='/api/moderation/folders/work/decision'){writes.push(r.request().postDataJSON());return conflict?r.fulfill({status:409,json:{message:'Changed application'}}):send({});}
  if(p==='/'&&u.searchParams.has('previewStory')){assert.equal(u.searchParams.get('revision'),'2');return r.fulfill({contentType:'text/html',body:'<button onclick="parent.postMessage({type:\'fraer-review-close\'},location.origin)">К заявке</button>'});}
  if(p.startsWith('/api/')||p.startsWith('/auth/'))return send({});
  let f=path.join(process.cwd(),p.startsWith('/builder/')?'story-builder':'frontend',p.startsWith('/builder/')?p.slice(9):p.slice(1));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');return r.fulfill({path:f});
 });
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('https://fraerapp.ru/moderation/');await p.getByRole('button',{name:'Открыть заявку',exact:true}).click();await p.getByText('Добавьте предупреждение о пугающей сцене.',{exact:true}).waitFor();await p.evaluate(()=>document.fonts.ready);
 const approve=p.getByRole('button',{name:'Одобрить заявку',exact:true}),reason=p.getByRole('textbox',{name:'Замечания автору',exact:true});assert.ok(await approve.isDisabled());
 await p.getByRole('button',{name:'Вернуть на доработку',exact:true}).click();await p.getByText('Напишите причину решения.',{exact:true}).waitFor();assert.equal(writes.length,0);
 await reason.fill('Сохранённый комментарий');await p.getByRole('button',{name:'Об истории',exact:true}).click();await p.getByRole('dialog').getByText(doc.description,{exact:true}).waitFor();await p.keyboard.press('Escape');
 await p.getByRole('button',{name:'История решений',exact:true}).click();await p.getByRole('dialog').getByText('Возвращено на доработку',{exact:true}).waitFor();await p.keyboard.press('Escape');
 await p.getByRole('button',{name:'Изменения',exact:true}).click();await p.getByRole('dialog').getByText(/Старая дверь/).first().waitFor();await p.keyboard.press('Escape');
 await p.getByRole('button',{name:'Прочитать главу',exact:true}).click();await p.frameLocator('.review-reader-dialog iframe').getByRole('button',{name:'К заявке'}).click();await p.getByRole('dialog').waitFor({state:'detached'});assert.equal(await reason.inputValue(),'Сохранённый комментарий');
 await p.getByRole('checkbox',{name:'Глава проверена',exact:true}).check();assert.ok(await approve.isEnabled());assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.screenshot({path:`/tmp/review-screen-${width}.png`,fullPage:true});await approve.click();await p.getByRole('button',{name:'Подтвердить',exact:true}).click();await p.getByText(/Changed application/).waitFor();assert.equal(await reason.inputValue(),'Сохранённый комментарий');assert.equal(writes[0].items[0].revision,2);
 conflict=false;await approve.click();await p.getByRole('button',{name:'Подтвердить',exact:true}).click();await p.getByRole('heading',{name:'Модерация',exact:true}).waitFor();
 await p.goto('https://fraerapp.ru/moderation/?collection=one&kind=scenario');await p.getByRole('checkbox',{name:'Глава проверена',exact:true}).check();await approve.click();await p.getByRole('button',{name:'Подтвердить',exact:true}).click();await p.getByRole('heading',{name:'Модерация',exact:true}).waitFor();assert.equal(writes.at(-1).revision,2);assert.equal(writes.at(-1).generation,3);
 assert.deepEqual(errors,[]);console.log(width,'dialogs, immutable reading, return, feedback preservation, stale decision and grouped/standalone approval');await c.close();
 }}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
