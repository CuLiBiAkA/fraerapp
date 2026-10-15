const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  for(const width of [320,390,1440]) for(const lang of ['ru','en']) {
   const context=await browser.newContext({viewport:{width,height:900}});
   let enabled=true,fail=false,linked=true,available=true,writes=0,displayName='Анна Иванова';
   const user=()=>({id:'reader',email:'telegram-67890@telegram.fraerapp.local',roles:['player'],
    displayName,telegramUsername:'anna_reader',telegramLinked:linked,telegramNotificationsAvailable:available,telegramNotificationsEnabled:enabled});
   await context.addInitScript(lang=>localStorage.setItem('fraerapp.language',lang),lang);
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url()),p=url.pathname;
    if(url.hostname!=='telegram-profile.test')return route.abort();
    if(p==='/auth/me')return route.fulfill({json:user()});
    if(p==='/auth/telegram/notifications') {
     assert.equal(route.request().method(),'POST');writes++;
     if(fail)return route.fulfill({status:503,json:{}});
     enabled=route.request().postDataJSON().enabled;return route.fulfill({json:user()});
    }
    if(p==='/api/account')return route.fulfill({json:{unreadCount:0,notifications:[]}});
    if(p==='/api/catalog/stories')return route.fulfill({json:[]});
    if(p.startsWith('/api/')||p.startsWith('/auth/'))return route.fulfill({json:[]});
    let file=path.join(process.cwd(),'frontend',p.slice(1));
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    if(!fs.existsSync(file))file=path.join(process.cwd(),'frontend/index.html');
    return route.fulfill({path:file});
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   for(const route of ['/','/privacy-policy.html']) {
    await page.goto('https://telegram-profile.test'+route);
    await page.locator('[data-site-account]').click();
    await page.locator('#profile-modal:not(.hidden)').waitFor();
    assert.equal(await page.locator('#profile-modal-email').textContent(),'Анна Иванова · @anna_reader');
    await page.keyboard.press('Escape');
    await page.locator('#site-controls > button').first().click();
    const toggle=page.locator('#modal-notifications-toggle');
    await page.waitForFunction(()=>!document.querySelector('#modal-notifications-toggle').disabled);
    const previous=enabled;
    await toggle.click();
    await page.waitForFunction(expected=>document.querySelector('#modal-notifications-toggle').getAttribute('aria-checked')===String(expected)&&!document.querySelector('#modal-notifications-toggle').disabled,!previous);
    assert.equal(enabled,!previous);
    fail=true;await toggle.click();
    await page.getByText(lang==='ru'?'Не удалось сохранить настройку. Попробуйте ещё раз.':'Could not save this setting. Please try again.',{exact:true}).waitFor();
    assert.equal(await toggle.getAttribute('aria-checked'),String(enabled));fail=false;
    await page.keyboard.press('Escape');
    await page.locator('#site-controls > button').first().click();
    await page.waitForFunction(()=>!document.querySelector('#modal-notifications-toggle').disabled);
    assert.equal(await toggle.getAttribute('aria-checked'),String(enabled));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.keyboard.press('Escape');
   }
   for(const state of ['unlinked','unavailable']) {
    linked=state!=='unlinked';available=state!=='unavailable';
    const before=writes;
    await page.locator('#site-controls > button').first().click();
    const hint=state==='unlinked'
     ? (lang==='ru'?'Войдите через Telegram, чтобы получать уведомления от бота.':'Sign in with Telegram to receive notifications from the bot.')
     : (lang==='ru'?'Доставка в Telegram пока недоступна. Уведомления остаются на сайте.':'Telegram delivery is currently unavailable. Notifications remain on the website.');
    await page.getByText(hint,{exact:true}).waitFor();
    assert.ok(await page.locator('#modal-notifications-toggle').isDisabled());assert.equal(writes,before);
    await page.keyboard.press('Escape');
   }
   displayName='А'.repeat(128)+' '+'Б'.repeat(128);
   await page.reload();await page.locator('[data-site-account]').click();
   await page.locator('#profile-modal:not(.hidden)').waitFor();
   assert.equal(await page.locator('#profile-modal-email').textContent(),displayName+' · @anna_reader');
   assert.ok(await page.evaluate(()=>document.querySelector('#profile-modal-email').scrollWidth<=document.querySelector('#profile-modal-email').clientWidth+1),'long names wrap inside the dialog');
   assert.deepEqual(errors,[]);await context.close();
   console.log(`${width}/${lang}: profile, preference persistence, failed save, unavailable delivery passed`);
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
