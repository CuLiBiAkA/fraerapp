import {
  authorActions, authorFilters, canEditStories, canModerateStories, filterAfterSubmit, isOwnStory,
  matchesAuthorFilter, moderationActions, needsOwnOverride, node, publicStoryUrl,
  renderDocumentDiff, renderStoryDocument, revisionLabels, storyLabels, workflowLabel,
} from "./story-workflow.js?v=1";
import { reviewLimitMessage } from "./review-limit.js?v=1";
import {authorCard,coverImage,editorTabs,showAuthoringPrompts} from "./author-ui.js?v=1";
import {chooseCover,uploadImage} from "./author-cover.js?v=1";

const moderation = document.body.dataset.workspace === "moderation";
const root = document.querySelector("#workspace");
let language = "ru";try { language=localStorage.getItem("fraerapp.language")==="en"?"en":"ru"; }catch{}
document.documentElement.lang = language;
const choose = (ru, en) => language === "en" ? en : ru;
const t = key => workflowLabel(key, language);
const initialParams = new URLSearchParams(location.search);
const state = { user: null, items: [], all: [], page: 0, totalPages: 0, selected: initialParams.get("story"), detail: null, preview: null, previewRevision: null, loading: false, listRequest: 0, detailRequest: 0, previewRequest: 0 };
const decisionDrafts = new Map();
const apiBase = moderation ? "/api/moderation/stories" : "/api/author/stories";
const pageSize = 20;
let metadataDraft=null,metadataDirty=false,selectedTab="content",screen="list",historyIndex=0,restoringHistory=false,decisionPending=false;
history.replaceState({...history.state,authorIndex:0},"",location.href);
const discardMetadata=()=>!metadataDirty||confirm(choose("Есть несохранённые изменения. Перейти без сохранения?","There are unsaved changes. Leave without saving?"));
window.addEventListener("beforeunload",event=>{if(metadataDirty){event.preventDefault();event.returnValue="";}});
root.addEventListener("click",event=>{const anchor=event.target.closest("a[href]");if(!anchor||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||anchor.hasAttribute("download")||(anchor.target&&anchor.target!=="_self"))return;const destination=new URL(anchor.href,location.href);if(destination.origin===location.origin&&destination.pathname===location.pathname&&destination.search===location.search)return;if(metadataDirty){if(!discardMetadata())event.preventDefault();else metadataDirty=false;}});

function link(text, href, className) { const a = node("a", text, className); a.href = href; return a; }
function button(text, onClick, className) { const b = node("button", text, className); b.type = "button"; b.onclick = onClick; return b; }
function selectField(label, options, selected) {
  const field = node("label", label); const control = node("select");
  for (const [value, text] of options) { const option = node("option", text); option.value = value; option.selected = value === selected; control.append(option); }
  field.append(control); return { field, control };
}
function date(value) { return value ? new Date(value).toLocaleString(language === "en" ? "en-GB" : "ru-RU") : "—"; }
function errorText(error) {
  if (error.code === "REVIEW_LIMIT_REACHED") return reviewLimitMessage(language);
  if (error.status === 401) return choose("Сессия завершена. Войдите на главной и обновите страницу.", "Your session ended. Sign in on the home page and reload.");
  if (error.status === 403) return choose("Нет доступа. Права могли измениться: обновите страницу или обратитесь к администратору.", "Access denied. Your permissions may have changed: reload or contact an administrator.");
  if (error.status === 409) return choose("История изменилась. Загрузите актуальную редакцию и проверьте её перед новым решением.", "This story changed. Reload the current revision and inspect it before deciding again.");
  if (error.status === 404) return choose("История или редакция недоступна. Обновите список.", "This story or revision is unavailable. Refresh the list.");
  return error.message || choose("Не удалось загрузить данные. Повторите попытку.", "Could not load data. Try again.");
}
async function request(path, options = {}, retry = true) {
  const response = await fetch(path, { credentials: "include", cache: "no-store", ...options,
    headers: { Accept: "application/json", "X-Fraer-Request": "same-origin", ...(options.body ? {"Content-Type":"application/json"} : {}), ...options.headers } });
  if (response.status === 401 && retry) {
    const refresh = await fetch("/auth/refresh", { method: "POST", credentials: "include", cache: "no-store", headers: {"X-Fraer-Request":"same-origin"} });
    if (refresh.ok) return request(path, options, false);
  }
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!response.ok) { const error = new Error(data.message || data.detail || data.error || `HTTP ${response.status}`); error.status = response.status; error.code = data.code; throw error; }
  return data;
}

