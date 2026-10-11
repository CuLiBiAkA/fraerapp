const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),origin='https://fraerapp.ru';

function multipartImage(request) {
  const boundary=request.headers()['content-type'].match(/boundary=([^;]+)/)[1];
  const body=request.postDataBuffer(),start=body.indexOf('\r\n\r\n')+4,end=body.indexOf(`\r\n--${boundary}`,start);
  assert.ok(start>3&&end>start);
  const header=body.subarray(0,start).toString(),type=header.match(/Content-Type: ([^\r]+)/i)[1];
  return {buffer:body.subarray(start,end),type};
}

async function sourceImage(page,transparent) {
  const value=await page.evaluate(async transparent=>{
    const canvas=document.createElement('canvas');canvas.width=2600;canvas.height=1500;
    const context=canvas.getContext('2d'),pixels=context.createImageData(canvas.width,canvas.height);
    let seed=12345;
    for(let i=0;i<pixels.data.length;i+=4){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      pixels.data[i]=transparent?120:seed&255;pixels.data[i+1]=transparent?60:(seed>>>8)&255;pixels.data[i+2]=transparent?200:(seed>>>16)&255;
      pixels.data[i+3]=transparent?128:255;
    }
    context.putImageData(pixels,0,0);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,transparent?'image/png':'image/jpeg',.9));
    return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob);});
  },transparent);
  return {name:transparent?'transparent.png':'desktop.jpg',mimeType:transparent?'image/png':'image/jpeg',buffer:Buffer.from(value,'base64')};
}

async function uploadedSize(page,upload) {
  return page.evaluate(async({data,type})=>{
    const image=new Image();image.src=`data:${type};base64,${data}`;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const context=canvas.getContext('2d');context.drawImage(image,0,0);
    return {width:canvas.width,height:canvas.height,alpha:context.getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1).data[3]};
  },{data:upload.buffer.toString('base64'),type:upload.type});
}

