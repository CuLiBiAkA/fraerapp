// Isolated browser fixtures; no live accounts, cookies, API writes or external network.
// NODE_PATH must expose Playwright if it is not installed in this checkout.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const {chromium}=createRequire(import.meta.url)("playwright");
const root=path.resolve(import.meta.dirname,"..");
const mutations=[],errors=[];
let conflict=false, reviewDelay=0, failTargets=false, hiddenMiddle=false,decisionConflict=false,reviewSelf=false;
const target=n=>({id:`chapter-${n}`,kind:"scenario",key:`chapter_${n}`,title:`Глава ${n}`,owned:true,visibility:"public",slug:`chapter-${n}`});
const documentValue={schemaVersion:1,key:"night-book",type:"story",title:"Ночной поезд — история с главами",description:"Три главы одной истории",completionStatus:"in_development",items:[1,2].map(n=>({target:target(n)})),transitions:[]};
let collection={id:"book",collectionId:"book",key:"night-book",type:"story",title:documentValue.title,generation:1,draftRevision:2,submittedRevision:2,publishedRevision:1,reviewState:"in_review",visibility:"public",draftDocument:documentValue,document:documentValue,events:[],versions:[{revision:1},{revision:2}]};
const session=id=>({sessionId:id,story:{key:id==="save-1"?"chapter_1":"chapter_2",title:id==="save-1"?"Глава 1":"Глава 2",authorName:"Автор"},scene:{id:"end",title:"Финал",text:"Глава пройдена",choices:[],ending:{title:"Финал"}},variables:{score:7},statsVariables:{score:7},status:id==="save-1"?"finished":"active"});
const run=()=>({id:"run-1",runId:"run-1",collectionId:"book",revision:1,availableRevision:1,generation:1,items:[{...target(1),sessionId:"save-1",status:"finished",allowIndependentStart:true},{...target(2),previousId:hiddenMiddle?null:"chapter-1",allowIndependentStart:hiddenMiddle}]});
const tree=()=>({...collection,kind:"collection",pendingCount:2,children:[{...target(1),reviewState:"in_review"},{...target(2),reviewState:"approved"}]});
const reviewGroup=()=>({tree:tree(),rootGeneration:collection.generation,canDecide:true,conflicts:[],items:[{kind:"collection",id:"book",generation:collection.generation,revision:2,document:documentValue,publishedDocument:null,self:false,approvalEligibility:{canApprove:true}},{kind:"scenario",id:"chapter-1",generation:4,revision:2,document:{key:"chapter_1",title:"Глава 1",scenes:[{id:"end",title:"Финал",text:"Новый текст главы",choices:[]}]},publishedDocument:null,self:false,approvalEligibility:{canApprove:true}}]});
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,"http://fixture");let input="";for await(const chunk of req)input+=chunk;const body=input?JSON.parse(input):{};
    const json=(value,status=200)=>{res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(value));};
    if(req.method!=="GET")mutations.push({path:url.pathname,body});
    if(url.pathname==="/auth/me")return json({id:"fixture-user",email:"fixture@example.test",roles:["player","author","admin"]});
    if(url.pathname==="/auth/refresh")return json({user:{email:"fixture@example.test",roles:["player","author","admin"]}});
    if(url.pathname==="/auth/telegram/login")return json({enabled:false});
    if(url.pathname==="/api/account")return json({avatar:"fairy",unreadCount:0,notifications:[]});
    if(url.pathname==="/api/author/home")return json({username:"Fixture",stories:[],stats:{}});
    if(url.pathname==="/api/author/stories"||url.pathname==="/api/catalog/stories"||url.pathname==="/api/sessions")return json([]);
    if(url.pathname==="/api/catalog/engagement")return json([]);
    if(url.pathname==="/api/catalog/stories/chapter-2")return json({slug:"chapter-2",key:"chapter_2",title:"Глава 2",description:"Продолжение",completionStatus:"completed"});
    if(url.pathname==="/api/catalog/engagement/chapter-2")return json({views:0,rating:null,endingCount:1,discoveredEndings:0});
    if(url.pathname==="/api/stories/chapter_2/sessions")return json([]);
    if(url.pathname==="/api/catalog/stories/chapter-2/entry-context")return json({allowIndependentStart:false,parents:[{id:"book",kind:"collection",key:"night-book",title:"Ночной поезд"}],prerequisites:[],sources:[{sourceSessionId:"save-1",relationId:"continuation",sourceTitle:"Глава 1",saveName:"Мой выбор"}]});
    if(url.pathname==="/api/sessions/save-1/relations/continuation/start")return json({session:session("save-2")});
    if(url.pathname==="/api/moderation/stories")return json({items:[],totalPages:0});
    if(url.pathname==="/api/author/folders")return json({items:[tree(),{...collection,kind:"collection",id:"other",collectionId:"other",key:"other",title:"Другое произведение",children:[]}],page:0,total:2});
    if(url.pathname==="/api/moderation/folders")return json({items:[tree()],page:0,total:1});
    if(url.pathname==="/api/moderation/folders/book/review"){const value=reviewGroup();if(reviewSelf)for(const item of value.items){item.self=true;item.approvalEligibility={canApprove:false,canOverride:true};}return json(value);}
    if(url.pathname==="/api/moderation/folders/book/decision"){if(decisionConflict){decisionConflict=false;return json({message:"Application changed"},409);}return json({items:body.items,atomic:true});}
    if(url.pathname==="/api/author/collections/targets"){if(failTargets){failTargets=false;return json({message:"Target list unavailable"},503);}return json([target(1),target(2),target(3),{...target(99),owned:false,title:"Чужая история"}]);}
    if(url.pathname==="/api/author/collections")return json([collection,{...collection,id:"other",collectionId:"other",key:"other",title:"Другое произведение"}]);
    if(url.pathname==="/api/author/collections/other")return json({...collection,id:"other",collectionId:"other",key:"other",title:"Другое произведение",draftDocument:{...documentValue,key:"other",title:"Другое произведение"}});
    if(url.pathname==="/api/moderation/collections")return json({items:[collection]});
    if(url.pathname==="/api/catalog/collections")return json([{...collection,items:[target(1),target(2)]}]);
    if(url.pathname.startsWith("/api/catalog/collections/"))return json({...collection,items:[target(1),target(2)]});
    if(url.pathname==="/api/collections/book/runs")return json(req.method==="GET"?[run(),{...run(),id:"run-2",runId:"run-2"}]:run());
    if(url.pathname==="/api/collection-runs/run-1")return json(run());
    if(url.pathname==="/api/collection-runs/run-2"){await new Promise(resolve=>setTimeout(resolve,180));const value=run();value.items[0].label="Другое прохождение";return json({...value,id:"run-2",runId:"run-2"});}
    if(url.pathname==="/api/collection-runs/run-1/start")return json({runId:"run-1",session:session("save-2")});
    if(url.pathname.match(/^\/api\/sessions\/[^/]+\/state$/))return json(session(url.pathname.split("/")[3]));
    if(url.pathname.match(/^\/api\/sessions\/[^/]+\/relations$/))return json({runId:"run-1",collection:{kind:"collection",id:"book",key:"night-book",title:documentValue.title},relations:[]});
    if(url.pathname==="/api/author/stories/import")return json({storyId:"chapter-new",key:body.key,draftRevision:1});
    const collectionMatch=url.pathname.match(/^\/api\/(author|moderation)\/collections\/book(.*)$/);
    if(collectionMatch){
      if(req.method==="PUT"){
        if(conflict){conflict=false;return json({message:"Concurrent edit"},409);}
        collection={...collection,...body.document,generation:collection.generation+1,draftRevision:collection.draftRevision+1,draftDocument:body.document,document:body.document};return json(collection);
      }
      if(collectionMatch[2]==="/preview")return json({revision:Number(url.searchParams.get("revision"))||collection.submittedRevision,document:collection.draftDocument,publishedDocument:documentValue,validation:{valid:true,errors:[]},dependencies:[{...target(1),requestedRevision:1,submittedRevision:2,reviewState:"in_review"}]});
      if(req.method==="POST"){if(collectionMatch[2]==="/review-batch"&&reviewDelay)await new Promise(resolve=>setTimeout(resolve,reviewDelay));return json(collection);}
      return json(collection);
    }
    let relative=url.pathname.startsWith("/builder/")?"story-builder/"+url.pathname.slice(9):"frontend"+url.pathname;
    if(relative.endsWith("/"))relative+="index.html";
    let file=path.resolve(root,relative);if(!file.startsWith(root+path.sep))return json({},404);
    if(!fs.existsSync(file)&&!path.extname(file))file=path.join(root,"frontend/index.html");
    if(!fs.existsSync(file))return json({},404);
    const mime={".html":"text/html",".js":"application/javascript",".css":"text/css",".svg":"image/svg+xml",".png":"image/png",".ttf":"font/ttf"}[path.extname(file)]||"application/octet-stream";
    let bytes=fs.readFileSync(file);if(file.endsWith("story-builder/index.html"))bytes=Buffer.from(bytes.toString().replace('data-prod-runtime="https://fraerapp.ru"','data-prod-runtime=""'));
    res.writeHead(200,{"Content-Type":mime});res.end(bytes);
  }catch(error){errors.push(error.message);res.writeHead(500);res.end("fixture failure");}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
