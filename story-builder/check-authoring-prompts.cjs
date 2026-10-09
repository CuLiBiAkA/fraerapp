const {chromium} = require('playwright');
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const {execFileSync} = require('child_process');
const root = path.resolve(__dirname, '..');
const screenshotDir = '/private/tmp/fraer-interface-review';
const cat = JSON.parse(fs.readFileSync(path.join(root, 'story-builder/scenarios/koshka-i-otkrytye-dveri.package.json'), 'utf8'));
const chapter = cat.scenarios[0];

(async () => {
  fs.mkdirSync(screenshotDir, {recursive:true});
  const browser = await chromium.launch();
  try {
    for (const width of [320,390,768,1440]) for (const language of ['ru','en']) {
      const context = await browser.newContext({viewport:{width,height:900}});
      await context.addInitScript(lang => localStorage.setItem('fraerapp.storyBuilderLanguage', lang), language);
      let exportReads=0, writes=0;
      await context.route('https://fraerapp.ru/**', route => {
        const request=route.request(), pathname=new URL(request.url()).pathname;
        const send=json=>route.fulfill({json});
        if(pathname==='/auth/me')return send({id:'fixture-author',email:'fixture@example.test',roles:['author']});
        if(pathname==='/api/author/home')return send({stories:[{storyId:'chapter',key:chapter.key,title:chapter.title,draftRevision:1,generation:1,reviewState:'draft',visibility:'private'}]});
        if(pathname==='/api/author/stories/chapter')return send({storyId:'chapter',draftRevision:1,generation:1,draftDocument:chapter});
        if(pathname==='/api/author/collections/parents')return send([{collectionId:'work',title:cat.collections[0].title,draftDocument:{...cat.collections[0],items:cat.collections[0].items.map((item,index)=>({...item,target:{...item.target,id:index===0?'chapter':'other-'+index}}))}}]);
        if(pathname==='/api/author/collections/work')return send({collectionId:'work',title:cat.collections[0].title,draftDocument:{...cat.collections[0],items:cat.collections[0].items.map((item,index)=>({...item,target:{...item.target,id:index===0?'chapter':'other-'+index}}))}});
        if(pathname==='/api/author/collections/work/export'){exportReads++; return send(cat);}
        if(pathname.startsWith('/api/')||pathname.startsWith('/auth/')){if(request.method()!=='GET')writes++;return send({notifications:[],unreadCount:0});}
        let file=path.join(root,pathname.startsWith('/builder/')?'story-builder':'frontend',pathname.startsWith('/builder/')?pathname.slice(9):pathname.slice(1));
        if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
        return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:'Not found'});
      });
      const page=await context.newPage(), errors=[]; page.on('pageerror',error=>errors.push(error.message)); page.setDefaultTimeout(10000);
      await page.goto('https://fraerapp.ru/builder/?story=chapter');
      await page.waitForFunction(title=>document.querySelector('[data-meta="title"]').value===title,chapter.title);
      const original=await page.evaluate(()=>localStorage.getItem('fraerapp.storyBuilderDraft'));
      if(language==='ru')await page.screenshot({path:`${screenshotDir}/builder-after-${width}.png`});
      const trigger=page.locator('#authoring-prompts-button'); await trigger.click();
      const dialog=page.locator('#authoring-prompts');await dialog.waitFor({state:'visible'});
      if(language==='ru')await page.screenshot({path:`${screenshotDir}/prompts-entry-${width}.png`});
      assert.equal(exportReads,0,'Opening prompts must not export private content');
      await page.locator('#prompt-mode').selectOption('edit');
      await page.locator('#prompt-brief').fill('Сделай последнюю дверь синей / Make the last door blue');
      await dialog.getByRole('button',{name:language==='ru'?'Подготовить промпт':'Prepare prompt',exact:true}).click();
      assert.equal(exportReads,0);assert.doesNotMatch(await page.locator('#prompt-output').inputValue(),/Мира проснулась в солнечном пятне/);
      await page.locator('#prompt-include-context').check();
      await dialog.getByRole('button',{name:language==='ru'?'Подготовить промпт':'Prepare prompt',exact:true}).click();
      assert.match(await page.locator('#prompt-output').inputValue(),/Мира проснулась в солнечном пятне/);
      assert.equal(exportReads,0,'Chapter source comes from current draft, not unrelated exports');
      await page.locator('#prompt-kind').selectOption('package');
      assert.equal(await page.locator('#prompt-include-context').isChecked(),false,'Scope changes require new explicit inclusion');
      await page.locator('#prompt-include-context').check();
      await dialog.getByRole('button',{name:language==='ru'?'Подготовить промпт':'Prepare prompt',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#prompt-output').value.includes('Дом с правом вернуться'));
      assert.equal(exportReads,1);
      const prompt=await page.locator('#prompt-output').inputValue(); assert.match(prompt,/fraerapp-work-package/); assert.match(prompt,/schemaVersion/);
      await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Denied')}}}));
      await dialog.getByRole('button',{name:language==='ru'?'Копировать промпт':'Copy prompt',exact:true}).click();
      assert.equal(await page.locator('#prompt-output').evaluate(n=>n.selectionEnd-n.selectionStart),prompt.length);
      assert.match(await dialog.locator('[role="status"]').innerText(),language==='ru'?/вручную/:/manually/);
      if(language==='ru'){await page.screenshot({path:`${screenshotDir}/prompts-fallback-${width}.png`});await dialog.evaluate(n=>n.scrollTop=0);await page.screenshot({path:`${screenshotDir}/prompts-after-${width}.png`});}
      assert.ok(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth),'Prompt fits viewport');
      const file=await Promise.all([page.waitForEvent('download'),dialog.getByRole('button',{name:language==='ru'?'Скачать .txt':'Download .txt',exact:true}).click()]);
      assert.match(file[0].suggestedFilename(),/^fraerapp-package-edit-/);
      await dialog.locator('summary').click();
      const exampleDownload=await Promise.all([page.waitForEvent('download'),dialog.getByRole('button',{name:language==='ru'?'Скачать пример целой истории':'Download a complete story example',exact:true}).click()]);
      const example=JSON.parse(fs.readFileSync(await exampleDownload[0].path(),'utf8'));
      assert.equal(example.collections[0].schemaVersion,2);assert.equal(example.scenarios.length,2);
      await page.keyboard.press('Escape'); assert.ok(await trigger.evaluate(n=>n===document.activeElement));
      assert.equal(await page.evaluate(()=>localStorage.getItem('fraerapp.storyBuilderDraft')),original,'Prompts and downloads do not modify draft');
      // Replacing a chapter is deliberate; cancelling keeps edits and server binding.
      await page.locator('[data-meta="title"]').fill('Current author edit');
      page.once('dialog',d=>d.dismiss());await page.locator('#load-example').click();
      assert.equal(await page.locator('[data-meta="title"]').inputValue(),'Current author edit');
      await page.locator('#paste-json').click();
      const revised=JSON.parse(await page.locator('#paste-area').inputValue());revised.description='AI revised description';
      await page.locator('#paste-area').fill(JSON.stringify(revised));page.once('dialog',d=>d.dismiss());await page.locator('#apply-paste').click();
      assert.ok(await page.locator('#paste-dialog').isVisible());
      assert.notEqual(await page.locator('[data-meta="description"]').inputValue(),'AI revised description');
      page.once('dialog',d=>d.accept());await page.locator('#apply-paste').click();
      assert.equal(await page.locator('[data-meta="description"]').inputValue(),'AI revised description');
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('fraerapp.storyBuilderDraft')).runtimeStory.storyId),'chapter');
      await page.locator('#paste-json').click();await page.locator('#paste-area').fill(JSON.stringify(cat));await page.locator('#apply-paste').click();
      assert.match(await page.locator('#paste-error').innerText(),language==='ru'?/Мои истории/:/My stories/);
      await page.keyboard.press('Escape');assert.equal(await page.locator('[data-meta="title"]').inputValue(),'Current author edit');
      assert.equal(writes,0,'No real or fixture API mutations required by prompt workflow');assert.deepEqual(errors,[]);
      // Standalone page gives every creation mode without reading browser draft.
      await page.goto('https://fraerapp.ru/builder/prompts.html');await page.locator('#open-prompts').click();
      assert.ok(await page.locator('#prompt-include-context').isDisabled());assert.equal(exportReads,1);
      await context.close();console.log(width,language,'prompt formats, explicit export, safe downloads, clipboard fallback, cancel/accept replacement, identity, no overflow');
    }
    // Comparable "before" evidence renders committed Builder files with synthetic APIs.
    for(const width of [320,390,768,1440]) {
      const c=await browser.newContext({viewport:{width,height:900}});await c.addInitScript(()=>localStorage.setItem('fraerapp.storyBuilderLanguage','ru'));
      await c.route('https://fraerapp.ru/**',route=>{
        const p=new URL(route.request().url()).pathname;
        if(p==='/auth/me')return route.fulfill({json:{id:'fixture-author',email:'fixture@example.test',roles:['author']}});
        if(p==='/api/author/home')return route.fulfill({json:{stories:[{storyId:'chapter',key:chapter.key,title:chapter.title,draftRevision:1,generation:1,reviewState:'draft',visibility:'private'}]}});
        if(p==='/api/author/stories/chapter')return route.fulfill({json:{storyId:'chapter',draftRevision:1,generation:1,draftDocument:chapter}});
        if(p==='/api/author/collections/parents')return route.fulfill({json:[{collectionId:'work'}]});
        if(p==='/api/author/collections/work')return route.fulfill({json:{collectionId:'work',title:cat.collections[0].title,draftDocument:{...cat.collections[0],items:cat.collections[0].items.map((item,index)=>({...item,target:{...item.target,id:index===0?'chapter':'other-'+index}}))}}});
        if(p.startsWith('/auth/')||p.startsWith('/api/'))return route.fulfill({json:{notifications:[],unreadCount:0}});
        let relative=p.startsWith('/builder/')?'story-builder/'+p.slice(9):'frontend/'+p.slice(1);if(relative.endsWith('/'))relative+='index.html';
        let content;try{content=execFileSync('git',['show','HEAD:'+relative],{cwd:root,maxBuffer:10*1024*1024});}catch{return route.fulfill({status:404,body:''});}
        const ext=path.extname(relative);return route.fulfill({body:content,contentType:({'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream'});
      });
      const page=await c.newPage();await page.goto('https://fraerapp.ru/builder/?story=chapter');await page.waitForFunction(title=>document.querySelector('[data-meta="title"]').value===title,chapter.title);
      await page.screenshot({path:`${screenshotDir}/builder-before-${width}.png`});await c.close();
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1)});
