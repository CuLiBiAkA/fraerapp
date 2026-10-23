const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch();try{for(const width of [320,390,768,1440]){
 const context=await browser.newContext({viewport:{width,height:1024}}),queries=[],errors=[];
 const items=[{id:'repeat',kind:'collection',title:'Тайны города',authorName:'Лисса',coverUrl:'/assets/stories/cat-sofa-background-v2.png',hasRepeatReview:true,submittedAt:'2026-10-23T09:40:00Z',children:[{kind:'scenario',publishedRevision:1},{kind:'scenario',publishedRevision:1},{kind:'scenario',awaitingReview:true,repeatReview:true},{kind:'scenario',awaitingReview:true}]},{id:'new',kind:'collection',title:'Лунный свет',authorName:'Алиса',coverUrl:'/assets/stories/cat-sofa-background-v2.png',submittedAt:'2026-10-23T10:40:00Z',children:[{kind:'scenario',awaitingReview:true},{kind:'scenario',awaitingReview:true}]}];
 await context.route('https://fraerapp.ru/**',r=>{const url=new URL(r.request().url()),p=url.pathname;
  if(p==='/auth/me')return r.fulfill({json:{id:'test',roles:['moderator']}});
  if(p==='/api/moderation/folders'){queries.push(Object.fromEntries(url.searchParams));const found=url.searchParams.get('q')==='empty'?[]:url.searchParams.get('status')==='repeat'?items.slice(0,1):items;return r.fulfill({json:{items:found,total:found.length,counts:{waiting:2,repeat:1}}});}
  if(p.startsWith('/api/')||p.startsWith('/auth/'))return r.fulfill({json:{}});
  let file=path.join(process.cwd(),p.startsWith('/builder/')?'story-builder':'frontend',p.startsWith('/builder/')?p.slice(9):p.slice(1));if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');return r.fulfill({path:file});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://fraerapp.ru/moderation/');await page.getByRole('button',{name:'Ожидают · 2',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('.moderation-card').count(),2);assert.equal(await page.getByRole('combobox').count(),0);
 assert.equal(await page.locator('.moderation-card').first().getByText('Глава 3 · Исправления',{exact:true}).count(),1);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.equal(await page.locator('.moderation-card h2').first().evaluate(e=>getComputedStyle(e).fontWeight),'400');
 for(const img of await page.locator('.moderation-search img,.moderation-chapters img').all())assert.ok(await img.evaluate(e=>e.complete&&e.naturalWidth>0&&e.getBoundingClientRect().width>0));
 await page.screenshot({path:`/tmp/moderation-queue-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Повторно · 1',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.moderation-card').length===1);assert.equal(queries.at(-1).status,'repeat');
 await page.getByRole('searchbox').fill('empty');await page.getByRole('searchbox').press('Enter');await page.getByText('Заявок с таким состоянием пока нет.',{exact:true}).waitFor();assert.equal(queries.at(-1).q,'empty');
 assert.deepEqual(errors,[]);console.log(width,'queue layout, chapters, filters, search and empty state');await context.close();
 }}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