const header = node("header", null, "workspace-header");
const titleGroup = node("div");
const nav = node("nav", null, "workspace-nav"); nav.setAttribute("aria-label", choose("Навигация", "Navigation"));
nav.append(link(choose("← На главную", "← Home"), "/"), link(choose("Библиотека", "Library"), "/history"));
const myLink = link(choose("Мои истории", "My stories"), "/my-stories/");
const moderationLink = link(choose("Модерация", "Moderation"), "/moderation/");
const builderLink = link(choose("Конструктор", "Builder"), "/builder/");
myLink.hidden = moderationLink.hidden = builderLink.hidden = true;
nav.append(myLink, moderationLink, builderLink);
titleGroup.append(nav, node("h1", moderation ? choose("Модерация историй", "Story moderation") : choose("Мои истории", "My stories")));
const intro = node("p", moderation ? choose("Проверяйте точную редакцию. Публикация доступна только после одобрения.", "Review the exact revision. Publishing requires approval.") : choose("Все ваши работы, заявки и решения. Черновики доступны только вам и проверяющим." , "All your work, submissions and decisions. Drafts are private to you and reviewers."));
titleGroup.append(intro); header.append(titleGroup);
if(!moderation)header.append(link(choose("+ Создать историю","+ Create story"),"/my-stories/?create=1","workspace-button primary"));
const sessionStatus = node("p", choose("Проверяем вход…", "Checking sign-in…"), "workspace-status"); sessionStatus.setAttribute("role", "status");
const status = node("p", "", "workspace-status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
const controls = node("form", null, `workspace-controls${moderation ? "" : " author"}`);
const searchLabel = node("label", choose("Поиск по названию, ключу, автору", "Search title, key or author"));
const search = node("input"); search.type = "search"; search.maxLength = 200; searchLabel.append(search);
const filter = selectField(choose("Состояние", "Status"), (moderation ? ["all", "in_review", "draft", "approved", "rejected"] : [...authorFilters.filter(key=>key!=="trash"),"approved","hidden","unlisted"]).map(key => [key, t(key)]), moderation ? "in_review" : "all");
const visibility = selectField(choose("Доступность", "Visibility"), ["all", "public", "unlisted", "private", "hidden", "archived", "deleted"].map(key => [key, t(key)]), "all");
const refreshButton = button(choose("Обновить", "Refresh"), () => refreshAll());
controls.append(searchLabel, filter.field); if (moderation) controls.append(visibility.field); controls.append(refreshButton);
let trashView=initialParams.get("trash")==="1";
const scopes=node("div",null,"author-utilities");
if(!moderation){for(const [value,label] of [[false,choose("Истории","Stories")],[true,choose("Корзина","Trash")]]){const control=button(label,()=>{trashView=value;state.page=0;refreshScopes();reloadList();});control.dataset.trash=String(value);scopes.append(control);}}
function refreshScopes(){scopes.querySelectorAll("button").forEach(control=>control.setAttribute("aria-pressed",String(control.dataset.trash===String(trashView))));filter.control.disabled=trashView;}
refreshScopes();
const grid = node("div", null, "workspace-grid");
const listColumn = node("section"); listColumn.setAttribute("aria-label", choose("Список историй", "Story list"));
const list = node("div", null, "workspace-list"); list.id = "workspace-list"; list.tabIndex = -1;
const pagination = node("nav", null, "workspace-pagination"); pagination.setAttribute("aria-label", choose("Страницы списка", "List pages"));
const previous = button(choose("← Назад", "← Previous"), () => changePage(-1));
const pageLabel = node("span");
const next = button(choose("Далее →", "Next →"), () => changePage(1)); pagination.append(previous, pageLabel, next);
listColumn.append(list, pagination);
const detailPanel = node("section", null, "workspace-detail"); detailPanel.setAttribute("aria-label", choose("История и редакции", "Story and revisions"));
detailPanel.append(node("p", choose("Выберите историю, чтобы открыть редакции и решения.", "Select a story to inspect its revisions and decisions.")));
grid.append(listColumn, detailPanel); controls.hidden = grid.hidden = true;
const backLink=link(choose(moderation?"← К заявкам":"← К моим историям",moderation?"← Applications":"← My stories"),moderation?"/moderation/":"/my-stories/","workspace-button author-back");backLink.hidden=true;
root.append(header,backLink, sessionStatus, controls,scopes,status, grid);
function showScreen(value,focus=false){screen=value;listColumn.hidden=value!=="list";detailPanel.hidden=value!=="editor";controls.hidden=header.hidden=scopes.hidden=value!=="list";backLink.hidden=value!=="editor";if(focus)requestAnimationFrame(()=>{const target=value==="editor"?detailPanel.querySelector("h2"):list.querySelector(`[data-work-id="${CSS.escape(state.selected||"")}"]`)||list;target?.focus();window.scrollTo({top:0,behavior:"instant"});});}
backLink.onclick=event=>{if(historyIndex>0){event.preventDefault();if(discardMetadata()){metadataDirty=false;history.back();}}};
window.addEventListener("popstate",()=>{const next=history.state?.authorIndex??0;if(restoringHistory){restoringHistory=false;return;}if(state.loading||decisionPending){restoringHistory=true;history.go(historyIndex-next);setStatus(choose("Дождитесь завершения текущего действия.","Wait for the current action to finish."));return;}if(!discardMetadata()){restoringHistory=true;history.go(historyIndex-next);return;}metadataDirty=false;historyIndex=next;const id=new URLSearchParams(location.search).get("story");if(id)openStory(id,true,false).catch(error=>setStatus(errorText(error),true));else{++state.detailRequest;showScreen("list",true);}});
showScreen("list");

function setStatus(message, error = false) { status.textContent = message; status.classList.toggle("error", error); }
function setBusy(value) { state.loading = value; root.setAttribute("aria-busy", String(value)); refreshButton.disabled = value; }
function updateNavigation() {
  myLink.hidden = !state.user || !moderation;
  moderationLink.hidden = moderation || !canModerateStories(state.user);
  builderLink.hidden = !canEditStories(state.user);
}
async function refreshSession() {
  state.user = await request("/auth/me");
  if (state.user.blocked || (moderation && !canModerateStories(state.user))) { const error = new Error(); error.status = 403; throw error; }
  updateNavigation();
  sessionStatus.textContent = moderation
    ? choose("Доступ проверен: модератор / администратор.", "Access verified: moderator / administrator.")
    : canEditStories(state.user) ? choose("Изменения сохраняются в черновик. Решения принимаются в панели модерации.", "Edits are saved as drafts. Decisions are made in the moderation panel.")
      : choose("Только чтение: ваши работы и решения сохранены. Для редактирования нужна роль автора.", "Read only: your work and decisions are retained. Editing requires the author role.");
}
async function refreshAll() {
  setBusy(true);
  try { await refreshSession(); grid.hidden = false; await loadList(); if (state.selected) await openStory(state.selected, false);else showScreen("list"); }
  catch (error) { sessionStatus.textContent = errorText(error); sessionStatus.classList.add("error"); if ([401,403].includes(error.status)) { controls.hidden = grid.hidden = true; sessionStatus.append(document.createTextNode(" "), link(choose("На главную", "Go home"), "/")); } }
  finally { setBusy(false); }
}
async function loadList() {
  const current = ++state.listRequest;
  list.setAttribute("aria-busy", "true");
  setStatus(choose("Загружаем истории…", "Loading stories…"));
  try {
    if (moderation) {
      const params = new URLSearchParams({ page: state.page, size: pageSize, q: search.value, status: filter.control.value, visibility: visibility.control.value });
      const data = await request(`${apiBase}?${params}`);
      if (current !== state.listRequest) return;
      const lastPage = Math.max(0, data.totalPages - 1);
      if (state.page > lastPage) { state.page = lastPage; return await loadList(); }
      state.items = data.items; state.totalPages = data.totalPages;
    } else {
      const data = await request(apiBase);
      if (current !== state.listRequest) return;
      state.all = Array.isArray(data) ? data : data.stories;
      const selected=trashView?"trash":filter.control.value;
      const filtered = state.all.filter(story => ["approved","hidden","unlisted"].includes(selected)?matchesAuthorFilter(story,"all",search.value)&&(selected==="approved"?story.reviewState===selected:story.visibility===selected):matchesAuthorFilter(story,selected,search.value));
      state.totalPages = Math.ceil(filtered.length / pageSize);
      state.page = Math.min(state.page, Math.max(0, state.totalPages - 1));
      state.items = filtered.slice(state.page * pageSize, (state.page + 1) * pageSize);
    }
    renderList(); setStatus("");
  } catch (error) { if (current === state.listRequest) setStatus(errorText(error), true); throw error; }
  finally { if (current === state.listRequest) list.setAttribute("aria-busy", "false"); }
}
function renderList() {
  list.replaceChildren();
  if (!state.items.length) list.append(node("p", choose("Здесь пока нет историй. Измените поиск или фильтр.", "No stories here yet. Try another search or filter."), "workspace-notice"));
  for (const story of state.items) {
    const open = button(moderation?choose("Проверить историю","Review story"):choose(story.visibility==="deleted"?"Просмотреть":"Открыть историю",story.visibility==="deleted"?"View":"Open story"), () => {if(discardMetadata())openStory(story.storyId, true,true).catch(error => setStatus(errorText(error), true));});open.dataset.workId=story.storyId;
    const card=authorCard({title:story.title||story.key,coverUrl:story.coverUrl,status:storyLabels(story,language).join(" · "),description:story.description,action:open,caption:story.reason});
    list.append(card);
  }
  previous.disabled = state.page <= 0; next.disabled = state.page + 1 >= state.totalPages;
  pageLabel.textContent = `${state.totalPages ? state.page + 1 : 0} / ${state.totalPages}`;
  pagination.hidden = state.totalPages < 2;
}
function badges(story) { const row = node("div", null, "workspace-badges"); for (const label of storyLabels(story, language)) row.append(node("span", label, "workspace-badge")); return row; }
async function changePage(offset) { if (state.loading) return; state.page += offset; await reloadList(); }
async function reloadList() { setBusy(true); try { await loadList(); } catch { /* Visible status is set by loadList. */ } finally { setBusy(false); } }
controls.onsubmit = event => { event.preventDefault(); state.page = 0; reloadList(); };
for (const control of [filter.control, visibility.control]) control.onchange = () => { state.page = 0; reloadList(); };
search.onsearch = () => { state.page = 0; reloadList(); };

async function openStory(id, focus,push=false) {
  const current = ++state.detailRequest; ++state.previewRequest;
  state.selected = id; state.preview = null; state.detail = null;
  detailPanel.setAttribute("aria-busy", "true");
  detailPanel.replaceChildren(node("p", choose("Загружаем редакции…", "Loading revisions…")));
  renderList();
  try {
    const detail = await request(`${apiBase}/${encodeURIComponent(id)}`);
    if (current !== state.detailRequest) return;
    state.detail = detail;metadataDraft=structuredClone(detail.draftDocument||{});metadataDirty=false;
    const params = new URLSearchParams(location.search); params.set("story", id); params.delete("revision");if(push)historyIndex++;history[push?"pushState":"replaceState"]({authorIndex:historyIndex}, "", `${location.pathname}?${params}`);
    renderDetail();
    showScreen("editor",focus);
    const requested = Number(initialParams.get("revision"));
    const allowed = (detail.versions || []).some(version => version.versionNumber === requested);
    await loadPreview(allowed ? requested : detail.submittedRevision || detail.draftRevision, current);
    initialParams.delete("revision");
    if (focus) { detailPanel.querySelector("h2")?.focus(); if (matchMedia("(max-width:720px)").matches) detailPanel.scrollIntoView({block:"start"}); }
  } catch (error) { if (current === state.detailRequest) detailPanel.replaceChildren(node("p", errorText(error), "workspace-status error"), button(choose("Повторить", "Retry"), () => openStory(id, true).catch(error => setStatus(errorText(error), true)))); throw error; }
  finally { if (current === state.detailRequest) detailPanel.setAttribute("aria-busy", "false"); }
}
let previewNode, actionsNode, revisionSelect;
function renderDetail() {
  const story = state.detail; detailPanel.replaceChildren();
  const title = node("h2", story.title); title.tabIndex = -1; detailPanel.append(title, badges(story));
  const metadata = node("dl");
  for (const [label, value] of [
    [choose("Автор", "Author"), `${story.ownerName || "—"}${moderation ? ` · ${story.ownerUserId || choose("Системная история", "System story")}` : ""}`],
    [choose("Доступность", "Visibility"), t(story.visibility)], [choose("Отправлена", "Submitted"), date(story.submittedAt)],
    [choose("Решение", "Decision"), date(story.decidedAt)], [choose("Проверяющий", "Reviewer"), story.reviewerId || "—"],
  ]) metadata.append(node("dt", label), node("dd", value));
  const technical=node("details");technical.append(node("summary",choose("Сведения о редакциях","Revision details")),metadata);
  if(moderation)detailPanel.append(metadata);
  if (story.reason) detailPanel.append(node("p", `${choose("Причина / замечания", "Reason / feedback")}: ${story.reason}`, "workspace-notice"));
  if (story.visibility === "deleted") detailPanel.append(node("p", choose("История в корзине. Данные и решения сохранены; восстановление выполняется в модерации и не публикует историю.", "This story is in trash. Data and decisions are retained; moderation can restore it as private."), "workspace-notice"));
  if (moderation && isOwnStory(story, state.user)) detailPanel.append(node("p", state.user.roles.includes("admin")
    ? choose("Это ваша история. Одобрение и снятие ограничений требуют явного административного исключения с причиной.", "This is your story. Approval and restoring access require an explicit administrator override with a reason.")
    : choose("Это ваша история. Одобрение и снятие ограничений выполняет другой проверяющий.", "This is your story. Another reviewer must approve it or restore access."), "workspace-notice"));
  const content=node("section",null,"author-chapters"),about=node("section",null,"author-metadata");
  if(!moderation){detailPanel.append(editorTabs([["content",choose("Содержание","Content"),content],["metadata",choose("Об истории","About story"),about]],selectedTab,key=>{selectedTab=key;}));renderMetadata(about);}
  const contentHost=moderation?detailPanel:content;
  if(!moderation)contentHost.append(technical);
  actionsNode = node("div", null, "workspace-actions"); contentHost.append(actionsNode); renderActions();
  const previewHeading = node("div", null, "workspace-preview-heading");
  const versions = story.versions || [];
  const versionOptions = versions.map(version => [String(version.versionNumber), `v${version.versionNumber}${revisionRole(story, version.versionNumber)}`]);
  const field = selectField(choose("Приватный предпросмотр редакции", "Private revision preview"), versionOptions, ""); revisionSelect = field.control;
  revisionSelect.onchange = () => loadPreview(Number(revisionSelect.value)).catch(error => setStatus(errorText(error), true)); previewHeading.append(field.field);
  contentHost.append(previewHeading);
  previewNode = node("div"); contentHost.append(previewNode);
  const historySection = node("details"); historySection.open = moderation;
  historySection.append(node("summary", choose("История решений", "Decision history")));
  const events = node("ol", null, "workspace-events");
  for (const event of story.events || []) {
    const item = node("li"); item.append(node("strong", `${t(event.action)}${event.revision ? ` · v${event.revision}` : ""}`));
    item.append(node("small", `${date(event.createdAt)}${event.actorId || event.reviewerId ? ` · ${event.actorId || event.reviewerId}` : ""}${event.actorRole ? ` · ${event.actorRole}` : ""}`));
    if (event.beforeState || event.afterState) item.append(node("small", `${event.beforeState || "—"} → ${event.afterState || "—"}`));
    if (event.reason) item.append(node("p", event.reason));
    if (moderation && event.internalNote) item.append(node("p", `${choose("Внутренняя заметка", "Internal note")}: ${event.internalNote}`));
    events.append(item);
  }
  if (!story.events?.length) events.append(node("li", choose("Решений пока нет.", "No decisions yet.")));
  historySection.append(events); contentHost.append(historySection);if(!moderation)detailPanel.append(content,about);
}
function renderMetadata(container){
  const editable=canEditStories(state.user)&&state.detail.visibility!=="deleted";
  if(!editable){container.append(node("p",choose("Только чтение","Read only")),node("p",metadataDraft.description||""));return;}
  const fields=node("div",null,"collection-fields");
  for(const [key,label,multiline] of [["title",choose("Название","Title")],["description",choose("Описание","Description"),true],["genre",choose("Жанры","Genres")]]){
    const field=node("label",label),control=node(multiline?"textarea":"input");control.value=metadataDraft[key]||"";control.maxLength=multiline?5000:200;control.oninput=()=>{metadataDraft[key]=control.value;metadataDirty=true;setStatus(choose("Есть несохранённые изменения в форме.","There are unsaved changes in this form."));};field.append(control);fields.append(field);
  }
  const completion=selectField(choose("Завершённость","Completion"),[["in_development",choose("В разработке","In progress")],["completed",choose("Завершено","Completed")],["abandoned",choose("Приостановлено","Paused")]],metadataDraft.completionStatus||"in_development");completion.control.onchange=()=>{metadataDraft.completionStatus=completion.control.value;metadataDirty=true;};fields.append(completion.field);container.append(fields);
  const cover=node("div",null,"author-cover-setting");
  function renderCover(){cover.replaceChildren(coverImage(metadataDraft.metadata?.coverUrl),button(choose("Выбрать обложку","Choose cover"),()=>chooseCover({url:metadataDraft.metadata?.coverUrl,getImages:async()=>[...(metadataDraft.assets||[]),...(metadataDraft.scenes||[]).flatMap(scene=>scene.assets||[])].filter(asset=>asset.type==="image").map(asset=>({url:asset.url,filename:asset.id})),upload:file=>uploadImage(`${apiBase}/${encodeURIComponent(state.selected)}/assets`,file,{type:"image",assetKey:"story_cover",scope:"local"}),onSelect:url=>{metadataDraft.metadata={...(metadataDraft.metadata||{}),coverUrl:url};metadataDirty=true;renderCover();setStatus(choose("Есть несохранённые изменения в форме.","There are unsaved changes in this form."));}})));}renderCover();container.append(cover);
  container.append(node("p",choose("Сцены этой самостоятельной истории редактируются в конструкторе. Её адрес и сохранения читателей сохраняются.","Edit this standalone story’s scenes in the Builder. Its address and reader saves are retained.")));
  container.append(button(choose("Сохранить","Save"),async()=>{
    if(state.loading)return;setBusy(true);
    try{await request(`${apiBase}/${encodeURIComponent(state.selected)}`,{method:"PUT",body:JSON.stringify({generation:state.detail.generation,document:metadataDraft})});metadataDirty=false;await openStory(state.selected,false);await loadList();setStatus(choose("Черновик сохранён. Публикация не изменилась.","Draft saved. Publication is unchanged."));}
    catch(error){setStatus(errorText(error)+choose(" Ваш текст остаётся в форме."," Your text remains in the form."),true);
      if([401,403,409].includes(error.status)){
        status.append(document.createTextNode(" "),button(choose("Скачать мой черновик","Download my draft"),async()=>{const {download}=await import('./collection-ui.js?v=5');download(metadataDraft,`${metadataDraft.key||'story'}-draft.json`);}));
        status.append(button(choose("Загрузить актуальную редакцию","Reload current revision"),()=>{if(discardMetadata())openStory(state.selected,true).catch(next=>setStatus(errorText(next),true));}));
      }
    }
    finally{setBusy(false);}
  },"primary"));
  container.append(button(choose("Промпты для ИИ","AI prompts"),()=>showAuthoringPrompts({kind:"chapter",getContext:kind=>{if(kind!=="chapter")throw new Error(choose("Для самостоятельной истории выберите формат главы.","Choose the chapter format for a standalone story."));return structuredClone(metadataDraft);}}).catch(error=>setStatus(errorText(error),true))));
}
function revisionRole(story, revision) {
  const roles = revisionLabels(story, revision, language);
  return roles.length ? ` · ${roles.join(" / ")}` : "";
}
function renderActions() {
  const story = state.detail; if (!story || !actionsNode) return;
  actionsNode.replaceChildren();
  if(!moderation&&story.reviewLimitReached)actionsNode.append(node("p",reviewLimitMessage(language),"workspace-notice"));
  const publicUrl = publicStoryUrl(story); if (publicUrl) actionsNode.append(link(choose("Открыть публикацию", "Open publication"), publicUrl, "workspace-button"));
  const actions = moderation ? moderationActions(story, state.user) : authorActions(story, state.user);
  for (const action of actions) {
    if (action === "edit") { actionsNode.append(link(t(action), `/builder/?story=${encodeURIComponent(story.storyId)}`, "workspace-button")); continue; }
    const reviewing = ["approve", "approve-publish", "publish-approved", "reject"].includes(action);
    const label = moderation && needsOwnOverride(action, story, state.user) ? `${t(action)} · ${choose("своя история", "own story")}` : t(action);
    const control = button(label, () => showDecision(action), ["approve-publish", "submit", "publish-approved"].includes(action) ? "primary" : ["hide", "delete"].includes(action) ? "danger" : "");
    if(action==='submit'&&story.reviewLimitReached){control.disabled=true;control.title=reviewLimitMessage(language);}
    if (reviewing && (!state.preview || state.previewRevision !== story.submittedRevision)) { control.disabled = true; control.title = choose("Сначала откройте отправленную редакцию", "Open the submitted revision first"); }
    actionsNode.append(control);
  }
}
async function loadPreview(revision, detailRequest = state.detailRequest) {
  const story = state.detail; if (!story || !revision) return;
  const current = ++state.previewRequest; state.preview = null; renderActions();
  previewNode.replaceChildren(node("p", choose("Загружаем приватный снимок…", "Loading private snapshot…"))); revisionSelect.disabled = true;
  try {
    const preview = await request(`${apiBase}/${encodeURIComponent(story.storyId)}/preview?revision=${encodeURIComponent(revision)}`);
    if (current !== state.previewRequest || detailRequest !== state.detailRequest) return;
    state.preview = preview; state.previewRevision = preview.revision; revisionSelect.value = String(preview.revision);
    previewNode.replaceChildren(node("p", `${choose("Предпросмотр — не опубликовано", "Preview — not a publication")} · v${preview.revision}${revisionRole(story, preview.revision)}\n${choose("Снимок только для чтения. Просмотры, прохождения, сохранения и оценки не создаются.", "Read-only snapshot. No views, playthroughs, saves or ratings are created.")}`, "workspace-notice"));
    const validation = preview.validation || {};
    previewNode.append(node("p", validation.valid ? choose("Техническая проверка: ошибок нет.", "Validation: no errors.") : choose("Техническая проверка: есть ошибки.", "Validation: errors found.")));
    if (validation.errors?.length) { const errors = node("ul"); for (const error of validation.errors) errors.append(node("li", typeof error === "string" ? error : JSON.stringify(error))); previewNode.append(errors); }
    if (!moderation && canEditStories(state.user) && story.visibility !== "deleted") {
      previewNode.append(button(choose("Создать черновик из этой редакции", "Create draft from this revision"), () => showDecision("rollback")));
    }
    const diff = node("details"); diff.append(node("summary", choose("Различия с опубликованной редакцией", "Differences from the published revision")), renderDocumentDiff(preview.publishedDocument, preview.document, language)); previewNode.append(diff, renderStoryDocument(preview.document, language));
    renderActions();
  } catch (error) { if (current === state.previewRequest) previewNode.replaceChildren(node("p", errorText(error), "workspace-status error"), button(choose("Повторить", "Retry"), () => loadPreview(revision).catch(error => setStatus(errorText(error), true)))); }
  finally { if (current === state.previewRequest) revisionSelect.disabled = false; }
}

const dialog = node("dialog", null, "workspace-dialog"); dialog.setAttribute("aria-labelledby", "decision-title"); document.body.append(dialog);
function showDecision(action) {
  const story = state.detail; if (!story) return;
  if(metadataDirty&&!discardMetadata())return;
  const key = `${story.storyId}:${action}`;
  const retained = decisionDrafts.get(key) || {};
  const override = moderation && needsOwnOverride(action, story, state.user);
  const replacing = !moderation && action === "submit" && story.reviewState === "in_review";
  const revision = action === "rollback" ? state.previewRevision : story.submittedRevision;
  const form = node("form");
  const title = node("h2", `${action === "rollback" ? choose("Создать черновик", "Create draft") : t(action)}: «${story.title}»`); title.id = "decision-title";
  let consequence = moderation ? choose("Решение будет записано в историю. Причина доступна автору.", "This decision will be recorded. The author can read the reason.") : "";
  if (action === "approve") consequence = choose("Одобряется только просмотренная редакция. Публикация сейчас не меняется.", "Only the inspected revision is approved. Publication remains unchanged.");
  if (["approve-publish", "publish-approved"].includes(action)) consequence = choose(`Читателям станет доступна редакция v${revision}. Рабочий черновик не публикуется.`, `Readers will receive revision v${revision}. The working draft is not published.`);
  if (["hide", "archive", "delete"].includes(action)) consequence = choose("История станет недоступна читателям, включая начатые прохождения. Данные, прогресс и решения сохранятся.", "Readers will lose access, including existing playthroughs. Data, progress and decisions are retained.");
  if (action === "restore") consequence = choose("История восстановится как приватная. Для читателей её нужно опубликовать отдельным действием.", "The story will be restored as private. Publishing for readers requires a separate action.");
  if (action === "submit") consequence = replacing
    ? choose(`Заявка v${story.submittedRevision} будет заменена черновиком v${story.draftRevision}. Старую заявку больше нельзя будет одобрить.`, `Submission v${story.submittedRevision} will be replaced by draft v${story.draftRevision}. The old submission can no longer be approved.`)
    : choose(`На проверку отправится сохранённый на сервере черновик v${story.draftRevision}. Публикация не меняется.`, `Server draft v${story.draftRevision} will be submitted. Publication remains unchanged.`);
  if (action === "withdraw") consequence = choose("Текущую заявку больше нельзя будет одобрить. Черновик и предыдущая публикация сохранятся.", "The current submission can no longer be approved. The draft and previous publication are retained.");
  if (action === "rollback") consequence = choose(`Из v${revision} будет создан новый черновик. Одобрение и публикация не переносятся; текущая заявка не меняется.`, `A new draft will be created from v${revision}. Approval and publication are not inherited; the current submission is unchanged.`);
  form.append(title, node("p", consequence));
  const reasonLabel = node("label", choose("Причина для автора", "Reason for the author")); const reason = node("textarea"); reason.rows = 3; reason.maxLength = 2000; reason.value = retained.reason || "";
  reason.required = moderation && (!["approve", "approve-publish"].includes(action) || override); reasonLabel.append(reason);
  const noteLabel = node("label", choose("Внутренняя заметка — только проверяющим", "Internal note — reviewers only")); const note = node("textarea"); note.rows = 3; note.maxLength = 2000; note.value = retained.note || ""; noteLabel.append(note);
  if (moderation) { if (!reason.required) reasonLabel.prepend(document.createTextNode(choose("Необязательно · ", "Optional · "))); form.append(reasonLabel, noteLabel); }
  const ownLabel = node("label", choose("Я явно разрешаю административное исключение для собственной истории и указал причину.", "I explicitly authorize an administrator override for my own story and have provided a reason."), "workspace-checkbox");
  const own = node("input"); own.type = "checkbox"; own.required = override; ownLabel.prepend(own); if (override) form.append(ownLabel);
  const publishChoices = action === "visibility" ? (story.publishedRevision ? ["public", "unlisted", "private"] : ["private"]) : ["public", "unlisted"];
  const visibilityField = selectField(choose("Доступность после действия", "Visibility after this action"), publishChoices.map(value => [value,t(value)]), publishChoices.includes(story.visibility) ? story.visibility : publishChoices[0]);
  if (moderation && ["visibility", "approve-publish", "publish-approved"].includes(action)) form.append(visibilityField.field);
  const feedback = node("p", "", "workspace-status"); feedback.setAttribute("role", "alert");
  const actions = node("div", null, "workspace-actions");
  const cancel = button(choose("Отмена", "Cancel"), () => dialog.close());
  const submit = node("button", replacing ? choose("Заменить заявку", "Replace submission") : choose("Подтвердить", "Confirm"), "primary"); submit.type = "submit";
  actions.append(cancel, submit); form.append(feedback, actions); dialog.replaceChildren(form);
  const remember = () => decisionDrafts.set(key, { reason: reason.value, note: note.value }); reason.oninput = note.oninput = remember;
  let pending = false;
  dialog.oncancel = event => { if (pending) event.preventDefault(); };
  form.onsubmit = async event => {
    event.preventDefault(); if (pending) return; remember(); pending = decisionPending = true; submit.disabled = cancel.disabled = true; feedback.textContent = choose("Сохраняем решение…", "Saving decision…");
    try {
      let path = `${apiBase}/${encodeURIComponent(story.storyId)}`;
      let method = "POST", body;
      if (moderation) { path += `/${action}`; body = { generation: story.generation, revision: story.submittedRevision || state.previewRevision, reason: reason.value.trim(), internalNote: note.value.trim(), ownOverride: override && own.checked, visibility: visibilityField.control.value }; }
      else if (action === "delete") method = "DELETE";
      else if (action === "rollback") path += `/versions/${revision}/rollback`;
      else { path += `/${action === "submit" ? "review" : action}`; if (["submit", "withdraw"].includes(action)) body = { generation: story.generation, replaceReview: replacing }; }
      const result = await request(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      decisionDrafts.delete(key); dialog.close();
      if (action === "submit") { filter.control.value = filterAfterSubmit(filter.control.value); state.page = 0; }
      await loadList(); await openStory(story.storyId, true);
      setStatus(action === "submit" ? choose(`Редакция v${result.submittedRevision} отправлена на согласование.`, `Revision v${result.submittedRevision} submitted for review.`) : choose("Изменение сохранено. Данные обновлены.", "Change saved. Data refreshed."));
    } catch (error) {
      feedback.textContent = errorText(error); feedback.classList.add("error");
      if (error.status === 409) {
        const reload = button(choose("Загрузить актуальную редакцию", "Reload current revision"), async () => { dialog.close(); await openStory(story.storyId, true).catch(error => setStatus(errorText(error), true)); await reloadList(); });
        feedback.append(document.createTextNode(" "), reload); submit.hidden = true;
        reload.focus();
      }
    } finally { pending = decisionPending = false; submit.disabled = cancel.disabled = false; }
  };
  dialog.showModal();
}

await refreshAll();
window.addEventListener("focus", async () => { if (!dialog.open && !state.loading) {
  if(metadataDirty){try{await refreshSession();const allowed=canEditStories(state.user);renderActions();detailPanel.querySelectorAll("input,textarea").forEach(control=>control.readOnly=!allowed);detailPanel.querySelectorAll("select,button:not([role=tab])").forEach(control=>{
    if(!allowed){control.dataset.disabledBeforePermission??=String(control.disabled);control.disabled=true;}
    else if(control.dataset.disabledBeforePermission!==undefined){control.disabled=control.dataset.disabledBeforePermission==="true";delete control.dataset.disabledBeforePermission;}
  });if(!allowed)setStatus(choose("Право редактирования изменилось. Ваш текст сохранён в форме; скопируйте его перед выходом.","Editing permission changed. Your text remains in the form; copy it before leaving."),true);}catch(error){setStatus(errorText(error),true);}}
  else if(screen==="editor")refreshAll();
}});
