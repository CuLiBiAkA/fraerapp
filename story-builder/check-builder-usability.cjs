const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),origin='https://fraerapp.ru';
(async()=>{
  const browser=await chromium.launch();
  try {
    for(const width of [320,390,768,1440])for(const language of ['ru','en']) {
      const context=await browser.newContext({viewport:{width,height:900}});
      await context.addInitScript(language=>localStorage.setItem('fraerapp.storyBuilderLanguage',language),language);
      let doc={key:'authored-key',title:'Авторское название',version:1,startSceneId:'my-scene',variables:{},assets:[],scenes:[{id:'my-scene',title:'Моя сцена',text:'Текст',choices:[],ending:{type:'good',title:'Конец'}}]},generation=1;
      const writes=[],summary=()=>({storyId:'chapter',key:doc.key,title:doc.title,generation,draftRevision:generation,reviewState:'draft',visibility:'private'});
      await context.route('**/*',route=>{
        const req=route.request(),url=new URL(req.url()),p=url.pathname,send=(json,status=200)=>route.fulfill({json,status});
        if(url.origin!==origin)return route.abort();
        if(p==='/auth/me')return send({email:'builder@example.test',roles:['author']});
        if(p==='/api/author/home')return send({stories:[summary()]});
        if(p==='/api/author/collections/parents')return send([]);
        if(p==='/api/author/stories/chapter'&&req.method()==='GET')return send({...summary(),draftDocument:doc});
        if(p==='/api/author/stories/chapter'&&req.method()==='PUT'){
          const body=req.postDataJSON();writes.push(body);assert.equal(body.generation,generation);
          assert.equal(body.document.metadata.schemaVersion,1,'Scenario cover metadata must use the version accepted by the API');
          doc=body.document;generation++;return send(summary());
        }
        if(p.startsWith('/auth/')||p.startsWith('/api/'))return send({notifications:[],unreadCount:0});
        let file=path.join(root,p.startsWith('/builder/')?'story-builder':'frontend',p.startsWith('/builder/')?p.slice(9):p.slice(1));
        if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
        return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404});
      });
      const page=await context.newPage(),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(error.message));
      await page.goto(origin+'/builder/?story=chapter');
      await page.waitForFunction(()=>document.querySelector('[data-meta="title"]').value==='Авторское название');
      assert.equal(await page.locator('[data-meta="key"]').count(),0);
      assert.equal(await page.getByLabel(language==='ru'?'Ключ сцены':'Scene key',{exact:true}).inputValue(),'my-scene');
      assert.ok(await page.locator('#variable-outline').evaluate(node=>node.closest('.project-group').hidden));
      assert.equal(await page.locator('.project-tree-scroll .project-group').first().locator('#metadata-outline').count(),1);
      await page.locator('#metadata-outline button').click();
      await page.waitForFunction(()=>document.querySelector('#active-context strong').textContent.includes(document.documentElement.lang==='en'?'Chapter settings':'Настройки главы'));
      await page.locator('#add-variable').click();
      assert.equal(await page.locator('#variable-outline').evaluate(node=>node.closest('.project-group').hidden),false);
      await page.locator('#choose-story-cover').click();
      const dialog=page.getByRole('dialog',{name:language==='ru'?'Обложка истории':'Story cover',exact:true});await dialog.waitFor();
      await dialog.getByRole('button',{name:language==='ru'?'Открытая дверь':'Open door',exact:true}).click();
      assert.equal(await page.locator('#builder-cover-preview').getAttribute('src'),'/assets/door.svg');
      assert.equal(writes.length,0,'Selecting a bundled cover remains local until Save');
      await page.locator('#import-runtime').click();
      await page.waitForFunction(()=>JSON.parse(localStorage.getItem('fraerapp.storyBuilderDraft')).runtimeStory.generation===2);
      assert.equal(doc.key,'authored-key');assert.equal(doc.metadata.coverUrl,'/assets/door.svg');
      assert.equal(doc.metadata.schemaVersion,1);
      assert.equal(doc.scenes[0].id,'my-scene');assert.equal(doc.scenes[0].title,'Моя сцена');
      await page.locator('#metadata-outline button').click();
      const beforeCancel=await page.evaluate(()=>localStorage.getItem('fraerapp.storyBuilderDraft'));
      await page.locator('#choose-story-cover').click();await dialog.waitFor();
      assert.ok(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth),'Cover picker fits the screen');
      await page.keyboard.press('Escape');
      await dialog.waitFor({state:'detached'});
      assert.equal(await page.evaluate(()=>localStorage.getItem('fraerapp.storyBuilderDraft')),beforeCancel,'Cancelling cover selection preserves the exact draft');
      assert.equal(writes.length,1,'Cancelling cover selection issues no save');
      assert.ok(await page.locator('#choose-story-cover').evaluate(node=>node===document.activeElement),'Cover picker restores focus');
      await page.evaluate(()=>scrollTo(0,0));
      if(width<=390){
        const boxes=await page.locator('.builder-toolbar > :is(button,label,a)').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
        assert.equal(new Set(boxes.map(b=>Math.round(b.x))).size,2,'Mobile toolbar uses two aligned columns');
        assert.ok(boxes.every(box=>box.height>=44&&box.width<=width/2),'Mobile controls fit and remain touch sized');
      }
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
      if(language==='ru')await page.screenshot({path:`/private/tmp/fraer-builder-usability-${width}.png`});
      // File/clipboard export is the first save boundary for an otherwise unsaved draft.
      page.once('dialog',dialog=>dialog.accept());await page.locator('#clear-draft').click();
      await page.locator('#tab-check').click();await page.locator('#validate-runtime').click();
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('fraerapp.storyBuilderDraft')).pendingKey),true,'Validation never creates a key');
      await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedBuilderJson=text;}}}));
      await page.locator('#copy-json').click();await page.waitForFunction(()=>Boolean(window.copiedBuilderJson));
      const exported=JSON.parse(await page.evaluate(()=>window.copiedBuilderJson));
      assert.match(exported.key,/^story_[a-f0-9]{32}$/);assert.equal(Object.hasOwn(exported,'pendingKey'),false);
      assert.equal(await page.locator('#authoring-prompts-button').count(),0);
      await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Clipboard unavailable');}}}));
      await page.locator('#copy-json').click();await page.locator('#paste-dialog').waitFor({state:'visible'});
      assert.equal(JSON.parse(await page.locator('#paste-area').inputValue()).key,exported.key);
      assert.ok(await page.locator('#paste-area').evaluate(area=>area.selectionStart===0&&area.selectionEnd===area.value.length));
      await page.locator('#paste-dialog').evaluate(dialog=>dialog.close());
      await page.locator('#paste-json').click();assert.equal(JSON.parse(await page.locator('#paste-area').inputValue()).key,exported.key);
      page.once('dialog',dialog=>dialog.accept());await page.locator('#apply-paste').click();
      const firstDownload=page.waitForEvent('download');await page.locator('#download-json').click();
      const saved=await firstDownload;assert.equal(JSON.parse(fs.readFileSync(await saved.path(),'utf8')).key,exported.key);
      page.once('dialog',dialog=>dialog.accept());await page.locator('#clear-draft').click();
      const nextDownload=page.waitForEvent('download');await page.locator('#download-json').click();
      const nextSaved=await nextDownload,nextExport=JSON.parse(fs.readFileSync(await nextSaved.path(),'utf8'));
      assert.match(nextExport.key,/^story_[a-f0-9]{32}$/);assert.notEqual(nextExport.key,exported.key);
      assert.equal(writes.length,1,'Local export does not save a server draft');assert.deepEqual(errors,[]);
      console.log(width,language,'metadata navigation, cover save/cancel, mobile controls, unique exports and reimport');
      await context.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
