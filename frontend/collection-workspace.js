import {el,link,button,field,select,checkbox,words,typeName,request,errorMessage,download,targetKey} from "./collection-ui.js?v=6";
import {chapterState,chapterStateLabel} from "./chapter-state.js?v=2";
import {reviewLimitMessage} from "./review-limit.js?v=2";
import {workflowLabel, renderDocumentDiff, canEditStoryDraft} from "./story-workflow.js?v=3";
import {renderFolderReview} from "./folder-review.js?v=6";
import {authorCard,coverImage} from "./author-ui.js?v=3";
import {seasonGroups,seasonDialog} from "./author-seasons.js?v=1";
import {genres,topics,fillClassification} from '/builder/genre-topic.js?v=1';
import {chooseCover,uploadImage} from "./author-cover.js?v=3";

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
  let chapterDetails=new Map(),notices=[];
  const expandedSeasons=new Set();
  let tabKey="chapters",trash=params.get("trash")==="1",screen="list",historyIndex=0,restoringHistory=false,lastOpened=null,permissionNotice="";
  history.replaceState({...history.state,authorIndex:0},"",location.href);
  const heading = el("h1",words(moderation ? "Заявки на публикацию" : "Мои истории",moderation ? "Publication applications" : "My stories"));
  const status = el("p","","collection-status"); status.setAttribute("role","status");
  const aboutDialog=el('dialog',null,'workspace-dialog story-about-dialog');
  aboutDialog.setAttribute('aria-labelledby','story-about-title');root.append(aboutDialog);
  aboutDialog.addEventListener('close',()=>{tabKey='chapters';editor.querySelector('.story-primary-actions')?.removeAttribute('hidden');editor.querySelector('.story-about-button')?.focus();});
  aboutDialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
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
  if(!moderation){const intro=el('div',null,'author-heading-copy');intro.append(heading,el('p',words('Пишите. Вдохновляйте. Создавайте другие миры.','Write. Inspire. Create other worlds.'),'author-tagline'));titleRow.append(intro);}
  const utilities=el("div",null,"author-utilities");
  const activeButton=button(words("Истории","Stories"),()=>switchTrash(false)),trashButton=button(words("Корзина","Trash"),()=>switchTrash(true));
  utilities.append(activeButton,trashButton);
  const back=button(words("← К моим историям","← My stories"),()=>{if(!discard())return;dirty=false;if(historyIndex>0)history.back();else{writeUrl(false,null);showScreen("list",true);}});
  if(moderation)back.textContent=words("← К заявкам","← Applications");back.className="author-back";back.hidden=true;
  grid.append(listColumn,editor); root.append(titleRow,back,toolbar,utilities,status,grid);
  if(!moderation){const filters=el('div',null,'author-list-tools');filters.append(toolbar,utilities);titleRow.after(filters);}
  const trashNotice=el('p',words('Истории хранятся в корзине 30 дней с момента удаления. В течение этого времени их можно восстановить. Затем они удаляются автоматически.','Stories stay in trash for 30 days after deletion. You can restore them during this time. After that, they are deleted automatically.'),'author-trash-notice');
  trashNotice.hidden=!trash;status.before(trashNotice);
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
    if(id==="new")work(()=>createNew(false));else if(id)work(()=>all.some(n=>n.id===id&&n.kind==="scenario")?openStandalone(id,false):open(id,false));else {current=null;doc=null;showScreen("list");work(async()=>{await loadList();showScreen("list",true);});}
  });
  function writeUrl(push,id){
    const next=new URLSearchParams();if(query.input.value)next.set("q",query.input.value);if(state.input.value!==(moderation?"in_review":"all"))next.set("status",state.input.value);if(trash)next.set("trash","1");if(id)next.set("collection",id);
    if(push)historyIndex++;history[push?"pushState":"replaceState"]({authorIndex:historyIndex},"",`${path}${next.size?`?${next}`:""}`);
  }
  function showScreen(value,focus=false){
    screen=value;root.dataset.screen=value;
    if(!moderation){
      listColumn.hidden=false;toolbar.hidden=utilities.hidden=titleRow.hidden=false;back.hidden=true;
      editor.hidden=value!=="editor";renderList();
      if(focus)requestAnimationFrame(()=>{const target=value==="editor"?editor.closest("article")?.querySelector(".story-toggle"):heading;target?.focus();});
      return;
    }listColumn.hidden=value!=="list";editor.hidden=value!=="editor";toolbar.hidden=utilities.hidden=titleRow.hidden=value!=="list";back.hidden=value!=="editor";
    document.querySelector(".skip-link")?.setAttribute("href",value==="editor"?"#author-editor":"#folder-list");
    if(focus)requestAnimationFrame(()=>{const target=value==="editor"?editor.querySelector("h2"):list.querySelector(`[data-work-id="${CSS.escape(lastOpened||"")}"]`)||heading;target?.focus();window.scrollTo({top:0,behavior:"instant"});});
  }
  editor.id="author-editor";heading.tabIndex=-1;showScreen("list");
  async function switchTrash(value){if(!discard())return;dirty=false;current=null;doc=null;screen="list";editor.hidden=true;trash=value;pageIndex=0;writeUrl(false,null);await work(loadList);}
  async function refreshReviewEligibility(){
    if(moderation)return;
    const session=await request("/auth/me"),allowed=!session.blocked&&(session.roles||[]).some(role=>["author","admin"].includes(role));
    root.querySelectorAll("[data-author-mutation]").forEach(control=>control.disabled=!allowed);
    permissionNotice=allowed?"":dirty?words("Право редактирования изменилось. Ваш текст остаётся в форме; скопируйте его перед выходом.","Editing permission changed. Your text remains in the form; copy it before leaving."):words("Только чтение. Для создания и изменения историй нужна роль автора.","Read only. Creating and editing stories requires the author role.");
    if(canEdit!==allowed){canEdit=allowed;if(screen==="editor"){
      editor.querySelectorAll("input,textarea").forEach(control=>control.readOnly=!allowed);
      aboutDialog.querySelectorAll('input,textarea').forEach(control=>control.readOnly=!allowed);
      aboutDialog.querySelectorAll('select,button.add-button').forEach(control=>control.disabled=!allowed);
      editor.querySelectorAll("select,button:not([role=tab])").forEach(control=>control.disabled=!allowed);
      editor.querySelectorAll('a[href^="/builder/"]').forEach(control=>control.hidden=!allowed);
      if(!allowed)status.textContent=permissionNotice;
      else if(current?.standalone)renderStandalone();else renderEditor();
    }}
    if(!current)return;
    const id=current.collectionId,seq=openRequest;
    const detail=await request(current.standalone?`/api/author/stories/${encodeURIComponent(id)}`:`${api}/${encodeURIComponent(id)}`);
    if(seq!==openRequest||current?.collectionId!==id)return;
    current.reviewLimitReached=detail.reviewLimitReached;
    current.reviewDailyLimitReached=detail.reviewDailyLimitReached;current.reviewAvailableAt=detail.reviewAvailableAt;
    editor.querySelectorAll("[data-review-submit]").forEach(control=>{control.disabled=!canEdit||Boolean(detail.reviewLimitReached);});
    editor.querySelectorAll(".review-limit-notice").forEach(notice=>{notice.hidden=!detail.reviewLimitReached;notice.textContent=reviewLimitMessage(document.documentElement.lang,detail);});
  }
  async function work(action) {
    if (busy) return; busy=true; root.inert=true; aboutDialog.inert=true; root.setAttribute("aria-busy","true"); status.textContent=words("Выполняем…", "Working…"); status.classList.remove("error");
    try { await action(); }
    catch(error) {
      status.replaceChildren(document.createTextNode(errorMessage(error)));status.classList.add("error");
      const dialogStatus=document.querySelector(".author-import[open] [role=status], .story-about-dialog[open] [role=status]");if(dialogStatus)dialogStatus.textContent=errorMessage(error);
      if(doc&&[401,403,409].includes(error.status)){
        const recovery=el("span",null,"author-recovery");recovery.append(button(words("Скачать мой черновик","Download my draft"),()=>download(doc,`${doc.key||"story"}-draft.json`)));
        if(current)recovery.append(button(words("Загрузить актуальную редакцию","Reload current revision"),()=>{if(discard())work(()=>current.standalone?openStandalone(current.collectionId):open(current.collectionId));}));status.append(recovery);
      }
    }
    finally { busy=false; root.inert=false; aboutDialog.inert=false; root.removeAttribute("aria-busy");if(aboutDialog.open)aboutDialog.querySelector("[role=status]").textContent=status.textContent;if(status.textContent===words("Выполняем…","Working…"))status.textContent=permissionNotice||(dirty?words("Есть несохранённые изменения в форме.","There are unsaved changes in this form."):""); }
  }

  async function loadList() {
    trashNotice.hidden=!trash;
    const visibility=trash?"deleted":["public","unlisted","private","hidden","archived"].includes(state.input.value)?state.input.value:"all";
    const searchParams=new URLSearchParams({page:pageIndex,size:20,q:query.input.value,type:"all",status:trash?"deleted":visibility!=="all"?"all":state.input.value,visibility});
    const data=await request(`/api/${moderation?"moderation":"author"}/folders?${searchParams}`);all=data.items||[];totalPages=Math.ceil((data.total||all.length)/20);
    if(pageIndex>Math.max(0,totalPages-1)){pageIndex=Math.max(0,totalPages-1);return loadList();}
    previous.disabled=pageIndex===0;next.disabled=pageIndex+1>=totalPages;pageLabel.textContent=words(`Страница ${pageIndex+1}`,`Page ${pageIndex+1}`);pagination.hidden=pageIndex===0&&all.length<20;
    if(!moderation)notices=(await request("/api/account")).notifications||[];
    renderList();await refreshReviewEligibility();status.textContent=permissionNotice||(dirty?words("Есть несохранённые изменения в форме.","There are unsaved changes in this form."):"");
    activeButton.setAttribute("aria-pressed",String(!trash));trashButton.setAttribute("aria-pressed",String(trash));state.input.disabled=trash;
  }
  function relatedNotices(item){
    const ids=new Set();const visit=node=>{ids.add(node.id||node.collectionId);for(const child of node.children||[])visit(child);};visit(item);
    return notices.filter(n=>n.kind==='moderation'&&(ids.has(n.storyId)||ids.has(n.collectionId)));
  }
  function renderList() {
    list.replaceChildren();
    const entries=[...all];
    if(!moderation&&screen==='editor'&&doc&&!entries.some(n=>(n.collectionId||n.id)===current?.collectionId))entries.unshift({...current,id:current?.collectionId||'new',kind:'collection',title:doc.title||words('Новая история','New story'),description:doc.description,coverUrl:doc.coverUrl});
    if(!entries.length)list.append(el('p',words('Здесь пока пусто. Создайте историю или измените фильтр.','No stories yet. Create one or change the filter.')));
    for(const item of entries){
      const id=item.collectionId||item.id,deleted=item.visibility==='deleted';
      if(moderation){const action=item.kind==='scenario'?link(words('Проверить историю','Review story'),`${path}?story=${encodeURIComponent(id)}`):button(words('Проверить заявку','Review application'),()=>{if(discard())work(()=>open(id,true));});list.append(authorCard({title:item.title||item.key,coverUrl:item.coverUrl,status:labels(item),description:item.description,action}));continue;}
      const expanded=screen==='editor'&&(current?.collectionId===id||(!current&&id==='new'));
      const card=el('article',null,'author-story-card accordion-story');
      const trigger=button('',()=>{
        if(!discard())return;
        if(expanded){dirty=false;screen='list';editor.hidden=true;writeUrl(true,null);renderList();list.querySelector(`[data-work-id="${CSS.escape(id)}"]`)?.focus();return;}
        lastOpened=id;tabKey='chapters';
        work(()=>item.kind==='scenario'?openStandalone(id,true):open(id,true));
      });trigger.className='story-toggle';trigger.dataset.workId=id;trigger.setAttribute('aria-expanded',String(expanded));trigger.setAttribute('aria-controls','author-editor');
      const copy=el('span',null,'author-card-copy');copy.append(el('strong',item.title||item.key,'story-card-title'));
      if(item.description)copy.append(el('span',item.description,'author-card-description'));
      const children=item.children||[],count=item.kind==='scenario'?1:(expanded?doc.items?.length:children.length)||0,published=item.kind==='scenario'?(item.publishedRevision?1:0):children.filter(c=>c.publishedRevision).length;
      copy.append(el('span',words(`${count} глав · ${published} опубликовано`,`${count} chapters · ${published} published`),'author-card-status'));
      const mark=el('span',null,'story-card-mark');const unread=relatedNotices(item).some(n=>n.unread);
      if(unread)mark.append(el('span',words('● Новый комментарий','● New feedback'),'story-unread'));
      mark.append(el('span',expanded?'⌃':'⌄','story-chevron'));
      trigger.append(coverImage(item.coverUrl),copy,mark);card.append(trigger);
      if(expanded)card.append(editor);list.append(card);
    }
    if(!editor.isConnected)grid.append(editor);
  }
  async function openStandalone(id,push=false){
    const detail=await request(`/api/author/stories/${encodeURIComponent(id)}`);
    current={...detail,collectionId:id,standalone:true};doc=detail.draftDocument;dirty=false;chapterDetails=new Map([[id,detail]]);
    writeUrl(push,id);renderStandalone();showScreen('editor',true);
  }
  function renderStandalone(){
    const id=current.collectionId,detail=chapterDetails.get(id);
    const heading=el('h2',doc.title);heading.tabIndex=-1;editor.replaceChildren(heading);
    const row=el('section');renderChapterOverview(row,{target:{id,kind:'scenario'}},0,detail);
    editor.append(row,link(words('Об истории и дополнительные действия','Story details and more actions'),`/my-stories/?story=${encodeURIComponent(id)}`));showScreen('editor',true);
  }
  function labels(item){
    const t=k=>workflowLabel(k,document.documentElement.lang);
    return [t(item.visibility||"private"),t(item.reviewState||"draft")].filter(Boolean).join(" · ");
  }
  function renderFeedback(host,detail,id,isCollection=false){
    const events=(detail.events||[]).filter(e=>['reject','approve','approve-publish','publish-approved','request-correction'].includes(e.action));
    const reason=detail.reason||detail.decisionReason||detail.correctionReason;
    if(!events.length&&!reason)return;
    const block=el('details',null,'chapter-feedback');block.open=detail.reviewState==='rejected';
    block.append(el('summary',words('Комментарии и решения модератора','Moderator feedback')));
    if(reason)block.append(el('p',reason));
    for(const event of events){const entry=el('div',null,'moderator-comment');entry.append(el('strong',event.action==='request-correction'?words('Модератор открыл исправление опубликованной главы','Moderator requested a published chapter correction'):event.action==='reject'?words('Нужны исправления','Changes requested'):words('Модерация пройдена','Approved')));if(event.reason&&event.reason!==reason)entry.append(el('p',event.reason));const date=event.createdAt||event.created_at;if(date)entry.append(el('small',new Date(date).toLocaleString(document.documentElement.lang)));block.append(entry);}
    const unread=notices.filter(n=>n.unread&&n.kind==='moderation'&&(isCollection?n.collectionId===id:n.storyId===id));
    if(unread.length)block.append(button(words('Отметить просмотренным','Mark as read'),()=>work(async()=>{for(const n of unread){await request(`/api/account/notifications/${encodeURIComponent(n.id)}/read`,{method:'POST'});n.unread=false;}block.querySelector('button')?.remove();renderList();})));
    host.append(block);
  }
  function renderChapterOverview(row,item,index,detail){
    const id=item.target.id,state=chapterState(detail),en=document.documentElement.lang==='en';
    const title=detail.draftDocument?.title||detail.title||item.label||item.target.key||words('Глава','Chapter');
    const top=el('div',null,'chapter-overview');top.append(el('h4',`${index+1}. ${title}`),el('span',chapterStateLabel(state,en),`chapter-state state-${state}`));
    const stateIcon={in_review:'clock',rejected:'warning',approved:'approved',draft:'draft'}[state];
    if(stateIcon){const badge=top.querySelector('.chapter-state');badge.textContent=badge.textContent.replace(/^✓\s*/,'');const icon=el('img');icon.src=`/assets/author/${stateIcon}.svg`;icon.alt='';badge.prepend(icon);}
    const actions=el('div',null,'chapter-buttons');
    if(canEdit&&canEditStoryDraft(detail))actions.append(link(words('Редактировать','Edit'),`/builder/?story=${encodeURIComponent(id)}${current?.standalone?'':`&work=${encodeURIComponent(current?.collectionId||'')}`}`));
    if(!detail.publishedRevision&&state!=='unavailable')actions.append(button(words('Предпросмотр','Preview'),()=>{if(discard())location.href=`/author-preview.html?previewStory=${encodeURIComponent(id)}&revision=${encodeURIComponent(detail.draftRevision)}`;}));
    if(detail.publishedRevision&&state!=='unavailable')actions.append(button(words('Читать','Read'),()=>{if(discard())location.href=`/history/${encodeURIComponent(detail.publishedSlug||detail.slug||detail.key||item.target.key||id)}`;}));
    if(canEdit&&canEditStoryDraft(detail)&&(['draft','rejected'].includes(state)||detail.correctionRequested)){
      const send=button(state==='rejected'?words('Отправить повторно','Resubmit'):words('На модерацию','Submit for review'),()=>work(async()=>{
        if(!confirm(words('Отправить главу на модерацию? Одновременно на проверке может быть одна ваша история с её главами. Остальные истории можно создавать и редактировать.','Submit this chapter for review? Only one of your stories and its chapters can be under review at a time. You can keep creating and editing other stories.')))return;
        if(!current.standalone)await save();
        const chapter=await request(`/api/author/stories/${encodeURIComponent(id)}`);
        if(current.standalone)await request(`/api/author/stories/${encodeURIComponent(id)}/review`,{method:'POST',body:{generation:chapter.generation,replaceReview:false}});
        else await request(`${api}/${current.collectionId}/chapters/review`,{method:'POST',body:{storyId:id,storyGeneration:chapter.generation,generation:current.generation,replaceReview:true}});
        await reloadExpanded();status.textContent=words('Глава отправлена на модерацию.','Chapter submitted for review.');
      }));send.dataset.reviewSubmit='true';send.disabled=Boolean(current?.reviewLimitReached);actions.append(send);
    }
    if(canEdit&&state==='approved')actions.append(button(detail.publishedRevision?words('Опубликовать обновление','Publish update'):words('Опубликовать','Publish'),()=>work(async()=>{
      if(dirty)throw new Error(words('Сначала сохраните изменения оглавления.','Save the contents changes first.'));
      if(!confirm(words('Опубликовать одобренную главу для читателей?','Publish the approved chapter for readers?')))return;
      const body={storyId:id,storyGeneration:detail.generation,revision:detail.draftRevision,generation:current.generation};
      if(current.standalone){body.generation=detail.generation;await request(`/api/author/stories/${encodeURIComponent(id)}/publish`,{method:'POST',body});}
      else await request(`${api}/${current.collectionId}/chapters/publish`,{method:'POST',body});
      await reloadExpanded();status.textContent=words('Глава опубликована.','Chapter published.');
    }),'add-button'));
    for(const control of actions.children){const label=control.textContent;const kind=control.tagName==='A'?'edit':label===words('Предпросмотр','Preview')?'preview':label===words('Читать','Read')?'read':state==='approved'?'publish':state==='rejected'?'resubmit':'send';const icon=el('img');icon.src=`/assets/author/${kind}.svg`;icon.alt='';control.prepend(icon);control.dataset.chapterAction=kind;}
    top.append(actions);row.append(top);
    if(actions.querySelector('[data-review-submit]')){
      const notice=el('p',reviewLimitMessage(document.documentElement.lang,current||{}),'review-limit-notice');
      notice.hidden=!current?.reviewLimitReached;row.append(notice);
    }
    if(detail.publishedRevision&&!detail.correctionRequested)top.querySelector('.chapter-state').title=words('Опубликованная глава доступна только для чтения. Исправление может открыть модератор с замечанием.','Published chapters are read-only. A moderator can request a correction with feedback.');
    if(detail.publishedRevision&&detail.publishedRevision!==detail.draftRevision)row.append(el('small',words('Читателям доступна предыдущая опубликованная версия.','Readers still see the previous published edition.')));
    renderFeedback(row,detail,id);
    const history=el('details',null,'chapter-history');
    history.append(el('summary',words('История изменений главы','Chapter change history')));
    const entries=el('ol');
    for(const version of [...(detail.versions||[])].sort((a,b)=>b.versionNumber-a.versionNumber)){
      const entry=el('li');
      const labels=[version.versionNumber===detail.draftRevision?words('Текущий черновик','Current draft'):'',version.versionNumber===detail.publishedRevision?words('Опубликована','Published'):'',version.versionNumber===detail.submittedRevision?words('Отправлена на модерацию','Submitted for review'):''].filter(Boolean);
      entry.append(el('strong',words(`Редакция ${version.versionNumber}`,`Revision ${version.versionNumber}`)),el('p',[version.createdAt?new Date(version.createdAt).toLocaleString(document.documentElement.lang):'',...labels].filter(Boolean).join(' · ')));
      entry.append(link(words('Посмотреть редакцию','View revision'),`/author-preview.html?previewStory=${encodeURIComponent(id)}&revision=${encodeURIComponent(version.versionNumber)}`));
      entries.append(entry);
    }
    history.append(entries);
    if(!entries.children.length)history.append(el('p',words('Сохранённых редакций пока нет.','No saved revisions yet.')));
    row.append(history);
  }
  async function reloadExpanded(){const id=current.collectionId,standalone=current.standalone;await loadList();if(standalone)await openStandalone(id);else await open(id);}
  async function open(id,push=false){
    const seq=++openRequest;
    const detail=await request(`${api}/${encodeURIComponent(id)}`);if(seq!==openRequest)return;
    if(moderation&&!params.has("revision")&&params.get("technical")!=="1")detail.groupReview=await request(`/api/moderation/folders/${encodeURIComponent(id)}/review`);
    const nextTargets=!moderation&&canEdit?await request("/api/author/collections/targets"):targets;
    if(seq!==openRequest)return;
    current=detail; current.collectionId ||= id;
    doc=structuredClone(detail.draftDocument||detail.document||{});dirty=false;
    if(!moderation){
      const chapters=await Promise.all((doc.items||[]).filter(i=>i.target.kind==='scenario').map(async i=>{try{return [i.target.id,await request(`/api/author/stories/${encodeURIComponent(i.target.id)}`)];}catch(error){if(error.status===403||error.status===404)return [i.target.id,{visibility:'unavailable',restricted:true}];throw error;}}));
      if(seq!==openRequest)return;chapterDetails=new Map(chapters);
    }
    targets=nextTargets;
    writeUrl(push,id);renderEditor();showScreen("editor",true); status.textContent="";
  }
  function renderEditor(){
    editor.replaceChildren();
    const h=el("h2",current?.groupReview?.tree?.title||current?.title||doc.title||words("Новая история", "New story"));h.tabIndex=-1;editor.append(h);
    if(moderation&&current){editor.append(el("p",labels(current)));if(current.reason||current.decisionReason)editor.append(el("p",current.reason||current.decisionReason));}
    if(moderation){
      if(current.groupReview)renderFolderReview(editor,{group:current.groupReview,roles,onDecision:async()=>{await open(current.collectionId);await loadList();},onDetails:()=>{current.groupReview=null;editor.replaceChildren(el("h2",current.title));renderReview();}});
      else renderReview();return;
    }
    const editable=canEdit&&current?.visibility!=="deleted";
    if(!editable){
      const expiry=current?.trashExpiresAt?new Date(current.trashExpiresAt).toLocaleString(document.documentElement.lang):"";
      editor.append(el("p",current?.visibility==="deleted"?words(`Корзина очистится автоматически через 30 дней после удаления${expiry?`: ${expiry}`:""}.`,`Trash clears automatically 30 days after removal${expiry?`: ${expiry}`:""}.`):words("Только чтение.","Read only.")));
      if(canEdit&&current?.canRestoreTrash)editor.append(button(words("Восстановить черновик","Restore draft"),()=>work(async()=>{await request(`${api}/${current.collectionId}/restore`,{method:"POST",body:{generation:current.generation}});trash=false;await open(current.collectionId);await loadList();})));
      renderSnapshot(editor,doc);return;
    }
    const metadata=el("section",null,"author-metadata"),chapters=el("section",null,"author-chapters");
    const metadataLocked=Boolean(current?.metadataLocked||current?.publishedRevision||(current?.dependencies||[]).some(chapter=>chapter.publishedRevision||chapter.available));
    const aboutButton=button(words('Об истории','About story'),()=>{tabKey='metadata';editor.querySelector('.story-primary-actions').hidden=true;aboutDialog.showModal();},'story-about-button');
    const aboutTitle=el('h2',words('Об истории','About story'));aboutTitle.id='story-about-title';
    const aboutStatus=el('p',null,'collection-status');aboutStatus.setAttribute('role','status');
    const aboutActions=el('div',null,'collection-actions');aboutActions.append(button(words('Сохранить','Save'),()=>work(save),'add-button'),button(words('Закрыть','Close'),()=>aboutDialog.close()));
    aboutDialog.replaceChildren(aboutTitle,metadata,aboutStatus,aboutActions);
    if(metadataLocked){aboutActions.firstElementChild.remove();metadata.append(el('p',words('Первая глава уже опубликована. Данные истории доступны только для просмотра.','The first chapter has been published. Story details are read-only.')));}
    const fields=el("div",null,"collection-fields"),advanced=el("details");advanced.append(el("summary",words("Дополнительные настройки", "Additional settings")));
    for(const [key,ru,en,inputType] of [["key","Ключ","Key","text"],["title","Название","Title","text"],["description","Описание","Description","textarea"]]){
      const f=field(words(ru,en),doc[key]||"",inputType);f.input.disabled=key==="key"&&Boolean(current);f.input.maxLength=key==="description"?5000:key==="coverUrl"?500:200;
      f.input.oninput=()=>{doc[key]=f.input.value;changed();};(key==="key"?advanced:fields).append(f.label);
    }
    const completion=select(words("Завершённость", "Completion"),[["in_development",words("В разработке", "In progress")],["completed",words("Завершено", "Completed")],["abandoned",words("Приостановлено", "Paused")]],doc.completionStatus||"in_development");completion.input.onchange=()=>{doc.completionStatus=completion.input.value;changed();};
    const classification=el('div',null,'story-classification');
    for(const [key,ru,en,options] of [['genre','Жанр','Genre',genres],['topic','Тема','Topic',topics]]){
      const control=select(words(ru,en),[['','']],doc[key]);fillClassification(control.input,options,doc[key],document.documentElement.lang);
      control.input.onchange=()=>{doc[key]=control.input.value;changed();};classification.append(control.label);
    }
    fields.append(classification,completion.label);metadata.append(fields);
    const cover=el("div",null,"author-cover-setting");cover.append(coverImage(doc.coverUrl),button(words("Выбрать обложку","Choose cover"),()=>chooseCover({url:doc.coverUrl,getImages:()=>current?request(`${api}/${current.collectionId}/covers`):[],upload:async file=>{if(!current)await save();return uploadImage(`${api}/${current.collectionId}/cover`,file);},onSelect:url=>{doc.coverUrl=url;changed();renderEditor();}})));metadata.append(cover);
    if(metadataLocked){metadata.querySelectorAll('input,textarea').forEach(control=>control.readOnly=true);metadata.querySelectorAll('select').forEach(control=>control.disabled=true);cover.querySelector('button').remove();}
    const chapterHeading=el('div',null,'chapter-heading');chapterHeading.append(el('h3',words('Главы','Chapters')),aboutButton);chapters.append(chapterHeading);
    const items=el("ol",null,"collection-items");
    for(const group of seasonGroups(doc.items||[])){
      let destination=items;
      if(group.key){
        const wrapper=el('li',null,'season-item'),details=el('details',null,'author-season');
        const expansionKey=`${current?.collectionId||'new'}:${group.key}:${group.number}`;
        details.open=expandedSeasons.has(expansionKey);
        details.addEventListener('toggle',()=>{if(details.isConnected){if(details.open)expandedSeasons.add(expansionKey);else expandedSeasons.delete(expansionKey);}});
        details.append(el('summary',words(`Сезон ${group.number}`,`Season ${group.number}`)+(group.title?` · ${group.title}`:'')+words(` · Глав: ${group.chapters.length}`,` · Chapters: ${group.chapters.length}`)));
        if(group.description)details.append(el('p',group.description,'season-description'));
        destination=el('ol',null,'collection-items');details.append(destination);wrapper.append(details);items.append(wrapper);
      }
      for(const {item,index:i} of group.chapters){
        const row=el('li',null,'collection-item');row.value=i+1;
        const found=targets.find(t=>targetKey(t)===targetKey(item.target)||t.key===item.target.key);
        const state=current?.dependencies?.find(child=>child.id===item.target.id);
        if(item.target.kind==='scenario')renderChapterOverview(row,item,i,chapterDetails.get(item.target.id)||state||found||{});
        else row.append(el('h4',`${i+1}. ${found?.title||item.target.key||item.target.id}`),link(words('Открыть состав','Open contents'),`/my-stories/?collection=${encodeURIComponent(item.target.id)}`));
        destination.append(row);
      }
    }
    chapters.append(items);
    if(!doc.items?.length)chapters.append(el("p",words("Глав пока нет. Добавьте первую и откройте её сцены в конструкторе.","No chapters yet. Add the first chapter to build its scenes.")));
    const addActions=el('div',null,'collection-actions');
    addActions.append(button(words("+ Добавить главу", "+ Add chapter"),()=>work(createChapter),"add-button"));
    addActions.append(button(words('+ Добавить сезон','+ Add season'),()=>seasonDialog({
      items:doc.items||[],
      titleFor:item=>chapterDetails.get(item.target.id)?.draftDocument?.title||targets.find(t=>targetKey(t)===targetKey(item.target))?.title||item.target.key||item.target.id,
      onAdd:({indices,id,name,description})=>{for(const i of indices)Object.assign(doc.items[i],{seasonId:id,season:name,seasonDescription:description});changed();renderEditor();}
    }),'add-button add-season'));
    chapters.append(addActions);
    editor.append(chapters);

    const actions=el("div",null,"collection-actions");
    actions.append(button(words("Сохранить", "Save"),()=>work(save),"add-button"));
    if(current){
      actions.append(button(words("Экспорт истории", "Export story"),()=>work(async()=>{download(await request(`${api}/${current.collectionId}/export`),`${current.key}.json`);status.textContent="";})));
      if(current.reviewState==="in_review")actions.append(button(words("Отозвать проверку истории", "Withdraw story review"),()=>work(async()=>{await request(`${api}/${current.collectionId}/withdraw`,{method:"POST",body:{generation:current.generation}});await open(current.collectionId);await loadList();})));
      if(!current.restricted&&current.visibility!=="archived"){
        actions.append(button(words("В архив","Archive"),()=>work(()=>takeDown(false))));
        if(!current.publishedRevision)actions.append(button(words("В корзину","Move to trash"),()=>work(()=>takeDown(true))));
      }
    }
    const primaryActions=el("div",null,"collection-actions story-primary-actions");primaryActions.append(actions.firstElementChild);primaryActions.hidden=aboutDialog.open||tabKey==='metadata';editor.append(primaryActions);advanced.append(actions);editor.append(advanced);
    if(tabKey==='metadata'&&!aboutDialog.open)aboutDialog.showModal();
    if(current){
      const previewHost=el("section");
      actions.append(button(words("Предпросмотр истории", "Preview story"),()=>work(async()=>{
        const value=await request(`${api}/${current.collectionId}/preview?revision=draft`);
        previewHost.replaceChildren(el("h3",words(`Предпросмотр — не опубликовано · редакция ${value.revision}`,`Private preview — not published · revision ${value.revision}`)));
        renderSnapshot(previewHost,value.document);
        previewHost.append(el("h4",words("Из этого оглавления читателю доступны сейчас", "Currently available to readers from these contents")));
        const items=el("ol");for(const item of value.readerItems||[])items.append(el("li",item.label||item.title||item.key));previewHost.append(items);
        if(value.validation&&!value.validation.valid)previewHost.append(el("p",(value.validation.errors||[]).join("\n")));
      })));advanced.append(previewHost);
      const dependencies=el("details");dependencies.append(el("summary",words("Состояния глав и зависимостей", "Chapter and dependency status")));
      for(const child of current.dependencies||[])dependencies.append(el("p",dependencyLabel(child)));advanced.append(dependencies);
    }
    if(current?.publishedRevision)editor.append(link(words("Открыть читательскую страницу", "Open reader page"),`/collections/${encodeURIComponent(current.key)}`));
  }
  async function takeDown(remove){
    const message=remove?words("Переместить историю в корзину? Её можно восстановить в течение 30 дней. Затем корзина очистится автоматически. Черновики глав сохранятся.","Move this story to trash? You can restore it for 30 days, after which trash clears automatically. Chapter drafts remain."):words("Переместить историю в архив? Её оглавление станет недоступно читателям. Отдельно опубликованные главы останутся доступны. Восстановление — через модератора.","Archive this story? Readers will lose access to its contents. Individually published chapters remain available. A moderator can restore the story.");
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
    await open(current.collectionId);await loadList();status.textContent=words("История и изменённые главы отправлены одной заявкой. После одобрения вы сможете опубликовать главы.", "The story and changed parts were sent as one application. After approval you can publish the chapters.");
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
    for(const [action,label] of current.visibility==="purged"?[]:options)actions.append(button(label,()=>work(async()=>{
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
    utilities.append(importButton);titleRow.append(create);
  }
  const filterChanged=()=>{if(!discard())return;dirty=false;current=null;doc=null;screen="list";editor.hidden=true;pageIndex=0;writeUrl(false,null);work(loadList);};toolbar.onsubmit=event=>{event.preventDefault();filterChanged();};query.input.onsearch=filterChanged;state.input.onchange=filterChanged;
  await loadList();
  if(params.get("collection")==="new"||params.get("create")==="1")await createNew(false);
  else if(params.get("collection")){const id=params.get("collection");const item=all.find(n=>(n.collectionId||n.id)===id);if(item?.kind==='scenario')await openStandalone(id);else await open(id);}
  else if(params.get("scenario")&&!moderation){
    const parents=await request(`/api/author/collections/parents?scenarioId=${encodeURIComponent(params.get("scenario"))}`);
    if(parents.length)await open(parents[0].id||parents[0].collectionId);
    else status.textContent=words("Это самостоятельная история. Откройте её из списка для редактирования сцен.", "This is a standalone story. Open it from the list to edit its scenes.");
  }
}
