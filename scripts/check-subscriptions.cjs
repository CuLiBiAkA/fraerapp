// Fully isolated browser journeys: production accounts/payments are never used.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=process.cwd();
(async()=>{const browser=await chromium.launch();try{
 for(const language of ['ru','en'])for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000}});await context.addInitScript(lang=>localStorage.setItem('fraerapp.language',lang),language);
  let signed=true,blocked=false,disabled=false,fail=true,sub=null,manual=false;const orders=[],events=[],posts=[],errors=[];
  const account=()=>({plan:{id:'author-monthly',months:1,mode:'test',checkoutEnabled:!disabled,priceMinor:13900,chargeMinor:0,currency:'RUB'},subscription:sub,manualAuthor:manual,authorAccess:manual||sub?.status==='active',orders,events});
  await context.route('https://fraerapp.ru/**',async route=>{
   const req=route.request(),p=new URL(req.url()).pathname,send=(value,status=200)=>route.fulfill({status,json:value});
   if(p==='/auth/me')return send(signed?{id:'customer',email:'author@example.test',roles:sub?.status==='active'?['player','author']:['player']}:{},blocked?403:signed?200:401);
   if(p==='/auth/refresh')return send({},401);
   if(p==='/auth/subscription')return send(account());
   if(p==='/auth/subscription/mock-checkout'){
    const body=req.postDataJSON();posts.push(body);if(fail){fail=false;return send({},500);}
    const next=new Date(sub?.status==='active'?sub.expiresAt:Date.now());next.setUTCMonth(next.getUTCMonth()+1);const end=next.toISOString();
    sub={status:'active',startedAt:new Date().toISOString(),expiresAt:end,version:orders.length+1};orders.unshift({id:String(orders.length+1),createdAt:new Date().toISOString(),periodEnd:end,status:'test_succeeded',amountMinor:0});
    await new Promise(resolve=>setTimeout(resolve,100));return send(account());
   }
   if(p.startsWith('/auth/')||p.startsWith('/api/'))return send({notifications:[],unreadCount:0});
   let file=p.startsWith('/builder/')?path.join(root,'story-builder',p.slice(9)):path.join(root,'frontend',p);if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');return route.fulfill({path:file});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://fraerapp.ru/subscription/');
  await page.waitForFunction(()=>!document.querySelector('#subscribe').disabled);
  assert.ok(await page.locator('#subscription-create').isHidden());
  await page.locator('#subscribe').click();await page.locator('#checkout-cancel').click();assert.equal(posts.length,0);
  await page.locator('#subscribe').click();await page.locator('#checkout-consent').check();await page.locator('#checkout-confirm').click();
  await page.waitForFunction(()=>document.querySelector('#checkout-status').textContent.includes('ещё')||document.querySelector('#checkout-status').textContent.includes('again'));
  assert.ok(await page.locator('#checkout-dialog').isVisible());
  // Lost/error responses must remain idempotent even after a page reload.
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#subscribe').disabled);
  await page.locator('#subscribe').click();await page.locator('#checkout-consent').check();await page.locator('#checkout-confirm').click();
  await page.locator('#subscription-create').waitFor();assert.equal(posts[0].requestId,posts[1].requestId);assert.equal(await page.locator('.subscription-order').count(),1);
  assert.match(await page.locator('#subscription-status').textContent(),language==='ru'?/деньги не списывались/:/no money was charged/);
  await page.locator('#subscribe').click();await page.locator('#checkout-consent').check();await page.locator('#checkout-confirm').click();await page.waitForFunction(()=>document.querySelectorAll('.subscription-order').length===2);
  assert.notEqual(posts[1].requestId,posts[2].requestId);
  await page.locator('[data-site-account]').click();await page.locator('#profile-subscription').waitFor();assert.equal(await page.locator('#profile-subscription').getAttribute('href'),'/subscription/');assert.ok((await page.locator('#profile-subscription').boundingBox()).height>=44);await page.locator('#profile-modal-close').click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width!==320)await page.screenshot({path:`/tmp/subscription-${language}-${width}.png`,fullPage:true});
  sub.status='expired';manual=true;await page.locator('#subscription-refresh').click();await page.waitForFunction(()=>document.querySelector('#subscription-current').textContent.includes('администратор')||document.querySelector('#subscription-current').textContent.includes('administrator'));
  assert.ok(await page.locator('#subscription-create').isVisible());
  disabled=true;await page.locator('#subscription-refresh').click();await page.locator('#checkout-disabled').waitFor();assert.ok(await page.locator('#subscribe').isDisabled());
  signed=false;blocked=true;await page.locator('#subscription-refresh').click();await page.locator('#subscription-login').waitFor();assert.ok(await page.locator('#subscription-history').isHidden());
  assert.deepEqual(errors,[]);console.log('customer',language,width,'checkout/retry/reload idempotency, renewal, manual access, disabled/blocked, no overflow');await context.close();
 }
 for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000}});let authorized=true,conflict=true;const errors=[],mutations=[];
  let sub={planId:'author-monthly',status:'active',startedAt:'2026-10-01T00:00:00Z',expiresAt:'2026-11-01T00:00:00Z',version:1};
  const record={userId:'customer',email:'customer@example.test',blocked:false,manualAuthor:true};
  const account=()=>({subscription:sub,manualAuthor:true,orders:[{createdAt:'2026-10-01T00:00:00Z',periodEnd:sub.expiresAt}],events:[...(sub.status==='revoked'?[{action:'revoked',createdAt:'2026-10-09T00:00:00Z',actorId:'admin',actorLabel:'admin@example.test',reason:'Проверка завершена'}]:[]),{action:'test_activated',createdAt:'2026-10-01T00:00:00Z',actorId:'customer',actorLabel:'customer@example.test'}]});
  await context.route('https://fraerapp.ru/**',async route=>{
   const req=route.request(),url=new URL(req.url()),p=url.pathname,send=(value,status=200)=>route.fulfill({status,json:value});
   if(p==='/auth/me')return send({id:'admin',email:'admin@example.test',roles:['admin']});
   if(p==='/auth/admin/author-requests')return send([]);
   if(p==='/auth/admin/subscriptions')return send({page:0,size:20,totalElements:1,totalPages:1,items:[{...record,subscription:sub}],counts:{active:sub.status==='active'?1:0,revoked:sub.status==='revoked'?1:0}},authorized?200:403);
   if(p==='/auth/admin/subscriptions/customer')return send(account());
   if(p==='/auth/admin/subscriptions/customer/revoke'){mutations.push(req.postDataJSON());if(conflict){conflict=false;return send({},409);}sub={...sub,status:'revoked',version:2};return send(account());}
   if(p==='/auth/admin')return route.fulfill({path:path.join(root,'auth-service/src/main/resources/admin.html')});
   if(p.startsWith('/auth/')||p.startsWith('/api/'))return send({notifications:[],unreadCount:0});
   let file=p.startsWith('/builder/')?path.join(root,'story-builder',p.slice(9)):path.join(root,'frontend',p);return route.fulfill({path:file});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://fraerapp.ru/auth/admin#subscriptions');
  await page.getByRole('button',{name:'История и управление'}).click();await page.locator('#subscription-reason').waitFor();
  await page.locator('#subscription-reason').fill('Проверка завершена');await page.locator('#subscription-dialog button.danger').click();await page.locator('#confirm-submit').click();
  await page.getByText('Подписка уже изменилась.',{exact:false}).waitFor();assert.equal(await page.locator('#subscription-reason').inputValue(),'Проверка завершена');
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();await page.getByRole('button',{name:'История и управление'}).click();await page.locator('#subscription-reason').fill('Проверка завершена');
  await page.locator('#subscription-dialog button.danger').click();await page.locator('#confirm-submit').click();
  await page.getByText('Подписка отозвана. Причина сохранена в истории.').waitFor();assert.equal(mutations[1].version,1);assert.equal(mutations[1].reason,'Проверка завершена');
  assert.equal(await page.locator('#subscription-detail-status').getAttribute('data-kind'),'success');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await page.locator('#subscription-dialog').evaluate(n=>n.scrollWidth<=n.clientWidth));assert.match(await page.locator('#subscription-dialog').textContent(),/Инициатор: customer@example.test/);if(width!==320)await page.screenshot({path:`/tmp/subscription-admin-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();authorized=false;await page.locator('#view-subscriptions').getByRole('button',{name:'Обновить',exact:true}).click();
  await page.locator('#access-denied').waitFor();assert.equal(await page.locator('#subscriptions-list').textContent(),'');assert.deepEqual(errors,[]);
  console.log('admin',width,'history, version conflict, reason retained, revocation, role loss, no overflow');await context.close();
 }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1);});
