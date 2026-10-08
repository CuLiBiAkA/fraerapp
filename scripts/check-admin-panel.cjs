const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    for(const width of [1440,768,390,320]){
      const context=await browser.newContext({viewport:{width,height:1000}});
      let access='admin', messageFails=true, statsFail=false;
      const me={id:'admin-id',email:'admin@example.test',roles:['player','admin']};
      const targetEmail='author.with.a.long.address.for.layout@example.test';
      let users=[{...me}, {id:'target',email:targetEmail,roles:['player','author']}, ...Array.from({length:23},(_,i)=>({id:'reader-'+i,email:`reader-${String(i).padStart(2,'0')}@example.test`,roles:['player']}))].map(u=>({...u,blocked:false,sessions:4,activeSessions:2,passkeys:1,auditEvents:5,createdAt:'2026-10-01T12:00:00Z',updatedAt:'2026-10-01T12:00:00Z'}));
      let authors=[{userId:'reader-22',email:'reader-22@example.test',requestedAt:'2026-10-07T12:00:00Z'}];
      let logins=[{email:'new-person@example.test',requestCount:2,activeUnusedLinks:1,userId:null,roles:[],blocked:false,lastRequestedAt:'2026-10-07T12:00:00Z'}];
      let keys=[{credentialId:'key-1',displayName:'Личный телефон',createdAt:'2026-10-01T12:00:00Z'}];
      const writes=[], queries=[], errors=[];let slowRelease,slowStarted,delayedPath,mutationStarted,mutationRelease;
      function holdMutation(p){delayedPath=p;return new Promise(resolve=>{mutationStarted=resolve;});}
      await context.route('https://admin.test/**',async route=>{
        const request=route.request(),url=new URL(request.url()),p=url.pathname;
        const send=(json,status=200)=>route.fulfill({json,status});
        if(p==='/auth/admin')return route.fulfill({path:path.join(process.cwd(),'auth-service/src/main/resources/admin.html')});
        if(p==='/auth/me')return access==='guest'?send({},401):send({...me,roles:access==='admin'?['player','admin']:['player','moderator']});
        if(p==='/auth/refresh')return send({},401);
        if(p==='/api/account')return send({avatar:'fairy',unreadCount:0,notifications:[]});
        if(p==='/auth/admin/users'){
          if(access!=='admin')return send({},403);
          const q=url.searchParams.get('query')||'',role=url.searchParams.get('role')||'all',status=url.searchParams.get('status')||'all';queries.push({q,role,status});
          const selected=users.filter(u=>u.email.toLowerCase().includes(q.toLowerCase())&&(role==='all'||u.roles.includes(role))&&(status==='all'||u.blocked===(status==='blocked')));
          const size=Number(url.searchParams.get('size')||20),totalPages=Math.ceil(selected.length/size),page=Math.max(0,Math.min(Number(url.searchParams.get('page')||0),totalPages-1));
          if(q==='reader-00'){slowStarted?.();await new Promise(resolve=>{slowRelease=resolve;});}
          return send({page,size,totalElements:selected.length,totalPages,items:selected.slice(page*size,(page+1)*size)});
        }
        if(p==='/auth/admin/author-requests')return access==='admin'?send(authors):send({},403);
        if(p==='/auth/admin/login-requests')return send({page:0,size:20,totalElements:logins.length,totalPages:logins.length?1:0,items:logins});
        if(p==='/api/admin/users/runtime-stats')return statsFail?send({},503):send([{userId:url.searchParams.get('userIds'),sessions:3,finishedSessions:1,authoredStories:2}]);
        if(p==='/auth/passkeys'&&request.method()==='GET')return send({passkeys:keys});
        if(request.method()!=='GET'){
          const body=request.postData()?request.postDataJSON():null;writes.push({path:p,body});
          if(p===delayedPath){delayedPath=null;mutationStarted();await new Promise(resolve=>{mutationRelease=resolve;});}
          if(p==='/api/account/admin/messages')return messageFails?route.fulfill({status:503,contentType:'text/html',body:'<h1>PRIVATE UPSTREAM FAILURE</h1>'}):send({sent:true});
          if(p==='/auth/admin/roles'){const u=users.find(u=>u.email===body.email);u.roles=body.role==='player'?['player']:body.grant?[...new Set([...u.roles,body.role])]:u.roles.filter(r=>r!==body.role);authors=authors.filter(r=>r.email!==body.email);return send({id:u.id,email:u.email,roles:u.roles,blocked:u.blocked});}
          if(p==='/auth/admin/users/block'){const u=users.find(u=>u.email===body.email);u.blocked=body.blocked;if(u.id===me.id&&body.blocked)access='guest';return send({id:u.id,email:u.email,roles:u.roles,blocked:u.blocked});}
          if(p==='/auth/admin/users/delete'){users=users.filter(u=>u.email!==body.email);return send({deleted:true,email:body.email});}
          if(p==='/auth/admin/users/login-link')return send({email:body.email,loginUrl:'https://admin.test/?auth_token=synthetic-fixture',expiresAt:'2026-10-08T23:59:00Z'});
          if(p==='/auth/admin/login-requests/delete'){logins=[];return send({deleted:true});}
          if(p==='/auth/passkeys/registration/options')return send({code:'RECENT_AUTH_REQUIRED',message:'Recent authentication required'},403);
          if(p.startsWith('/auth/passkeys/')){keys=[];return send({deleted:true});}
          return send({});
        }
        if(p.startsWith('/auth/')||p.startsWith('/api/'))return send({});
        const file=path.join(process.cwd(),'frontend',p.slice(1));
        return fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.fulfill({status:404,body:''});
      });
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      await page.goto('https://admin.test/auth/admin');
      await page.getByRole('button',{name:'Открыть карточку '+targetEmail,exact:true}).waitFor();
      assert.equal(await page.locator('.admin-user').count(),20);
      assert.equal(await page.locator('#users-page').textContent(),'1–20 из 25');
      await page.locator('#users-next').click();await page.waitForFunction(()=>document.querySelector('#users-page').textContent==='21–25 из 25');
      await page.locator('#user-role').selectOption('author');await page.waitForFunction(()=>document.querySelectorAll('.admin-user').length===1);
      assert.equal(queries.at(-1).role,'author');
      await page.getByRole('button',{name:'Открыть карточку '+targetEmail,exact:true}).click();await page.locator('#user-dialog').waitFor({state:'visible'});
      await page.waitForFunction(()=>document.querySelectorAll('#user-metrics strong')[3].textContent==='3');
      if([1440,390].includes(width))await page.screenshot({path:'/tmp/fraer-admin-card-'+width+'.png'});
      assert.ok(await page.locator('#user-dialog').evaluate(n=>n.scrollWidth<=n.clientWidth),'Dialog overflow '+width);
      await page.locator('#user-message').click();await page.locator('#message-text').fill('Сообщение с несколькими строками.\nПроверьте новую главу.');
      await page.getByRole('button',{name:'Отправить в личный кабинет',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#message-status').dataset.kind==='error');
      assert.ok((await page.locator('#message-text').inputValue()).includes('Проверьте'));
      assert.ok(!(await page.locator('#message-status').textContent()).includes('PRIVATE'));
      messageFails=false;await page.getByRole('button',{name:'Отправить в личный кабинет',exact:true}).click();await page.locator('#message-dialog').waitFor({state:'hidden'});
      assert.equal(writes.filter(w=>w.path==='/api/account/admin/messages').length,2);assert.equal(writes.at(-1).body.userId,'target');
      await page.locator('#role-choice').selectOption('moderator');await page.locator('#grant-role').click();await page.getByRole('button',{name:'Отмена',exact:true}).click();
      assert.equal(writes.filter(w=>w.path==='/auth/admin/roles').length,0);
      await page.locator('#grant-role').click();await page.locator('#confirm-submit').click();await page.waitForFunction(()=>document.querySelector('#user-summary').textContent.includes('Модератор'));
      assert.ok(users.find(u=>u.id==='target').roles.includes('author'));
      await page.locator('#user-invite').click();await page.locator('#view-invite').waitFor({state:'visible'});assert.equal(await page.locator('#invite-email').inputValue(),targetEmail);
      await page.getByRole('button',{name:'Создать одноразовую ссылку',exact:true}).click();await page.locator('#confirm-submit').click();await page.locator('#invite-result').waitFor({state:'visible'});
      await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Denied');}}}));
      await page.locator('#copy-invite').click();await page.waitForFunction(()=>document.querySelector('#copy-status').textContent.includes('вручную'));
      assert.ok(await page.locator('#invite-url').evaluate(n=>n.selectionEnd===n.value.length));
      await page.locator('[data-view=logins]').click();await page.getByRole('button',{name:'Пригласить',exact:true}).waitFor();
      assert.equal(await page.locator('#invite-url').inputValue(),'');
      await page.getByRole('button',{name:'Пригласить',exact:true}).click();assert.equal(await page.locator('#invite-create').isChecked(),true);
      await page.locator('[data-view=logins]').click();await page.getByRole('button',{name:'Удалить запись',exact:true}).click();await page.locator('#confirm-submit').click();await page.getByRole('heading',{name:'Обращений нет',exact:true}).waitFor();
      await page.locator('[data-view=users]').click();await page.getByRole('button',{name:'Открыть карточку '+targetEmail,exact:true}).click();
      await page.locator('#block-user').click();await page.locator('#confirm-submit').click();await page.waitForFunction(()=>document.querySelector('#user-summary').textContent.includes('заблокирован'));
      assert.equal(await page.locator('#user-invite').isEnabled(),false);
      await page.locator('#block-user').click();await page.locator('#confirm-submit').click();await page.waitForFunction(()=>document.querySelector('#user-summary').textContent.includes('Доступ открыт'));
      await page.locator('#delete-user').click();await page.locator('#confirm-email').fill('wrong@example.test');await page.locator('#confirm-submit').click();
      assert.equal(writes.filter(w=>w.path==='/auth/admin/users/delete').length,0);
      await page.locator('#confirm-email').fill(targetEmail);await page.locator('#confirm-submit').click();await page.locator('#user-dialog').waitFor({state:'hidden'});await page.getByRole('heading',{name:'Пользователи не найдены'}).waitFor();
      await page.locator('[data-view=authors]').click();await page.getByRole('heading',{name:'reader-22@example.test',exact:true}).waitFor();
      await page.locator('#author-query').fill('missing');await page.getByRole('heading',{name:'Заявки не найдены',exact:true}).waitFor();await page.locator('#author-query').fill('');
      await page.getByRole('button',{name:'Выдать права автора',exact:true}).click();await page.getByRole('heading',{name:'Новых заявок нет',exact:true}).waitFor();assert.equal(authors.length,0);assert.ok(users.find(u=>u.id==='reader-22').roles.includes('author'));
      await page.locator('[data-view=users]').click();
      await page.locator('#reset-users').click();await page.getByRole('button',{name:'Открыть карточку '+me.email,exact:true}).click();assert.equal(await page.locator('#delete-user').isEnabled(),false);await page.keyboard.press('Escape');
      const started=new Promise(resolve=>{slowStarted=resolve;});await page.locator('#user-query').fill('reader-00');await started;
      await page.locator('#user-query').fill('reader-01');await page.waitForFunction(()=>document.querySelectorAll('.admin-user').length===1&&document.querySelector('.admin-user h3').textContent==='reader-01@example.test');
      const oldResponse=page.waitForResponse(r=>r.url().includes('query=reader-00'));slowRelease();await oldResponse;assert.equal(await page.locator('.admin-user h3').textContent(),'reader-01@example.test');
      await page.locator('[data-view=security]').click();await page.getByRole('button',{name:'Удалить ключ',exact:true}).click();await page.keyboard.press('Escape');assert.equal(keys.length,1);
      await page.getByRole('button',{name:'Удалить ключ',exact:true}).click();await page.locator('#confirm-submit').click();await page.getByRole('heading',{name:'Ключей доступа пока нет'}).waitFor();
      await page.locator('#passkey-register').click();await page.waitForFunction(()=>document.querySelector('#security-status').textContent.includes('недавний вход'));
      assert.equal(await page.locator('#admin-layout').isVisible(),true);assert.equal(await page.locator('#access-denied').isVisible(),false);
      await page.locator('[data-view=users]').click();await page.locator('#reset-users').click();await page.getByRole('button',{name:'Открыть карточку '+me.email,exact:true}).waitFor();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page overflow '+width);
      if([1440,390].includes(width))await page.screenshot({path:'/tmp/fraer-admin-'+width+'.png',fullPage:true});
      if(width===1440){
        // Completing a mutation for A must not repaint B or clear B's message draft.
        await page.getByRole('button',{name:'Открыть карточку reader-01@example.test',exact:true}).click();
        const roleStarted=holdMutation('/auth/admin/roles');await page.locator('#role-choice').selectOption('author');await page.locator('#grant-role').click();await page.locator('#confirm-submit').click();await roleStarted;
        await page.keyboard.press('Escape');await page.getByRole('button',{name:'Открыть карточку reader-02@example.test',exact:true}).click();mutationRelease();
        await page.waitForFunction(()=>document.querySelector('#page-status').textContent.includes('Права обновлены: reader-01'));
        assert.equal(await page.locator('#user-heading').textContent(),'reader-02@example.test');assert.equal(await page.locator('#user-summary').textContent(),'Читатель · Доступ открыт');
        await page.locator('#user-message').click();await page.locator('#message-text').fill('Сообщение для второго читателя');
        const messageStarted=holdMutation('/api/account/admin/messages');await page.getByRole('button',{name:'Отправить в личный кабинет',exact:true}).click();await messageStarted;
        await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.getByRole('button',{name:'Открыть карточку reader-03@example.test',exact:true}).click();await page.locator('#user-message').click();await page.locator('#message-text').fill('Черновик для третьего читателя');mutationRelease();
        await page.waitForFunction(()=>document.querySelector('#page-status').textContent.includes('Сообщение отправлено: reader-02'));
        assert.equal(await page.locator('#message-text').inputValue(),'Черновик для третьего читателя');assert.equal(await page.locator('#message-dialog').isVisible(),true);
        await page.keyboard.press('Escape');await page.keyboard.press('Escape');
        // Leaving a link form while the request is pending must not retain a late token.
        await page.locator('[data-view=invite]').click();await page.locator('#invite-email').fill(me.email);
        const linkStarted=holdMutation('/auth/admin/users/login-link');await page.getByRole('button',{name:'Создать одноразовую ссылку',exact:true}).click();await page.locator('#confirm-submit').click();await linkStarted;
        await page.locator('[data-view=users]').click();mutationRelease();await page.waitForFunction(()=>document.querySelector('#page-status').textContent.includes('создана и скрыта'));
        assert.equal(await page.locator('#invite-url').inputValue(),'');
      }
      await page.getByRole('button',{name:'Открыть карточку '+me.email,exact:true}).click();
      await page.locator('#block-user').click();await page.locator('#confirm-submit').click();await page.locator('#login-section').waitFor({state:'visible'});
      assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.locator('#admin-layout').isVisible(),false);
      access='admin';await page.reload();await page.locator('#admin-layout').waitFor({state:'visible'});
      access='moderator';await page.locator('#refresh-users').click();await page.locator('#access-denied').waitFor({state:'visible'});assert.equal(await page.locator('#admin-layout').isVisible(),false);
      await page.reload();await page.locator('#access-denied').waitFor({state:'visible'});assert.equal(await page.locator('#denied-moderation').isVisible(),true);
      access='guest';await page.reload();await page.locator('#login-section').waitFor({state:'visible'});assert.equal(await page.locator('#admin-layout').isVisible(),false);
      assert.deepEqual(errors,[]);console.log(width+': users, filters, paging, messages/retry, roles/cancel, links/copy, confirmations, stale responses, recent authentication, self-block and revoked access passed');
      await context.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
