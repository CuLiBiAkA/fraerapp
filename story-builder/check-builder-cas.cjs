const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),origin='https://fraerapp.ru';
(async()=>{const browser=await chromium.launch();try{
  for(const width of [320,390,768,1440])for(const language of ['ru','en']){
    const context=await browser.newContext({viewport:{width,height:900}});await context.addInitScript(language=>localStorage.setItem('fraerapp.storyBuilderLanguage',language),language);
    let generation=1,revision=1,doc={key:'cas-story',title:'Initial chapter',version:1,startSceneId:'end',variables:{},assets:[],scenes:[{id:'end',title:'End',text:'Original text',choices:[],ending:{type:'good',title:'End'}}]};
    const summary=()=>({storyId:'chapter',key:doc.key,title:doc.title,generation,draftRevision:revision,reviewState:'draft',visibility:'private'});
    const writes=[];
    await context.route('**/*',route=>{
      const req=route.request(),url=new URL(req.url()),p=url.pathname,send=(json,status=200)=>route.fulfill({json,status});
      if(url.origin!==origin)return route.abort();
      if(p==='/auth/me')return send({email:'cas@example.test',roles:['author']});
      if(p==='/api/author/home')return send({stories:[summary()]});
      if(p==='/api/author/collections/parents')return send([]);
      if(p==='/api/author/stories/chapter'&&req.method()==='GET')return send({...summary(),draftDocument:doc});
      if(p==='/api/author/stories/chapter'&&req.method()==='PUT'){
        const body=req.postDataJSON();writes.push({method:'PUT',body});
        if(body.generation!==generation)return send({message:'Story changed. Reload before retrying.'},409);
        doc=body.document;generation++;revision++;return send(summary());
      }
      if(p==='/api/author/stories/import'){writes.push({method:'POST',body:req.postDataJSON()});return send({message:'Existing chapter must not use import'},500);}
      if(p.startsWith('/api/')||p.startsWith('/auth/'))return send({notifications:[],unreadCount:0});
      let file=path.join(root,p.startsWith('/builder/')?'story-builder':'frontend',p.startsWith('/builder/')?p.slice(9):p.slice(1));
      if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404});
    });
    const page=await context.newPage(),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/builder/?story=chapter');await page.waitForFunction(()=>document.querySelector('[data-meta="title"]').value==='Initial chapter');
    await page.locator('[data-meta="title"]').fill('My unsaved edit');
    doc={...doc,title:'Saved in another tab'};generation=2;revision=2;
    await page.locator('#import-runtime').click();
    const reload=page.getByRole('button',{name:language==='ru'?'Открыть актуальную версию':'Open current version',exact:true});await reload.waitFor();
    assert.equal(doc.title,'Saved in another tab');assert.equal(writes.length,1);assert.equal(writes[0].method,'PUT');assert.equal(writes[0].body.generation,1);
    assert.equal(await page.locator('[data-meta="title"]').inputValue(),'My unsaved edit');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('fraerapp.storyBuilderDraft')).runtimeStory.generation),1);
    if(language==='ru')await page.screenshot({path:`/private/tmp/fraer-interface-review/builder-conflict-${width}.png`});
    page.once('dialog',dialog=>dialog.dismiss());await reload.click();assert.equal(await page.locator('[data-meta="title"]').inputValue(),'My unsaved edit');
    page.once('dialog',dialog=>dialog.accept());await reload.click();await page.waitForFunction(()=>document.querySelector('[data-meta="title"]').value==='Saved in another tab');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('fraerapp.storyBuilderDraft')).runtimeStory.generation),2);
    // AI edits preserve this newly loaded identity and generation.
    await page.locator('#paste-json').click();const edited=JSON.parse(await page.locator('#paste-area').inputValue());edited.title='AI edit after resolving conflict';
    await page.locator('#paste-area').fill(JSON.stringify(edited));page.once('dialog',dialog=>dialog.accept());await page.locator('#apply-paste').click();
    await page.locator('#import-runtime').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('fraerapp.storyBuilderDraft')).runtimeStory.generation===3);
    assert.equal(doc.title,'AI edit after resolving conflict');assert.equal(writes.length,2);assert.equal(writes[1].method,'PUT');assert.equal(writes[1].body.generation,2);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
    console.log(width,language,'stale bound save rejected, edits retained, cancel/accept recovery, same-key AI edit saves via CAS');await context.close();
  }
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exit(1)});
