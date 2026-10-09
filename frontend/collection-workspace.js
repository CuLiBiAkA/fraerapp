import {el,link,button,field,select,checkbox,words,typeName,request,errorMessage,download,targetKey,moveItem} from "./collection-ui.js?v=5";
import {reviewLimitMessage} from "./review-limit.js?v=1";
import {workflowLabel, renderDocumentDiff} from "./story-workflow.js?v=1";
import {renderFolderReview} from "./folder-review.js?v=3";
import {authorCard,coverImage,editorTabs,showAuthoringPrompts} from "./author-ui.js?v=1";
import {chooseCover,uploadImage} from "./author-cover.js?v=1";

const params = new URLSearchParams(location.search);
try { document.documentElement.lang = localStorage.getItem("fraerapp.language") === "en" ? "en" : "ru"; } catch { document.documentElement.lang = "ru"; }
const moderation = document.body.dataset.workspace === "moderation";
const path = moderation ? "/moderation/" : "/my-stories/";
const selectedView = !params.has("story") && params.get("view") !== "stories";
const switcher = el("nav",null,"workspace-nav author-section-nav"); switcher.style.padding = "18px 28px 0";
switcher.setAttribute("aria-label",words("Разделы произведений", "Work sections"));
switcher.append(link(words("Истории", "Stories"),path),link(words("Все истории списком", "All stories as a list"),`${path}?view=stories`));
if(moderation)document.body.prepend(switcher);
if (selectedView) {
  document.querySelector("#workspace").hidden = true;
  const root = el("main",null,"workspace collections-panel"); document.body.append(root);
  start(root).catch(error => root.append(el("p",errorMessage(error),"collection-status error"),link(words("На главную", "Home"),"/")));
}