try{
  for(const width of [1440,390,320]){
    const page=await browser.newPage({viewport:{width,height:900}});
    await page.route("**/*",route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    page.on("pageerror",error=>errors.push(error.message));page.on("dialog",dialog=>dialog.accept());
    await page.goto(`${origin}/my-stories/?collection=book`);
    await page.locator(".collection-editor h2").waitFor();
    await page.locator(".collection-editor").getByLabel("Название",{exact:true}).fill(`Изменённое название ${width}`);
    if(width===1440){
      assert.equal(await page.getByRole("button",{name:"Отправить на проверку",exact:true}).count(),1);
      assert.equal(await page.getByLabel("Добавить свою историю или папку",{exact:true}).locator('option').filter({hasText:"Чужая история"}).count(),0);
      conflict=true;await page.getByRole("button",{name:"Сохранить",exact:true}).click();
      await page.getByRole("status").filter({hasText:"Данные или условия"}).waitFor();
      assert.equal(await page.locator(".collection-editor").getByLabel("Название",{exact:true}).inputValue(),`Изменённое название ${width}`);
    }
    await page.getByRole("button",{name:"Сохранить",exact:true}).click();
    await page.getByRole("status").filter({hasText:"Черновик сохранён"}).waitFor();
    assert.equal(collection.title,`Изменённое название ${width}`);
    if(width===1440){
      reviewDelay=500;
      await page.getByRole("button",{name:"Отправить на проверку",exact:true}).click();
      await page.waitForFunction(()=>document.querySelector("main.collections-panel").inert);
      await page.waitForResponse(response=>response.url().endsWith("/review-batch"));
      await page.waitForFunction(()=>!document.querySelector("main.collections-panel").inert);reviewDelay=0;
      failTargets=true;
      const other=page.locator(".collection-card").filter({hasText:"Другое произведение"});await other.locator('summary').click();await other.getByRole("button",{name:"Открыть папку",exact:true}).click();
      await page.getByRole("status").filter({hasText:"Target list unavailable"}).waitFor();
      await page.locator(".collection-editor").getByLabel("Название",{exact:true}).fill("Сохраняется прежнее произведение");
      await page.getByRole("button",{name:"Сохранить",exact:true}).click();
      await page.getByRole("status").filter({hasText:"Черновик сохранён"}).waitFor();
      assert.equal(mutations.filter(m=>m.path.startsWith("/api/author/collections/")&&m.body.document).at(-1).path,"/api/author/collections/book");
    }
    await page.locator(".collection-editor .collection-items button").filter({hasText:"↓ Ниже"}).first().click();
    assert.match(await page.locator(".collection-editor .collection-items h4").first().textContent(),/Глава 2/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Author overflow at ${width}`);
    await page.goto(`${origin}/builder/`);
    if(width===1440){
      const imported={key:"nullable-links",title:"Nullable metadata",startSceneId:"end",variables:{},assets:[],scenes:[{id:"end",title:"End",text:"End",choices:[],ending:{type:"ending"}}],metadata:{schemaVersion:1,relations:[{id:"info",type:"related",target:{kind:"scenario",key:"chapter_2"},stateTransfer:null}],inputContract:{version:1,allowIndependentStart:true,fields:null}}};
      await page.locator("#import-file").setInputFiles({name:"nullable.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(imported))});
    }
    await page.locator("#relations-editor").waitFor({state:"attached"});
    await page.getByText("Связи и главы / Relations and chapters",{exact:true}).click();
    if(await page.getByRole("button",{name:"Настроить входные параметры"}).count())await page.getByRole("button",{name:"Настроить входные параметры"}).click();
    if(width===1440)assert.equal(await page.locator('#relations-editor select').filter({has:page.locator('option[value="reference"]')}).first().inputValue(),"reference");
    await page.getByRole("button",{name:"+ Входной параметр",exact:true}).click();
    assert.equal(await page.getByLabel("Обязателен при переносе").count(),1);
    await page.getByRole("button",{name:"Найти истории для связи"}).click();
    assert.equal(await page.getByLabel("Произведение",{exact:true}).locator('option').filter({hasText:"Чужая история"}).count(),0);
    await page.getByRole("button",{name:"+ Добавить связь",exact:true}).click();
    await page.getByRole("button",{name:"+ Добавить связь",exact:true}).waitFor();
    if(!await page.locator(".collection-transfer select").count()) console.log(await page.locator("#relations-editor").innerText(),errors);
    await page.locator("#relations-editor .collection-transfer select").filter({has:page.locator('option[value="mapped"]')}).last().selectOption("mapped");
    await page.getByRole("button",{name:"+ Параметр",exact:true}).click();
    await page.getByLabel("Откуда",{exact:true}).fill("score");await page.getByLabel("Куда",{exact:true}).fill("courage");
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Builder overflow at ${width}`);
    await page.goto(`${origin}/collections/night-book`);
    await page.getByRole("heading",{name:"Продолжить чтение",exact:true}).waitFor();
    await page.goto(`${origin}/moderation/?collection=book`);
    await page.getByRole("button",{name:"Одобрить и опубликовать заявку",exact:true}).waitFor();
    assert.equal(await page.getByRole("button",{name:"Одобрить и опубликовать заявку",exact:true}).isDisabled(),true);
    for(const part of await page.locator('.folder-review-part').all()){
      await part.locator(':scope > summary').click();await part.getByLabel("Эту часть проверил(а)",{exact:true}).check();
    }
    assert.equal(await page.getByRole("button",{name:"Одобрить и опубликовать заявку",exact:true}).isEnabled(),true);
    if(width===1440){
      decisionConflict=true;await page.getByRole("button",{name:"Одобрить и опубликовать заявку",exact:true}).click();
      await page.getByRole("status").filter({hasText:"Данные или условия"}).waitFor();
      assert.equal(await page.locator('.folder-review-part input:checked').count(),2);
    }
    await page.getByRole("button",{name:"Одобрить и опубликовать заявку",exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('.collection-editor').inert);
    const decision=mutations.filter(m=>m.path==="/api/moderation/folders/book/decision").at(-1);assert.equal(decision.body.items.length,2);assert.equal(decision.body.items[1].revision,2);assert.equal(decision.body.items.some(i=>i.id==="chapter-2"),false);assert.ok(decision.body.reason);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Folder moderation overflow at ${width}`);
    await page.screenshot({path:`/tmp/fraer-folders-moderation-${width}.png`,fullPage:true});
    if(width===1440){
      reviewSelf=true;await page.goto(`${origin}/moderation/?collection=book`);
      await page.getByRole("button",{name:"Одобрить и опубликовать заявку",exact:true}).waitFor();
      for(const part of await page.locator('.folder-review-part').all()){await part.locator(':scope > summary').click();await part.getByLabel("Эту часть проверил(а)",{exact:true}).check();}
      assert.equal(await page.getByRole("button",{name:"Одобрить и опубликовать заявку",exact:true}).isDisabled(),true);
      await page.getByLabel("Администратор: разрешить проверку своих работ с указанной причиной",{exact:true}).check();
      const countBefore=mutations.filter(m=>m.path==="/api/moderation/folders/book/decision").length;
      await page.getByRole("button",{name:"Одобрить и опубликовать заявку",exact:true}).click();
      await page.getByRole("status").filter({hasText:"Напишите причину решения"}).waitFor();
      assert.equal(mutations.filter(m=>m.path==="/api/moderation/folders/book/decision").length,countBefore);
      await page.getByLabel("Замечания автору",{exact:true}).fill("Проверено администратором");
      await page.getByRole("button",{name:"Одобрить и опубликовать заявку",exact:true}).click();
      await page.waitForFunction(()=>!document.querySelector('.collection-editor').inert);
      assert.equal(mutations.filter(m=>m.path==="/api/moderation/folders/book/decision").at(-1).body.ownOverride,true);reviewSelf=false;
    }
    await page.goto(`${origin}/collections/night-book`);
    await page.getByRole("heading",{name:"Продолжить чтение",exact:true}).waitFor();
    if(width===1440){
      const picker=page.locator('select').filter({has:page.locator('option[value="run-2"]')});
      await picker.selectOption("run-2");await picker.selectOption("run-1");
      await page.waitForResponse(response=>response.url().endsWith("/api/collection-runs/run-2"));
      assert.equal(await page.getByText("Другое прохождение",{exact:true}).count(),0);
      const start=page.getByRole("button",{name:"Начать новое прохождение",exact:true});
      for(let i=0;i<2;i++){
        const response=page.waitForResponse(response=>response.url().endsWith("/api/collections/book/runs")&&response.request().method()==="POST");
        await start.click();await response;await page.waitForFunction(()=>![...document.querySelectorAll('button')].find(b=>b.textContent==='Начать новое прохождение')?.disabled);
      }
      const starts=mutations.filter(m=>m.path==="/api/collections/book/runs");assert.equal(starts.length,2);assert.notEqual(starts[0].body.requestId,starts[1].body.requestId);
    }
    await page.getByRole("button",{name:"Продолжить сохранение",exact:true}).click();
    await page.getByRole("button",{name:"Следующая глава →",exact:true}).click();
    await page.waitForURL(url=>url.pathname==="/read/save-2");
    assert.ok(mutations.some(m=>m.path==="/api/collection-runs/run-1/start"&&m.body.sourceSessionId==="save-1"));
    if(width===1440){
      hiddenMiddle=true;
      await page.goto(`${origin}/read/save-1?run=run-1`);
      await page.getByRole("button",{name:"Следующая глава →",exact:true}).click();
      await page.waitForURL(url=>url.pathname==="/read/save-2");
      assert.equal(mutations.filter(m=>m.path==="/api/collection-runs/run-1/start").at(-1).body.sourceSessionId,undefined);
      hiddenMiddle=false;
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Reader overflow at ${width}`);
    await page.goto(`${origin}/history/chapter-2`);
    await page.getByText("Эта глава продолжает предыдущее прохождение.",{exact:false}).waitFor();
    assert.equal(await page.locator("#story-detail-action").isDisabled(),true);
    await page.getByRole("button",{name:"Продолжить из выбранного сохранения",exact:true}).click();
    await page.waitForURL(url=>url.pathname==="/read/save-2");
    assert.ok(mutations.some(m=>m.path==="/api/sessions/save-1/relations/continuation/start"));
    if(width===1440){
      await page.goto(`${origin}/moderation/?view=collections&collection=book&revision=1`);
      await page.getByText("Приватное превью · редакция 1",{exact:true}).waitFor();
      assert.equal(await page.locator('.collection-editor select').filter({has:page.locator('option[value="submitted"]')}).inputValue(),"1");
      await page.getByText("Связанные заявки этой редакции",{exact:true}).click();
      await page.getByText("Отправлена с оглавлением: v1",{exact:false}).waitFor();
      assert.match(await page.getByRole("link",{name:"Открыть заявку",exact:true}).getAttribute("href"),/revision=1/);
    }
    await page.close();
    console.log(`PASS chapters UI at ${width}px: save/conflict/inert, order, contracts, direct-entry, continuation`);
  }
  assert.deepEqual(errors,[]);console.log("PASS no browser exceptions or fixture failures");
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
