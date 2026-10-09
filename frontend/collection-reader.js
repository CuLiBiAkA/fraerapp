import {el,link,button,field,select,words,typeName,request,errorMessage} from "./collection-ui.js?v=4";

export function createCollectionReader({screen,sceneScreen,showScreen,navigate,onSession,signedIn,signIn,onFavoriteChange}) {
  let generation=0, navGeneration=0, lastCollection=null;
  const runRequests=new WeakMap();
  const chapterNav=el("section",null,"chapter-navigation collection-reader hidden");chapterNav.setAttribute("aria-label",words("Главы и продолжения", "Chapters and continuations"));sceneScreen.querySelector(".story-panel").append(chapterNav);
  const route=item=>item.kind==="scenario"?`/history/${encodeURIComponent(item.slug||item.key)}`:`/collections/${encodeURIComponent(item.key||item.id||item.collectionId)}`;
  const href=(text,url)=>{const a=link(text,url);a.onclick=event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(url);};return a;};
  const statusNode=()=>{const p=el("p","","collection-status");p.setAttribute("role","status");return p;};
  function action(text,run,status){
    const b=button(text,async()=>{if(b.disabled)return;b.disabled=true;status.textContent=words("Загружаем…", "Loading…");try{await run();status.textContent="";}catch(error){status.textContent=errorMessage(error);}finally{b.disabled=false;}});return b;
  }
  function play(result,runId){onSession(result.session||result,result.runId||runId);}
  const sourceFor=(item,previous)=>previous?.id===item.previousId&&previous.status==="finished"?previous.sessionId:undefined;
  async function open(key){
    ++generation;const seq=generation;showScreen(screen);screen.replaceChildren(href(words("← В библиотеку", "← Library"),"/history"));
    const status=statusNode();screen.append(status);status.textContent=words("Загружаем оглавление…", "Loading contents…");
    try{
      const data=await request(`/api/catalog/collections/${encodeURIComponent(key)}`);if(seq!==generation)return;lastCollection=data;
      status.textContent="";screen.append(el("span",typeName(data.type),"collection-badge"),el("h1",data.title),el("p",data.description||""));
      if(data.genre)screen.append(el("p",data.genre));
      if(data.coverUrl?.startsWith("/assets/")&&!data.coverUrl.includes("..")){const img=el("img",null,"collection-cover");img.src=data.coverUrl;img.alt=data.title;screen.append(img);}
      const breadcrumbs=el("nav");breadcrumbs.setAttribute("aria-label",words("Путь произведения", "Work path"));
      for(const parent of data.parents||data.breadcrumbs||[])breadcrumbs.append(href(`${parent.title} / `,route(parent)));screen.append(breadcrumbs);
      screen.append(el("p",data.completionStatus==="completed"?words("Завершена автором", "Completed by the author"):data.completionStatus==="abandoned"?words("Приостановлена", "Paused"):words("В разработке", "In progress")));
      const actions=el("div",null,"collection-actions");
      const favorite=action(data.favorite?words("♥ В избранном", "♥ Favorited"):words("♡ В избранное", "♡ Favorite"),async()=>{if(!signedIn()){signIn();return;}await request(`/api/catalog/collections/${data.collectionId||data.id}/favorite`,{method:"PUT",body:{favorite:!data.favorite}});data.favorite=!data.favorite;onFavoriteChange?.();favorite.textContent=data.favorite?words("♥ В избранном", "♥ Favorited"):words("♡ В избранное", "♡ Favorite");},status);actions.append(favorite);screen.append(actions);
      const contents=el("section");screen.append(contents);
      const list=el("ol");let season="";for(const item of data.items||[]){const li=el("li");if(item.season&&item.season!==season)li.append(el("h3",item.season));season=item.season||"";li.append(data.schemaVersion===2?el("span",item.label||item.title||item.key):href(item.label||item.title||item.key,route(item)));list.append(li);}contents.append(el("h2",words("Главы", "Chapters")),list);
      if(!data.items?.length)contents.append(el("p",words("Доступных частей пока нет.", "No parts are available yet.")));
      if(data.items?.some(item=>item.kind==="scenario")&&signedIn()){
        const runPanel=el("section");screen.append(runPanel);
        const id=data.collectionId||data.id;
        const runs=await request(`/api/collections/${id}/runs`);if(seq!==generation)return;
        const available=Array.isArray(runs)?runs:runs.items||[];
        let newRequest=crypto.randomUUID();
        actions.append(action(available.length?words("Начать сначала", "Start again"):words("Начать", "Start"),async()=>{
          if(available.length&&!confirm(words("Начать отдельное прохождение? Предыдущие сохранения останутся.", "Start a separate run? Existing saves will remain.")))return;
          const run=await request(`/api/collections/${id}/runs`,{method:"POST",body:{requestId:newRequest}});newRequest=crypto.randomUUID();
          if(data.schemaVersion===2&&run.items?.[0]&&run.items[0].allowIndependentStart!==false){play(await request(`/api/collection-runs/${run.id||run.runId}/start`,{method:"POST",body:{targetId:run.items[0].id,requestId:crypto.randomUUID()}}));}
          else await renderRun(run.id||run.runId,runPanel);
        },status));
        if(available.length){
          const picker=select(words("Ваши прохождения", "Your runs"),available.map((r,i)=>[r.id||r.runId,`${words("Прохождение", "Run")} ${available.length-i} · ${r.updatedAt||r.createdAt||r.id}`]),available[0].id||available[0].runId);
          picker.input.onchange=()=>renderRun(picker.input.value,runPanel).catch(error=>{status.textContent=errorMessage(error);});screen.insertBefore(picker.label,runPanel);await renderRun(picker.input.value,runPanel);
        }
      }else if(data.items?.some(item=>item.kind==="scenario"))actions.append(action(words("Войти и читать", "Sign in to read"),async()=>signIn(),status));
    }catch(error){if(seq===generation){status.textContent=errorMessage(error);if(error.status===401)screen.append(action(words("Войти", "Sign in"),async()=>signIn(),status));}}
  }
  async function renderRun(id,host){
    const seq=(runRequests.get(host)||0)+1;runRequests.set(host,seq);
    const run=await request(`/api/collection-runs/${encodeURIComponent(id)}`);
    if(!host.isConnected||runRequests.get(host)!==seq)return;host.replaceChildren();
    const status=statusNode();host.append(el("h2",words("Продолжить чтение", "Continue reading")),status);
    const items=run.items||[], finished=items.filter(item=>String(item.status).toLowerCase()==="finished").length;
    const nextIndex=items.findIndex(item=>item.status!=="finished"),next=items[nextIndex];
    if(next&&(next.sessionId||next.allowIndependentStart!==false||sourceFor(next,items[nextIndex-1]))){
      const requestId=crypto.randomUUID();host.append(action(words("Продолжить", "Continue"),async()=>{
        if(next.sessionId)play(await request(`/api/sessions/${next.sessionId}/state`),id);
        else play(await request(`/api/collection-runs/${id}/start`,{method:"POST",body:{targetId:next.id,sourceSessionId:sourceFor(next,items[nextIndex-1]),requestId}}));
      },status));
    }
    host.append(el("p",words(`Пройдено ${finished} из ${items.length} доступных глав`,`${finished} of ${items.length} available chapters completed`)));
    if(items.length&&finished===items.length)host.append(el("p",run.completionStatus==="completed"?words("История пройдена.", "Story completed."):words("Вы прочитали все вышедшие главы. Продолжение готовится.", "You have read all released chapters. More chapters are on the way.")));
    if(run.availableRevision&&run.availableRevision!==run.revision){
      host.append(action(words("Доступно новое оглавление — обновить", "New contents available — update"),async()=>{
        await request(`/api/collection-runs/${id}/update-toc`,{method:"POST",body:{generation:run.generation}});await renderRun(id,host);
      },status));
    }
    const list=el("ol");
    items.forEach((item,i)=>{
      const li=el("li"), row=el("div",null,"collection-actions");if(item.season&&item.season!==items[i-1]?.season)li.append(el("h3",item.season));li.append(el("strong",item.label||item.title||item.key));
      if(item.sessionId){
        row.append(action(words("Продолжить сохранение", "Continue save"),async()=>play(await request(`/api/sessions/${item.sessionId}/state`),id),status));
        const replayRequest=crypto.randomUUID();
        row.append(action(words("Переиграть в новой ветке", "Replay in a new branch"),async()=>{
          if(!confirm(words("Создать новую ветку с этой главы? Текущее прохождение сохранится.", "Create a new branch from this chapter? The current run will remain.")))return;
          play(await request(`/api/collection-runs/${id}/start`,{method:"POST",body:{targetId:item.id||item.storyId||item.target?.id,sourceSessionId:sourceFor(item,items[i-1]),requestId:replayRequest,newAttempt:true}}));
        },status));
      }
      else{
        const requestId=crypto.randomUUID();
        const start=action(words("Начать главу", "Start chapter"),async()=>{
          const result=await request(`/api/collection-runs/${id}/start`,{method:"POST",body:{targetId:item.id||item.storyId||item.target?.id,sourceSessionId:sourceFor(item,items[i-1]),requestId}});play(result);
        },status);
        start.disabled=item.allowIndependentStart===false&&!sourceFor(item,items[i-1]);row.append(start);
        if(start.disabled)row.append(el("p",words("Для этой главы нужно доступное завершённое прохождение предыдущей части.", "This chapter needs an available completed prerequisite.")));
      }
      li.append(row);list.append(li);
    });host.append(list);
  }
  async function session(state){
    const seq=++navGeneration;chapterNav.replaceChildren();chapterNav.classList.add("hidden");
    try{
      const contextRun=new URLSearchParams(location.search).get("run");
      const data=await request(`/api/sessions/${encodeURIComponent(state.sessionId)}/relations${contextRun?`?runId=${encodeURIComponent(contextRun)}`:""}`);if(seq!==navGeneration)return;
      const status=statusNode();
      if(data.collection){chapterNav.append(el("strong",`${data.collection.title} · ${state.story.title}`),href(words("Оглавление истории", "Story contents"),route(data.collection)));}
      if(data.runId){
        const run=await request(`/api/collection-runs/${data.runId}`);if(seq!==navGeneration)return;
        const index=(run.items||[]).findIndex(item=>item.sessionId===state.sessionId);
        const next=run.items?.[index+1];
        if(index>=0&&state.status==="finished"&&next&&(next.sessionId||next.allowIndependentStart!==false||next.previousId===run.items[index].id)){
          const requestId=crypto.randomUUID();chapterNav.append(action(words("Следующая глава →", "Next chapter →"),async()=>{
            if(next.sessionId)play(await request(`/api/sessions/${next.sessionId}/state`),data.runId);
            else play(await request(`/api/collection-runs/${data.runId}/start`,{method:"POST",body:{targetId:next.id||next.storyId||next.target?.id,sourceSessionId:next.previousId===run.items[index].id?state.sessionId:undefined,requestId}}));
          },status));
        }else if(index>=0&&state.status==="finished")chapterNav.append(el("p",words("Вы прочитали доступные главы этого оглавления.", "You have read the available chapters in these contents.")));
      }
      for(const relation of data.relations||[]){
        const target=relation.target||{};if(!target.key&&!target.slug&&!target.id)continue;
        chapterNav.append(href(relation.label||target.title||words("Связанная история", "Related story"),route(target)));
        if(state.status==="finished"&&target.kind==="scenario"&&relation.stateTransfer&&relation.type!=="related"&&relation.type!=="prequel"){
          const requestId=crypto.randomUUID();chapterNav.append(action(relation.stateTransfer?.mode==="mapped"?words("Продолжить с выбранными параметрами", "Continue with transferred values"):words("Начать продолжение", "Start the continuation"),async()=>play(await request(`/api/sessions/${state.sessionId}/relations/${encodeURIComponent(relation.id)}/start`,{method:"POST",body:{requestId}})),status));
          const replayId=crypto.randomUUID();chapterNav.append(action(words("Новое прохождение продолжения", "New continuation attempt"),async()=>{
            if(!confirm(words("Начать продолжение заново из этого сохранения? Прежнее прохождение останется.", "Start the continuation again from this save? The previous attempt will remain.")))return;
            play(await request(`/api/sessions/${state.sessionId}/relations/${encodeURIComponent(relation.id)}/start`,{method:"POST",body:{requestId:replayId,newAttempt:true}}));
          },status));
        }
      }
      if(chapterNav.childElementCount){chapterNav.append(status);chapterNav.classList.remove("hidden");}
    }catch(error){if(seq===navGeneration&&error.status!==404){chapterNav.append(el("p",errorMessage(error)));chapterNav.classList.remove("hidden");}}
  }
  function storyEntry(story){
    let host=document.querySelector("#story-entry-context");
    if(!host){host=el("section",null,"chapter-navigation");host.id="story-entry-context";document.querySelector("#story-detail-description").after(host);}
    host.replaceChildren();host.hidden=true;
    const context=story.entryContext;
    const main=document.querySelector("#story-detail-action"),restart=document.querySelector("#story-detail-restart");
    main.disabled=false;restart.disabled=false;
    if(!context)return;
    const status=statusNode();
    if(context.allowIndependentStart===false){
      host.append(el("p",words("Эта глава продолжает предыдущее прохождение. Откройте оглавление или выберите завершённое сохранение ниже.", "This chapter continues an earlier run. Open the contents or select a completed save below.")));
      main.disabled=!story.lastSessionId||story.lastSessionStatus==="finished";restart.disabled=true;
    }
    for(const parent of context.parents||[])host.append(href(`${words("Оглавление", "Contents")}: ${parent.title}`,route(parent)));
    for(const prior of context.prerequisites||[])host.append(href(`${words("Предыдущая история", "Previous story")}: ${prior.title||prior.sourceTitle||prior.key}`,route({...prior,kind:prior.kind||"scenario"})));
    if(context.sources?.length){
      const source=select(words("Завершённое сохранение", "Completed save"),context.sources.map((s,i)=>[String(i),`${s.sourceTitle||s.title||s.sourceSlug||words("Прохождение", "Run")} · ${s.saveName||s.sourceSessionId}`]),"0");
      let requestId=crypto.randomUUID();source.input.onchange=()=>{requestId=crypto.randomUUID();};
      host.append(source.label,action(words("Продолжить из выбранного сохранения", "Continue from selected save"),async()=>{
        const chosen=context.sources[Number(source.input.value)];
        play(await request(`/api/sessions/${encodeURIComponent(chosen.sourceSessionId)}/relations/${encodeURIComponent(chosen.relationId)}/start`,{method:"POST",body:{requestId}}));
      },status));
      let replayId=crypto.randomUUID();
      host.append(action(words("Начать заново из выбранного сохранения", "Start again from selected save"),async()=>{
        if(!confirm(words("Создать новое прохождение? Прежнее сохранится.", "Create a new attempt? The previous one will remain.")))return;
        const chosen=context.sources[Number(source.input.value)];
        const result=await request(`/api/sessions/${encodeURIComponent(chosen.sourceSessionId)}/relations/${encodeURIComponent(chosen.relationId)}/start`,{method:"POST",body:{requestId:replayId,newAttempt:true}});replayId=crypto.randomUUID();play(result);
      },status));
    }
    host.hidden=!host.childElementCount;host.append(status);
  }
  return {open,session,storyEntry,close(){generation++;screen.classList.add("hidden");}, refresh(){if(lastCollection)return open(lastCollection.key);}};
}
