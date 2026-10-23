const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch();try{for(const width of [320,390,768,1440]){
 const c=await browser.newContext({viewport:{width,height:1000}});
 await c.addInitScript(()=>{localStorage.setItem('fraerapp.language','ru');localStorage.setItem('fraerapp.storyBuilderLanguage','ru');});
 await c.route('https://fraerapp.ru/**',r=>{const p=new URL(r.request().url()).pathname;
  if(p==='/auth/me')return r.fulfill({json:{id:'test',roles:['author','moderator'],email:'test@example.test'}});
  if(p==='/api/author/home')return r.fulfill({json:{stories:[]}});
  if(p.includes('/folders'))return r.fulfill({json:{items:[],total:0}});
  if(p.startsWith('/api/')||p.startsWith('/auth/'))return r.fulfill({json:{notifications:[],unreadCount:0}});
  let f=path.join(process.cwd(),p.startsWith('/builder/')?'story-builder':'frontend',p.startsWith('/builder/')?p.slice(9):p.slice(1));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');return r.fulfill({path:f});
 });
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 let navigation;
 for(const route of ['/moderation/','/moderation/?view=stories','/my-stories/','/builder/']){
  await p.goto('https://fraerapp.ru'+route);await p.locator('#site-controls').waitFor();await p.evaluate(()=>document.fonts.ready);
  if(route.startsWith('/moderation/')){
   await p.getByRole('heading',{name:'Модерация',exact:true}).waitFor();await p.getByRole('heading',{name:'Заявки на публикацию',exact:true}).waitFor();
   assert.equal(await p.locator('.author-section-nav').count(),0);
   assert.equal(new URL(p.url()).searchParams.has('view'),false);
   assert.equal(await p.getByText('Доступ проверен:',{exact:false}).count(),0);
   const h=await p.locator('.author-title-row h1').boundingBox();if(width===1440)assert.ok(h.y<120);
  }
  if(route==='/builder/') {await p.locator('[data-help-topic=storyMetadata]').waitFor();assert.equal(await p.locator('.builder-home').getAttribute('href'),'/');assert.equal(await p.locator('.builder-home span').innerText(),'На главную');}
  const home=await p.locator(route==='/builder/'?'.builder-home':'.site-home').boundingBox();
  const account=await p.locator('[data-site-account]').boundingBox();
  const settings=await p.locator('[data-site-settings]').boundingBox();
  const geometry=[home.x,home.y+home.height/2,account.x,account.y,settings.x,settings.y];
  if(navigation)geometry.forEach((v,i)=>assert.ok(Math.abs(v-navigation[i])<1,`${route} nav ${width}: ${geometry} != ${navigation}`));
  else navigation=geometry;
  assert.ok(await p.evaluate(()=>getComputedStyle(document.body).backgroundImage.includes('workspace-background.svg')));
  const heading=p.locator(route==='/builder/'?'.topbar h1':'.author-title-row h1');await heading.waitFor();assert.equal(await heading.evaluate(e=>getComputedStyle(e).color),'rgb(254, 227, 226)');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' '+width);
  await p.screenshot({path:`/tmp/surface-${route.replaceAll('/','')}-${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);console.log(width,'shared gradient, heading colors, moderation layout, builder Home');await c.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