async function start(root) {
  const user = await request("/auth/me");
  const roles = user.roles || []; let canEdit = roles.includes("author") || roles.includes("admin");
  if (user.blocked || (moderation && !roles.some(role => ["admin","moderator"].includes(role)))) throw Object.assign(new Error(),{status:403});
  const api = moderation ? "/api/moderation/collections" : "/api/author/collections";
  let all = [], current = null, doc = null, targets = [], dirty = false, busy = false, openRequest = 0, pageIndex=0, totalPages=0, targetSearch="", targetPage=0;
  let tabKey="chapters",trash=params.get("trash")==="1",screen="list",historyIndex=0,restoringHistory=false,lastOpened=null,permissionNotice="";
  history.replaceState({...history.state,authorIndex:0},"",location.href);
  const heading = el("h1",words(moderation ? "Заявки на публикацию" : "Мои истории",moderation ? "Publication applications" : "My stories"));
  const status = el("p","","collection-status"); status.setAttribute("role","status");
  const toolbar = el("form",null,"collection-toolbar");
  const query = field(words("Поиск", "Search"),"","search");
  const state = select(words("Состояние", "Status"),["all","in_review","draft","approved","rejected","public","unlisted","private","hidden","archived"].map(k=>[k,workflowLabel(k,document.documentElement.lang)]),params.get("status")||(moderation?"in_review":"all"));
  query.input.value=params.get("q")||"";
  const refresh = button(words("Обновить список", "Refresh list"),()=>work(loadList));
  toolbar.append(query.label,state.label,refresh);
  const grid = el("div",null,"collection-grid"), list = el("section",null,"collection-list"), editor = el("section",null,"collection-editor");
  list.id = "folder-list"; document.querySelector(".skip-link")?.setAttribute("href","#folder-list");list.setAttribute("aria-label",words("Истории", "Stories"));
  editor.append(el("h2",words("История состоит из глав", "A story contains chapters")),el("p",moderation?words("Откройте заявку истории. Проверьте новые и изменённые главы; уже опубликованные главы остаются на месте.","Open a story application to review its new and changed parts. Previously published parts stay in place."):words("Создайте историю с общей обложкой и описанием. Добавляйте главы по мере написания: каждая открывается в конструкторе со своими сценами. Выбор читателя сохраняется между главами автоматически.","Create a story with a shared cover and description. Add chapters as you write; each opens in the scene builder. Reader choices carry over automatically.")));
  const pagination=el("nav",null,"collection-actions");pagination.setAttribute("aria-label",words("Страницы произведений", "Work pages"));
  const previous=button(words("← Назад", "← Previous"),()=>work(async()=>{pageIndex--;await loadList();}));
  const next=button(words("Далее →", "Next →"),()=>work(async()=>{pageIndex++;await loadList();}));const pageLabel=el("span");pagination.append(previous,pageLabel,next);
  const listColumn=el("div",null,"author-list-screen");listColumn.append(list,pagination);
  const titleRow=el("div",null,"author-title-row"); titleRow.append(heading);
  const utilities=el("div",null,"author-utilities");
  const activeButton=button(words("Истории","Stories"),()=>switchTrash(false)),trashButton=button(words("Корзина","Trash"),()=>switchTrash(true));
  utilities.append(activeButton,trashButton);
  const back=button(words("← К моим историям","← My stories"),()=>{if(!discard())return;dirty=false;if(historyIndex>0)history.back();else{writeUrl(false,null);showScreen("list",true);}});
  if(moderation)back.textContent=words("← К заявкам","← Applications");back.className="author-back";back.hidden=true;
  grid.append(listColumn,editor); root.append(titleRow,back,toolbar,utilities,status,grid);
  const changed = () => { dirty = true; status.textContent = words("Есть несохранённые изменения в форме.", "There are unsaved changes in this form."); };
  const discard = () => !dirty || confirm(words("В форме есть несохранённые изменения. Перейти без сохранения?", "This form has unsaved changes. Leave without saving?"));
  window.addEventListener("beforeunload",event=>{if(dirty){event.preventDefault();event.returnValue="";}});
  window.addEventListener("focus",()=>{if(!busy)refreshReviewEligibility().catch(error=>{status.textContent=errorMessage(error);status.classList.add("error");});});
  root.addEventListener("click",event=>{
    const anchor=event.target.closest("a[href]");
    if(!anchor||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||anchor.hasAttribute("download")||(anchor.target&&anchor.target!=="_self"))return;
    const destination=new URL(anchor.href,location.href);if(destination.origin===location.origin&&destination.pathname===location.pathname&&destination.search===location.search)return;
    if(dirty&&!discard())event.preventDefault();else dirty=false;
  });
  window.addEventListener("popstate",()=>{
    const nextIndex=history.state?.authorIndex??0;
    if(restoringHistory){restoringHistory=false;return;}
    if(busy||editor.inert){restoringHistory=true;history.go(historyIndex-nextIndex);status.textContent=words("Дождитесь завершения текущего действия, затем вернитесь к списку.","Wait for the current action to finish, then return to the list.");return;}
    if(!discard()){restoringHistory=true;history.go(historyIndex-nextIndex);return;}
    dirty=false;historyIndex=nextIndex;
    const nextParams=new URLSearchParams(location.search),id=nextParams.get("collection");
    trash=nextParams.get("trash")==="1";query.input.value=nextParams.get("q")||"";state.input.value=nextParams.get("status")||(moderation?"in_review":"all");
    if(id==="new")work(()=>createNew(false));else if(id)work(()=>open(id,false));else {current=null;doc=null;showScreen("list");work(async()=>{await loadList();showScreen("list",true);});}
  });
  function writeUrl(push,id){
    const next=new URLSearchParams();if(query.input.value)next.set("q",query.input.value);if(state.input.value!==(moderation?"in_review":"all"))next.set("status",state.input.value);if(trash)next.set("trash","1");if(id)next.set("collection",id);
    if(push)historyIndex++;history[push?"pushState":"replaceState"]({authorIndex:historyIndex},"",`${path}${next.size?`?${next}`:""}`);
  }
  function showScreen(value,focus=false){
    screen=value;root.dataset.screen=value;listColumn.hidden=value!=="list";editor.hidden=value!=="editor";toolbar.hidden=utilities.hidden=titleRow.hidden=value!=="list";back.hidden=value!=="editor";
    document.querySelector(".skip-link")?.setAttribute("href",value==="editor"?"#author-editor":"#folder-list");
    if(focus)requestAnimationFrame(()=>{const target=value==="editor"?editor.querySelector("h2"):list.querySelector(`[data-work-id="${CSS.escape(lastOpened||"")}"]`)||heading;target?.focus();window.scrollTo({top:0,behavior:"instant"});});
  }
  editor.id="author-editor";heading.tabIndex=-1;showScreen("list");
  async function switchTrash(value){trash=value;pageIndex=0;writeUrl(false,null);await work(loadList);}
  async function refreshReviewEligibility(){
    if(moderation)return;
    const session=await request("/auth/me"),allowed=!session.blocked&&(session.roles||[]).some(role=>["author","admin"].includes(role));
    root.querySelectorAll("[data-author-mutation]").forEach(control=>control.disabled=!allowed);
    permissionNotice=allowed?"":dirty?words("Право редактирования изменилось. Ваш текст остаётся в форме; скопируйте его перед выходом.","Editing permission changed. Your text remains in the form; copy it before leaving."):words("Только чтение. Для создания и изменения историй нужна роль автора.","Read only. Creating and editing stories requires the author role.");
    if(canEdit!==allowed){canEdit=allowed;if(screen==="editor"){
      editor.querySelectorAll("input,textarea").forEach(control=>control.readOnly=!allowed);
      editor.querySelectorAll("select,button:not([role=tab])").forEach(control=>control.disabled=!allowed);
      editor.querySelectorAll('a[href^="/builder/"]').forEach(control=>control.hidden=!allowed);
      if(!allowed)status.textContent=permissionNotice;
      else renderEditor();
    }}
    if(!current)return;
    const id=current.collectionId,seq=openRequest;
    const detail=await request(`${api}/${encodeURIComponent(id)}`);
    if(seq!==openRequest||current?.collectionId!==id)return;
    current.reviewLimitReached=detail.reviewLimitReached;
    editor.querySelectorAll("[data-review-submit]").forEach(control=>{control.disabled=!canEdit||Boolean(detail.reviewLimitReached);});
    const notice=editor.querySelector(".review-limit-notice");if(notice)notice.hidden=!detail.reviewLimitReached;
  }
  async function work(action) {
    if (busy) return; busy=true; root.inert=true; root.setAttribute("aria-busy","true"); status.textContent=words("Выполняем…", "Working…"); status.classList.remove("error");
    try { await action(); }
    catch(error) {
      status.replaceChildren(document.createTextNode(errorMessage(error)));status.classList.add("error");
      const dialogStatus=document.querySelector(".author-import[open] [role=status]");if(dialogStatus)dialogStatus.textContent=errorMessage(error);
      if(doc&&[401,403,409].includes(error.status)){
        const recovery=el("span",null,"author-recovery");recovery.append(button(words("Скачать мой черновик","Download my draft"),()=>download(doc,`${doc.key||"story"}-draft.json`)));
        if(current)recovery.append(button(words("Загрузить актуальную редакцию","Reload current revision"),()=>{if(discard())work(()=>open(current.collectionId));}));status.append(recovery);
      }
    }
    finally { busy=false; root.inert=false; root.removeAttribute("aria-busy");if(status.textContent===words("Выполняем…","Working…"))status.textContent=permissionNotice||(dirty?words("Есть несохранённые изменения в форме.","There are unsaved changes in this form."):""); }
  }
  async function prompts(options){try{await showAuthoringPrompts(options);}catch(error){status.textContent=errorMessage(error);status.classList.add("error");}}
  async function loadList() {
    const visibility=trash?"deleted":["public","unlisted","private","hidden","archived"].includes(state.input.value)?state.input.value:"all";
    const searchParams=new URLSearchParams({page:pageIndex,size:20,q:query.input.value,type:"all",status:trash?"deleted":visibility!=="all"?"all":state.input.value,visibility});
    const data=await request(`/api/${moderation?"moderation":"author"}/folders?${searchParams}`);all=data.items||[];totalPages=Math.ceil((data.total||all.length)/20);
    if(pageIndex>Math.max(0,totalPages-1)){pageIndex=Math.max(0,totalPages-1);return loadList();}
    previous.disabled=pageIndex===0;next.disabled=pageIndex+1>=totalPages;pageLabel.textContent=words(`Страница ${pageIndex+1}`,`Page ${pageIndex+1}`);pagination.hidden=pageIndex===0&&all.length<20;
    renderList();await refreshReviewEligibility();status.textContent=permissionNotice||(dirty?words("Есть несохранённые изменения в форме.","There are unsaved changes in this form."):"");
    activeButton.setAttribute("aria-pressed",String(!trash));trashButton.setAttribute("aria-pressed",String(trash));state.input.disabled=trash;
  }
  function renderList() {
    list.replaceChildren();
    const filtered=all;
    if(!filtered.length)list.append(el("p",words("Здесь пока пусто. Попробуйте другой фильтр.", "Nothing here yet. Try another filter.")));
    for(const item of filtered){
      const id=item.collectionId||item.id,deleted=item.visibility==="deleted";
      const caption=moderation?words("Проверить заявку","Review application"):deleted?words("Просмотреть","View"):words("Открыть историю","Open story");
      const action=item.kind==="scenario"?link(caption,`${path}?story=${encodeURIComponent(id)}${trash?"&trash=1":""}`):button(caption,()=>{if(discard()){lastOpened=id;tabKey="chapters";work(()=>open(id,true));}});
      action.dataset.workId=id;
      list.append(authorCard({title:item.title||item.key,coverUrl:item.coverUrl,status:labels(item),description:item.description,action,caption:item.pendingCount?words(`На проверке: ${item.pendingCount}`,`Awaiting review: ${item.pendingCount}`):null}));
    }
  }
  function labels(item){
    const t=k=>workflowLabel(k,document.documentElement.lang);
    return [t(item.visibility||"private"),t(item.reviewState||"draft")].filter(Boolean).join(" · ");
  }
  async function open(id,push=false){
    const seq=++openRequest;
    const detail=await request(`${api}/${encodeURIComponent(id)}`);if(seq!==openRequest)return;
    if(moderation&&!params.has("revision")&&params.get("technical")!=="1")detail.groupReview=await request(`/api/moderation/folders/${encodeURIComponent(id)}/review`);
    const nextTargets=!moderation&&canEdit?await request("/api/author/collections/targets"):targets;
    if(seq!==openRequest)return;
    current=detail; current.collectionId ||= id;
    doc=structuredClone(detail.draftDocument||detail.document||{});dirty=false;
    targets=nextTargets;
    writeUrl(push,id);renderEditor();showScreen("editor",true); status.textContent="";
  }
  function renderEditor(){
    editor.replaceChildren();
    const h=el("h2",current?.groupReview?.tree?.title||current?.title||doc.title||words("Новая история", "New story"));h.tabIndex=-1;editor.append(h);
    if(current){editor.append(el("p",labels(current)));if(current.reason||current.decisionReason)editor.append(el("p",current.reason||current.decisionReason));}
    if(moderation){
      if(current.groupReview)renderFolderReview(editor,{group:current.groupReview,roles,onDecision:async()=>{await open(current.collectionId);await loadList();},onDetails:()=>{current.groupReview=null;editor.replaceChildren(el("h2",current.title));renderReview();}});
      else renderReview();return;
    }
    const editable=canEdit&&current?.visibility!=="deleted";
    if(!editable){editor.append(el("p",words("Только чтение. Данные сохранены; восстановить доступ может модератор.", "Read only. Data is retained; a moderator can restore access.")));renderSnapshot(editor,doc);return;}
    const metadata=el("section",null,"author-metadata"),chapters=el("section",null,"author-chapters");
    editor.append(editorTabs([["chapters",words("Главы","Chapters"),chapters],["metadata",words("Об истории","About story"),metadata]],tabKey,key=>{tabKey=key;}));
    const reviewNotice=el("p",reviewLimitMessage(document.documentElement.lang),"collection-status review-limit-notice");reviewNotice.hidden=!current?.reviewLimitReached;editor.append(reviewNotice);
    const fields=el("div",null,"collection-fields"),advanced=el("details");advanced.append(el("summary",words("Дополнительные настройки", "Additional settings")));
    for(const [key,ru,en,inputType] of [["key","Ключ","Key","text"],["title","Название","Title","text"],["description","Описание","Description","textarea"],["genre","Жанры","Genres","text"]]){
      const f=field(words(ru,en),doc[key]||"",inputType);f.input.disabled=key==="key"&&Boolean(current);f.input.maxLength=key==="description"?5000:key==="coverUrl"?500:200;
      f.input.oninput=()=>{doc[key]=f.input.value;changed();};(key==="key"?advanced:fields).append(f.label);
    }
    const completion=select(words("Завершённость", "Completion"),[["in_development",words("В разработке", "In progress")],["completed",words("Завершено", "Completed")],["abandoned",words("Приостановлено", "Paused")]],doc.completionStatus||"in_development");completion.input.onchange=()=>{doc.completionStatus=completion.input.value;changed();};
    fields.append(completion.label);metadata.append(fields);
    const cover=el("div",null,"author-cover-setting");cover.append(coverImage(doc.coverUrl),button(words("Выбрать обложку","Choose cover"),()=>chooseCover({url:doc.coverUrl,getImages:()=>current?request(`${api}/${current.collectionId}/covers`):[],upload:async file=>{if(!current)await save();return uploadImage(`${api}/${current.collectionId}/cover`,file);},onSelect:url=>{doc.coverUrl=url;changed();renderEditor();}})));metadata.append(cover);
    chapters.append(el("h3",words("Главы истории", "Story chapters")),el("p",words("Главы читаются по порядку. Их количество заранее задавать не нужно. Название сезона можно оставить пустым. Изменения увидят читатели после проверки.", "Chapters are read in order. Add more whenever ready. Season names are optional. Readers see changes after review.")));
    const items=el("ol",null,"collection-items");
    (doc.items||[]).forEach((item,i)=>{
      const row=el("li",null,"collection-item"), found=targets.find(t=>targetKey(t)===targetKey(item.target)||t.key===item.target.key);
      row.draggable=true;row.ondragstart=event=>event.dataTransfer.setData("text/plain",String(i));row.ondragover=event=>event.preventDefault();
      row.ondrop=event=>{event.preventDefault();const from=Number(event.dataTransfer.getData("text/plain"));if(Number.isInteger(from)){doc.items=moveItem(doc.items,from,i);changed();renderEditor();}};
      row.append(el("h4",`${i+1}. ${found?.title||item.target.key||item.target.id}`));
      const caption=field(words("Подпись в оглавлении (необязательно)", "Contents label (optional)"),item.label||"");caption.input.oninput=()=>{item.label=caption.input.value;changed();};
      const actions=el("div",null,"collection-actions");
      const move=(to,direction)=>{doc.items=moveItem(doc.items,i,to);changed();renderEditor();requestAnimationFrame(()=>{const controls=editor.querySelectorAll('.collection-item')[to]?.querySelectorAll('button');const candidate=controls?.[direction];(candidate&&!candidate.disabled?candidate:Array.from(controls||[]).find(control=>!control.disabled))?.focus();});};
      const up=button(words("↑ Выше", "↑ Up"),()=>move(i-1,0));up.disabled=i===0;
      const down=button(words("↓ Ниже", "↓ Down"),()=>move(i+1,1));down.disabled=i===doc.items.length-1;
      actions.append(up,down,button(words("Исключить", "Remove"),()=>{if(!confirm(words("Убрать главу из оглавления? Сам черновик сохранится. Опубликованный порядок изменится после проверки.","Remove this chapter from the contents? Its draft remains. Published order changes after review.")))return;doc.items.splice(i,1);changed();renderEditor();}));
      if(item.target.kind==="scenario"){
       const submitChapter=button(words("Отправить главу на проверку", "Submit chapter for review"),()=>work(async()=>{
        await save();
        const chapter=await request(`/api/author/stories/${encodeURIComponent(item.target.id)}`);
        await request(`${api}/${current.collectionId}/chapters/review`,{method:"POST",body:{storyId:item.target.id,storyGeneration:chapter.generation,generation:current.generation,replaceReview:true}});
        await open(current.collectionId);await loadList();status.textContent=words("Глава отправлена на проверку. Остальные черновики сохранены.", "Chapter submitted. Other drafts remain unchanged.");
       }));submitChapter.dataset.reviewSubmit="true";submitChapter.disabled=Boolean(current?.reviewLimitReached);actions.append(submitChapter);
      }
      if(item.target.kind==="scenario"&&(found?.id||item.target.id))actions.append(link(words("Редактировать главу", "Edit chapter"),`/builder/?story=${encodeURIComponent(found?.id||item.target.id)}&work=${encodeURIComponent(current?.collectionId||"")}`));
      else if(item.target.kind==="collection")actions.append(button(words("Открыть состав", "Open contents"),()=>{if(discard())work(()=>open(found?.id||item.target.id));}));
      const season=field(words("Сезон (необязательно)", "Season (optional)"),item.season||"");
      season.input.maxLength=100;season.input.oninput=()=>{item.season=season.input.value;changed();};
      const chapterState=current?.dependencies?.find(child=>child.id===item.target.id);
      row.append(el("small",chapterState?labels({...found,...chapterState}):found?labels(found):words("Черновик", "Draft")),caption.label,season.label,actions);items.append(row);
    });chapters.append(items);
    if(!doc.items?.length)chapters.append(el("p",words("Глав пока нет. Добавьте первую и откройте её сцены в конструкторе.","No chapters yet. Add the first chapter to build its scenes.")));
    chapters.append(button(words("+ Добавить главу", "+ Add chapter"),()=>work(createChapter),"add-button"));
    editor.append(chapters,metadata);

    const actions=el("div",null,"collection-actions");
    actions.append(button(words("Сохранить", "Save"),()=>work(save),"add-button"));
    actions.append(button(words("Обновить сведения","Refresh details"),()=>work(async()=>{await refreshReviewEligibility();status.textContent=permissionNotice||(dirty?words("Есть несохранённые изменения в форме.","There are unsaved changes in this form."):words("Сведения обновлены.","Details refreshed."));})));
    actions.append(button(words("Промпты для ИИ","AI prompts"),()=>prompts({kind:"package",...(current?{getContext:kind=>{if(kind!=="package")throw new Error(words("Для этой истории выберите формат пакета.","Choose the package format for this story."));return request(`${api}/${current.collectionId}/export`);}}:{})})));
    if(current){
      if(current.publishedRevision){const send=button(words("Отправить настройки истории на проверку", "Submit story settings for review"),()=>work(async()=>{await save();await submit(false);}));send.dataset.reviewSubmit="true";send.disabled=Boolean(current.reviewLimitReached);actions.append(send);}
      advanced.append(button(words("Экспорт истории", "Export story"),()=>work(async()=>{download(await request(`${api}/${current.collectionId}/export`),`${current.key}.json`);status.textContent="";})));
      if(current.reviewState==="in_review")advanced.append(button(words("Отозвать проверку истории", "Withdraw story review"),()=>work(async()=>{await request(`${api}/${current.collectionId}/withdraw`,{method:"POST",body:{generation:current.generation}});await open(current.collectionId);await loadList();})));
      if(!current.restricted&&current.visibility!=="archived"){
        advanced.append(button(words("В архив","Archive"),()=>work(()=>takeDown(false))));
        if(!current.publishedRevision)advanced.append(button(words("В корзину","Move to trash"),()=>work(()=>takeDown(true))));
      }
    }
    editor.append(actions,el("p",words("На модерации может быть одна ваша история с её главами. Остальные истории можно создавать и редактировать; отправить их получится после решения модератора.","Only one of your stories and its chapters can be under review. Keep creating and editing other stories; submit them after the moderator’s decision.")),advanced);
    if(current){
      const previewHost=el("section");
      advanced.append(button(words("Предпросмотр истории", "Preview story"),()=>work(async()=>{
        const value=await request(`${api}/${current.collectionId}/preview?revision=draft`);
        previewHost.replaceChildren(el("h3",words(`Предпросмотр — не опубликовано · редакция ${value.revision}`,`Private preview — not published · revision ${value.revision}`)));
        renderSnapshot(previewHost,value.document);
        previewHost.append(el("h4",words("Из этого оглавления читателю доступны сейчас", "Currently available to readers from these contents")));
        const items=el("ol");for(const item of value.readerItems||[])items.append(el("li",item.label||item.title||item.key));previewHost.append(items);
        if(value.validation&&!value.validation.valid)previewHost.append(el("p",(value.validation.errors||[]).join("\n")));
      })),previewHost);
      const dependencies=el("details");dependencies.append(el("summary",words("Состояния глав и зависимостей", "Chapter and dependency status")));
      for(const child of current.dependencies||[])dependencies.append(el("p",dependencyLabel(child)));advanced.append(dependencies);
    }
    if(current?.publishedRevision)editor.append(link(words("Открыть читательскую страницу", "Open reader page"),`/collections/${encodeURIComponent(current.key)}`));
    if(current?.events?.length)renderEvents(advanced);
  }
  async function takeDown(remove){
    const message=remove?words("Переместить историю в корзину? Она исчезнет из вашего активного списка. Черновики глав сохранятся; восстановить историю сможет модератор.","Move this story to trash? It leaves your active list. Chapter drafts remain; a moderator can restore the story."):words("Переместить историю в архив? Её оглавление станет недоступно читателям. Отдельно опубликованные главы останутся доступны. Восстановление — через модератора.","Archive this story? Readers will lose access to its contents. Individually published chapters remain available. A moderator can restore the story.");
    if(!discard()||!confirm(message))return;
    await request(`${api}/${current.collectionId}${remove?"":"/archive"}`,{method:remove?"DELETE":"POST",body:{generation:current.generation}});dirty=false;await open(current.collectionId);await loadList();
  }
  async function createNew(push=true){
    if(!canEdit||moderation)return;
    if(!discard())return;targets=await request("/api/author/collections/targets");current=null;doc={schemaVersion:2,key:"",type:"story",title:"",description:"",coverUrl:"",completionStatus:"in_development",items:[],transitions:[]};dirty=false;tabKey="metadata";writeUrl(push,"new");renderEditor();showScreen("editor",true);
  }
  async function save(){
    if(!doc.title?.trim())throw new Error(words("Укажите название истории.","Enter a story title."));
    const original=doc, id=current?.collectionId;if(!id&&!doc.key)doc.key=`story_${crypto.randomUUID().replaceAll("-","")}`;
    const result=await request(id?`${api}/${id}`:api,{method:id?"PUT":"POST",body:{document:doc,...(id?{generation:current.generation}:{})}});
    if(doc!==original)return;
    dirty=false;await open(result.collectionId||result.id||id);await loadList();status.textContent=words("Черновик сохранён. Публикация не изменилась.", "Draft saved. Publication is unchanged.");
  }
  async function submit(batch){
    if(!confirm(words("Отправить историю и изменённые главы на проверку? Если они уже на проверке, заявка обновится. Опубликованные тексты сохранятся до решения модератора.", "Submit the story and changed parts? Any pending application will be updated. Published texts stay unchanged until a moderator decides.")))return;
    const result=await request(`${api}/${current.collectionId}/${batch?"review-batch":"review"}`,{method:"POST",body:{generation:current.generation,replaceReview:true}});
    await open(current.collectionId);await loadList();status.textContent=words("История и изменённые главы отправлены одной заявкой. После одобрения их увидят читатели.", "The story and changed parts were sent as one application. Readers will see them after approval.");
    if(result.results)status.textContent+=`\n${JSON.stringify(result.results)}`;
  }
  async function createChapter(){
    if(!current||dirty)await save();
    const title=words(`Глава ${doc.items.length+1}`,`Chapter ${doc.items.length+1}`);
    const key=`chapter_${crypto.randomUUID().replaceAll("-","")}`;
    const variables={};
    for(const chapter of doc.items){
      const previous=await request(`/api/author/stories/${encodeURIComponent(chapter.target.id)}`);
      Object.assign(variables,previous.draftDocument?.variables||{});
    }
    const result=await request("/api/author/stories/import",{method:"POST",body:{key,title,description:"",completionStatus:"completed",version:1,startSceneId:"start",variables,assets:[],scenes:[{id:"start",title,text:words("Глава начинается.","The chapter begins."),choices:[],ending:{type:"ending",title}}]}});
    doc.items.push({target:{kind:"scenario",id:result.storyId,key},label:""});targets=await request("/api/author/collections/targets");changed();renderEditor();
    await save();
    location.assign(`/builder/?story=${encodeURIComponent(result.storyId)}&work=${encodeURIComponent(current.collectionId)}`);
  }
  function renderSnapshot(container,value){
    container.append(coverImage(value.coverUrl),el("h3",value.title||value.key),el("p",value.description||""));
    const items=el("ol");for(const item of value.items||[]){const child=current?.dependencies?.find(child=>child.id===item.target.id);items.append(el("li",[item.season,item.label||child?.title||item.target.key||item.target.id].filter(Boolean).join(" · ")));}container.append(items);
    const details=el("details");details.append(el("summary",words("Метаданные и контракты", "Metadata and contracts")),el("pre",JSON.stringify(value,null,2),"collection-json"));container.append(details);
  }
  function dependencyLabel(child){
    const parts=[child.title||child.key||child.id,workflowLabel(child.reviewState||child.review_state||"draft",document.documentElement.lang),child.available||child.publishedRevision?words("есть публикация", "has publication"):words("не опубликовано", "unpublished")];
    if(child.requestedRevision)parts.push(words(`Отправлена с оглавлением: v${child.requestedRevision}`,`Submitted with these contents: v${child.requestedRevision}`));
    if(child.submittedRevision)parts.push(words(`Текущая заявка: v${child.submittedRevision}`,`Current submission: v${child.submittedRevision}`));
    return parts.join(" · ");
  }
  function renderReview(){
    const preview=el("div");editor.append(preview);
    const choices=[["draft",words("Черновик", "Draft")]];
    if(current.submittedRevision)choices.unshift(["submitted",words(`Заявка v${current.submittedRevision}`,`Submission v${current.submittedRevision}`)]);
    if(current.publishedRevision)choices.push(["published",words(`Публикация v${current.publishedRevision}`,`Published v${current.publishedRevision}`)]);
    for(const version of current.versions||[])choices.push([String(version.revision),words(`Снимок v${version.revision}`,`Snapshot v${version.revision}`)]);
    const requested=params.get("revision");params.delete("revision");
    const revision=select(words("Просмотреть редакцию", "Inspect revision"),choices,choices.some(([key])=>key===requested)?requested:choices[0][0]);editor.prepend(revision.label);
    let inspected=null,previewRequest=0;
    const loadPreview=async()=>{
      const id=current.collectionId,seq=++previewRequest;inspected=null;
      const data=await request(`${api}/${id}/preview?revision=${revision.input.value}`);if(current?.collectionId!==id||seq!==previewRequest)return;
      preview.replaceChildren(el("p",words(`Приватное превью · редакция ${data.revision}`,`Private preview · revision ${data.revision}`)));renderSnapshot(preview,data.document);
      const published=data.publishedDocument||current.publishedDocument;if(published)preview.append(renderDocumentDiff(published,data.document,document.documentElement.lang));
      if(data.validation)preview.append(el("p",data.validation.valid?words("Проверка пройдена", "Validation passed"):(data.validation.errors||[]).join("\n")));
      dependencies.replaceChildren(el("summary",words("Связанные заявки этой редакции", "This revision's dependent submissions")));
      for(const child of data.dependencies||[]){
        const row=el("p");row.append(document.createTextNode(`${dependencyLabel(child)} `));
        const revisionQuery=child.requestedRevision?`&revision=${encodeURIComponent(child.requestedRevision)}`:"";
        if(child.id)row.append(link(words("Открыть заявку", "Open submission"),(child.kind==="scenario"?`/moderation/?story=${encodeURIComponent(child.id)}`:`/moderation/?view=collections&collection=${encodeURIComponent(child.id)}`)+revisionQuery));dependencies.append(row);
      }
      inspected=data.revision;
    };
    revision.input.onchange=()=>work(loadPreview);loadPreview().catch(error=>{status.textContent=errorMessage(error);});
    const reason=field(words("Причина решения (обязательна для ограничения и отказа)", "Reason (required for restriction or rejection)"),"","textarea");
    const note=field(words("Внутренняя заметка модератора", "Internal reviewer note"),"","textarea");
    const visibility=select(words("Видимость при публикации", "Publication visibility"),[["public",words("В каталоге", "Public")],["unlisted",words("По ссылке", "Unlisted")]],"public");
    const override=checkbox(words("Администратор: проверяю своё произведение с указанной причиной", "Administrator: reviewing my own work with a reason"),false);
    editor.append(reason.label,note.label,visibility.label);if(roles.includes("admin"))editor.append(override.label);
    const actions=el("div",null,"collection-actions");
    const options=[];
    if(current.reviewState==="in_review")options.push(["approve",words("Одобрить без публикации", "Approve privately")],["approve-publish",words("Одобрить и опубликовать", "Approve and publish")],["reject",words("Отклонить", "Reject")]);
    if(current.reviewState==="approved")options.push(["publish-approved",words("Опубликовать одобренную редакцию", "Publish approved revision")]);
    if(["hidden","archived","deleted"].includes(current.visibility))options.push(["restore",words("Восстановить в приватное", "Restore to private")]);
    else options.push(["hide",words("Скрыть историю", "Hide story")],["archive",words("Архивировать", "Archive")],["delete",words("В корзину", "Delete")]);
    for(const [action,label] of options)actions.append(button(label,()=>work(async()=>{
      if(["approve","approve-publish","reject","publish-approved"].includes(action)&&inspected!==current.submittedRevision)throw new Error(words("Сначала откройте точную редакцию заявки.", "Inspect the submitted revision first."));
      if(!["approve","approve-publish"].includes(action)&&!reason.input.value.trim())throw new Error(words("Укажите причину решения.", "Enter a reason."));
      if(!confirm(`${label}: «${current.title}»?`))return;
      await request(`${api}/${current.collectionId}/${action}`,{method:"POST",body:{generation:current.generation,revision:current.submittedRevision,reason:reason.input.value,internalNote:note.input.value,visibility:visibility.input.value,ownOverride:override.input.checked}});
      await open(current.collectionId);await loadList();status.textContent=words("Решение сохранено.", "Decision saved.");
    })));
    editor.append(actions);
    const dependencies=el("details");editor.append(dependencies);
    if(current.publishedRevision){
      const restriction=el("details"), children=el("div");restriction.append(el("summary",words("Ограничить выбранные части произведения", "Restrict selected parts")),el("p",words("Скрытие истории не скрывает отдельные опубликованные главы. Здесь можно явно выбрать части для блокировки чтения, включая старые сохранения.", "Hiding a story keeps individual published chapters available. Select parts here to block reading, including old saves.")));
      restriction.append(button(words("Загрузить опубликованный состав", "Load published descendants"),()=>work(async()=>{
        const id=current.collectionId, items=await request(`${api}/${id}/descendants`);if(current.collectionId!==id)return;children.replaceChildren();
        const selected=[];
        for(const item of items){const control=checkbox(`${item.title||item.id} · ${item.kind} · ${workflowLabel(item.visibility,document.documentElement.lang)}`,false);selected.push([item,control]);children.append(control.label);}
        const why=field(words("Причина ограничения", "Restriction reason"),"","textarea");children.append(why.label,button(words("Скрыть выбранные части", "Hide selected parts"),()=>work(async()=>{
          const chosen=selected.filter(([,control])=>control.input.checked).map(([item])=>({kind:item.kind,id:item.id,generation:item.generation}));
          if(!chosen.length||!why.input.value.trim())throw new Error(words("Выберите части и укажите причину.", "Select parts and enter a reason."));
          if(!confirm(words(`Скрыть выбранные части (${chosen.length})? Чтение и сохранения станут недоступны до восстановления.`,`Hide ${chosen.length} selected parts? Reading and saved games will be unavailable until restoration.`)))return;
          await request(`${api}/${id}/restrict-descendants`,{method:"POST",body:{items:chosen,reason:why.input.value}});await open(id);await loadList();
        })));
      })),children);editor.append(restriction);
    }
    renderEvents();
  }
  function renderEvents(container=editor){
    if(!current.events?.length)return;
    const events=el("details");events.append(el("summary",words("История решений", "Decision history")));
    for(const event of current.events)events.append(el("p",`${workflowLabel(event.action,document.documentElement.lang)} · ${event.createdAt||event.created_at||""} · ${event.reason||""}${moderation&&(event.internalNote||event.internal_note)?` · ${event.internalNote||event.internal_note}`:""}`));container.append(events);
  }
  if(!moderation&&canEdit){
    const create=button(words("+ Создать историю", "+ Create story"),()=>work(()=>createNew()),"add-button");create.dataset.authorMutation="true";
    const upload=field(words("Импорт пакета", "Import package"),"","file");upload.input.accept="application/json,.json";
    upload.input.onchange=()=>work(async()=>{
      const file=upload.input.files[0];upload.input.value="";if(!file||!discard())return;
      const packageValue=JSON.parse(await file.text());
      async function inspectImport(){
        const preview=await request("/api/author/collections/import-preview",{method:"POST",body:{package:packageValue}});
        current=null;doc=null;dirty=false;importDialog.close();editor.replaceChildren(el("h2",words("Проверка импорта", "Import preview")),el("p",words("Будут изменены только черновики. Опубликованные редакции останутся прежними.", "Only drafts will change. Published revisions will remain unchanged.")));editor.querySelector("h2").tabIndex=-1;writeUrl(true,null);showScreen("editor",true);
        const labels={create:words("Создать", "Create"),update:words("Обновить черновик", "Update draft"),unchanged:words("Без изменений", "Unchanged"),conflict:words("Конфликт", "Conflict")};
        for(const item of preview.items||[])editor.append(el("p",`${item.key} · ${labels[item.action]||item.action}${item.reason?` · ${item.reason}`:""}`));
        const apply=button(words("Применить этот импорт", "Apply this import"),()=>work(async()=>{
          await request("/api/author/collections/import",{method:"POST",body:{package:packageValue,generations:preview.generations}});
          await loadList();showScreen("list",true);status.textContent=words("Пакет импортирован в черновики.", "Package imported as drafts.");upload.input.value="";
        }));apply.disabled=!preview.canImport;
        editor.append(apply,button(words("Проверить конфликты повторно", "Refresh conflict check"),()=>work(inspectImport)));
      }
      await inspectImport();
    });
    const importDialog=el("dialog",null,"workspace-dialog author-import");importDialog.setAttribute("aria-labelledby","author-import-title");const importHeading=el("h2",words("Импорт истории из файла","Import story from a file"));importHeading.id="author-import-title";
    const importStatus=el("p","","workspace-status");importStatus.setAttribute("role","status");importDialog.append(importHeading,el("p",words("Выберите JSON всей истории. Перед записью вы увидите новые главы, изменения и конфликты.","Choose a complete story JSON package. Review new chapters, changes and conflicts before saving.")),upload.label,importStatus,button(words("Закрыть","Close"),()=>importDialog.close()));document.body.append(importDialog);
    const importButton=button(words("Импорт истории из файла","Import story from a file"),()=>importDialog.showModal());importButton.dataset.authorMutation="true";
    utilities.append(importButton,button(words("Промпты для ИИ","AI prompts"),()=>prompts({kind:"package"})));titleRow.append(create);
  }
  const filterChanged=()=>{pageIndex=0;writeUrl(false,null);work(loadList);};toolbar.onsubmit=event=>{event.preventDefault();filterChanged();};query.input.onsearch=filterChanged;state.input.onchange=filterChanged;
  await loadList();
  if(params.get("collection")==="new"||params.get("create")==="1")await createNew(false);
  else if(params.get("collection"))await open(params.get("collection"));
  else if(params.get("scenario")&&!moderation){
    const parents=await request(`/api/author/collections/parents?scenarioId=${encodeURIComponent(params.get("scenario"))}`);
    if(parents.length)await open(parents[0].id||parents[0].collectionId);
    else status.textContent=words("Это самостоятельная история. Откройте её из списка для редактирования сцен.", "This is a standalone story. Open it from the list to edit its scenes.");
  }
}