(async()=>{
  const browser=await chromium.launch();
  try {
    for(const width of [320,390])for(const language of ['ru','en']) {
      const context=await browser.newContext({viewport:{width,height:900}});
      await context.addInitScript(language=>localStorage.setItem('fraerapp.storyBuilderLanguage',language),language);
      let doc=null,generation=0;const writes=[],uploads=[];
      const summary=()=>({storyId:'image-story',key:doc.key,title:doc.title,generation,draftRevision:generation,reviewState:'draft',visibility:'private'});
      await context.route('**/*',route=>{
        const req=route.request(),url=new URL(req.url()),p=url.pathname,send=(json,status=200)=>route.fulfill({json,status});
        if(url.origin!==origin)return route.abort();
        if(p==='/auth/me')return send({email:'images@example.test',roles:['author']});
        if(p==='/api/author/home')return send({stories:doc?[summary()]:[]});
        if(p==='/api/author/collections/parents')return send([]);
        if(p==='/api/author/stories/import') {doc=req.postDataJSON();writes.push(doc);generation++;return send(summary());}
        if(p==='/api/author/stories/image-story'&&req.method()==='PUT') {const body=req.postDataJSON();assert.equal(body.generation,generation);doc=body.document;writes.push(doc);generation++;return send(summary());}
        if(p==='/api/author/stories/image-story/assets') {const upload=multipartImage(req);uploads.push(upload);return send({id:`image_${uploads.length}`,type:'image',url:`/uploads/image-story/image-${uploads.length}.png`});}
        if(p.startsWith('/uploads/image-story/')) {const index=Number(p.match(/image-(\d+)/)[1])-1;return route.fulfill({body:uploads[index].buffer,contentType:uploads[index].type});}
        if(p.startsWith('/auth/')||p.startsWith('/api/'))return send({notifications:[],unreadCount:0});
        let file=path.join(root,p.startsWith('/builder/')?'story-builder':'frontend',p.startsWith('/builder/')?p.slice(9):p.slice(1));
        if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
        return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404});
      });
      const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
      await page.goto(origin+'/builder/');await page.waitForFunction(()=>!document.body.classList.contains('builder-locked'));
      const source=await sourceImage(page,false),sceneFile=page.locator('#scenes input[type=file]').first();
      const before=await page.evaluate(()=>localStorage.getItem('fraerapp.storyBuilderDraft'));
      await sceneFile.setInputFiles(source);
      const preview=page.getByRole('dialog',{name:language==='ru'?'Проверьте изображение':'Check your image',exact:true});await preview.waitFor();
      assert.equal(await preview.locator('.image-preparation-frame').count(),3);
      const safe=await preview.locator('.image-preparation-safe').evaluate(node=>({left:parseFloat(node.style.left),width:parseFloat(node.style.width),top:parseFloat(node.style.top),height:parseFloat(node.style.height)}));
      assert.ok(safe.left>30&&safe.width<35&&safe.height>90,'Phone crop keeps the central part of a landscape image');
      assert.ok(await preview.evaluate(node=>node.scrollWidth<=node.clientWidth));
      await preview.getByRole('button',{name:language==='ru'?'Выбрать другое':'Choose another',exact:true}).click();
      await page.waitForFunction(()=>!document.querySelector('.image-preparation'));
      assert.equal(writes.length,0);assert.equal(uploads.length,0);
      assert.equal(await page.evaluate(()=>localStorage.getItem('fraerapp.storyBuilderDraft')),before,'Cancellation must not generate a key or save media');
      await sceneFile.setInputFiles(source);await preview.waitFor();
      await preview.getByRole('button',{name:language==='ru'?'Использовать изображение':'Use image',exact:true}).click();
      await page.waitForFunction(()=>JSON.parse(localStorage.getItem('fraerapp.storyBuilderDraft')).runtimeStory?.generation===2);
      assert.equal(uploads.length,1);assert.equal(writes.length,2);assert.match(doc.key,/^story_[a-f0-9]{32}$/);
      const image=await uploadedSize(page,uploads[0]);assert.ok(image.width<=1920&&image.height<=1080);assert.ok(uploads[0].buffer.length<=500*1024);assert.equal(image.alpha,255);
      assert.equal(doc.scenes[0].background,'image_1');assert.equal(doc.scenes[0].assets[0].url,'/uploads/image-story/image-1.png');
      await page.locator('#choose-story-cover').click();
      const cover=page.getByRole('dialog',{name:language==='ru'?'Обложка истории':'Story cover',exact:true});await cover.waitFor();
      const transparent=await sourceImage(page,true),coverFile=cover.locator('input[type=file]');
      const beforeCoverCancel=await page.evaluate(()=>localStorage.getItem('fraerapp.storyBuilderDraft'));
      await coverFile.setInputFiles(transparent);await preview.waitFor();assert.equal(await preview.locator('.image-preparation-frame').count(),3);
      assert.match(await preview.locator('.image-preparation-legend').innerText(),language==='ru'?/Карточка автора.*Телефон.*Страница истории/s:/Author card.*Phone.*Story page/s);
      await page.keyboard.press('Escape');await preview.waitFor({state:'detached'});assert.ok(await cover.isVisible());assert.equal(uploads.length,1);assert.equal(writes.length,2);
      await page.waitForFunction(()=>{const input=document.querySelector('.author-cover-dialog input[type=file]');return input&&!input.disabled&&!input.files.length;});
      assert.equal(await page.evaluate(()=>localStorage.getItem('fraerapp.storyBuilderDraft')),beforeCoverCancel,'Cancelling a cover upload preserves the exact author draft');
      await coverFile.setInputFiles(transparent);await preview.waitFor();
      if(language==='ru')await page.screenshot({path:`/private/tmp/fraer-image-preparation-${width}.png`});
      await preview.getByRole('button',{name:language==='ru'?'Использовать изображение':'Use image',exact:true}).click();
      await cover.waitFor({state:'detached'});
      assert.equal(uploads.length,2);assert.equal(writes.length,2,'Cover upload does not overwrite the draft before Save');
      const alpha=await uploadedSize(page,uploads[1]);assert.ok(alpha.width<=1920&&alpha.height<=1080);assert.ok(uploads[1].buffer.length<=500*1024);assert.equal(uploads[1].type,'image/png');assert.ok(alpha.alpha>0&&alpha.alpha<255,'PNG retains authored transparency');
      assert.equal(await page.locator('#builder-cover-preview').getAttribute('src'),'/uploads/image-story/image-2.png');
      assert.equal(await page.locator('.image-preparation').count(),0,'Accepted cover is prepared only once');
      await page.locator('#import-runtime').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('fraerapp.storyBuilderDraft')).runtimeStory.generation===3);
      assert.equal(doc.metadata.coverUrl,'/uploads/image-story/image-2.png');
      assert.equal(doc.metadata.schemaVersion,1,'Uploaded cover saves scenario metadata version 1');
      assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      console.log(width,language,'safe frames, cancellation, scene upload, cover upload, bounded bytes/dimensions, PNG alpha');
      await context.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
