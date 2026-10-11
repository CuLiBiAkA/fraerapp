// Local synthetic accounts and responses only; every browser request is intercepted.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch();try{
 for(const language of ['ru','en'])for(const width of [320,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}});await context.addInitScript(lang=>localStorage.setItem('fraerapp.language',lang),language);
  const words=(ru,en)=>language==='ru'?ru:en,writes=[],errors=[];let trashed=true;
  const chapter={key:'chapter',title:'Private chapter',version:1,startSceneId:'start',variables:{},assets:[],scenes:[{id:'start',title:'Start',text:'Private story',ending:{title:'Done'},choices:[]}]};
  const document={schemaVersion:2,key:'book',type:'story',title:'My story',items:[{target:{kind:'scenario',id:'chapter',key:'chapter'}}],transitions:[]};
  const collection=()=>({id:'book',collectionId:'book',kind:'collection',title:'My story',key:'book',generation:3,draftRevision:2,reviewState:'draft',visibility:trashed?'deleted':'private',canRestoreTrash:trashed,trashExpiresAt:'2026-11-11T12:00:00Z',draftDocument:document,children:[],reviewLimitReached:true,reviewDailyLimitReached:true,reviewAvailableAt:'2026-10-12T12:00:00Z'});
  const story={id:'chapter',storyId:'chapter',kind:'scenario',key:'chapter',title:'Private chapter',generation:9,draftRevision:9,hasDraft:true,reviewState:'draft',visibility:'private',draftDocument:chapter,versions:[{versionNumber:9}],events:[]};
  await context.route('https://fraerapp.ru/**',route=>{
   const req=route.request(),url=new URL(req.url()),p=url.pathname,send=json=>route.fulfill({json});
   if(!['GET','HEAD'].includes(req.method()))writes.push(p);
   if(p==='/'&&(url.searchParams.has('previewStory')||url.searchParams.has('previewCollection')))return route.fulfill({contentType:'text/html',body:'<p>Private reader route</p>'});
   if(p==='/auth/me')return send({id:'author',roles:['author']});
   if(p==='/api/author/folders')return send({items:[collection()],total:1});
   if(p==='/api/author/collections/book')return send(collection());
   if(p==='/api/author/collections/book/restore'){assert.equal(req.postDataJSON().generation,3);trashed=false;return send(collection());}
   if(p==='/api/author/collections/targets')return send([{id:'chapter',key:'chapter',kind:'scenario',title:'Private chapter',owned:true}]);
   if(p==='/api/author/stories')return send([story]);
   if(p==='/api/author/stories/chapter')return send(story);
   if(p==='/api/author/stories/chapter/preview')return send({revision:9,document:chapter,validation:{valid:true}});
   if(p.startsWith('/api/')||p.startsWith('/auth/'))return send({notifications:[],unreadCount:0});
   let file=path.join(process.cwd(),'frontend',p.slice(1));if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
   return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:''});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto('https://fraerapp.ru/my-stories/?collection=book&trash=1');
  await page.getByRole('button',{name:words('Восстановить черновик','Restore draft'),exact:true}).click();
  await page.getByRole('heading',{name:words('Главы истории','Story chapters'),exact:true}).waitFor();
  assert.match(await page.locator('.review-limit-notice').textContent(),language==='ru'?/24 часа/:/24 hours/);
  assert.ok(await page.locator('[data-review-submit]').first().isDisabled());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const playStory=page.getByRole('link',{name:words('Пройти историю','Play story'),exact:true});
  await playStory.waitFor();assert.equal(await playStory.getAttribute('href'),'/?previewCollection=book&revision=2');
  await playStory.click();await page.waitForURL('**/?previewCollection=book&revision=2');
  await page.goto('https://fraerapp.ru/my-stories/?collection=book');
  await page.getByRole('button',{name:words('Пройти черновик','Play draft'),exact:true}).click();
  await page.waitForURL('**/?previewStory=chapter&revision=9');
  await page.goto('https://fraerapp.ru/my-stories/?story=chapter');
  const play=page.getByRole('link',{name:words('Пройти черновик','Play draft'),exact:true});await play.waitFor();
  assert.equal(await play.getAttribute('href'),'/?previewStory=chapter&revision=9');
  await play.click();await page.waitForURL('**/?previewStory=chapter&revision=9');
  assert.deepEqual(writes,['/api/author/collections/book/restore']);assert.deepEqual(errors,[]);
  console.log(language,width,'author trash restores privately; daily quota and exact draft play links pass');await context.close();
 }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1);});
