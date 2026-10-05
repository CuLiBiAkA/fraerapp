import {
  authorActions, authorFilters, canEditStories, canModerateStories, filterAfterSubmit, isOwnStory,
  matchesAuthorFilter, moderationActions, needsOwnOverride, node, publicStoryUrl,
  renderDocumentDiff, renderStoryDocument, revisionLabels, storyLabels, workflowLabel,
} from "./story-workflow.js?v=1";

const moderation = document.body.dataset.workspace === "moderation";
const root = document.querySelector("#workspace");
const language = localStorage.getItem("fraerapp.language") === "en" ? "en" : "ru";
document.documentElement.lang = language;
const choose = (ru, en) => language === "en" ? en : ru;
const t = key => workflowLabel(key, language);
const initialParams = new URLSearchParams(location.search);
const state = { user: null, items: [], all: [], page: 0, totalPages: 0, selected: initialParams.get("story"), detail: null, preview: null, previewRevision: null, loading: false, listRequest: 0, detailRequest: 0, previewRequest: 0 };
const decisionDrafts = new Map();
const apiBase = moderation ? "/api/moderation/stories" : "/api/author/stories";
const pageSize = 20;

function link(text, href, className) { const a = node("a", text, className); a.href = href; return a; }
function button(text, onClick, className) { const b = node("button", text, className); b.type = "button"; b.onclick = onClick; return b; }
function selectField(label, options, selected) {
  const field = node("label", label); const control = node("select");
  for (const [value, text] of options) { const option = node("option", text); option.value = value; option.selected = value === selected; control.append(option); }
  field.append(control); return { field, control };
}
function date(value) { return value ? new Date(value).toLocaleString(language === "en" ? "en-GB" : "ru-RU") : "—"; }
function errorText(error) {
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
  if (!response.ok) { const error = new Error(data.message || data.detail || data.error || `HTTP ${response.status}`); error.status = response.status; throw error; }
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
const sessionStatus = node("p", choose("Проверяем вход…", "Checking sign-in…"), "workspace-status"); sessionStatus.setAttribute("role", "status");
const status = node("p", "", "workspace-status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
const controls = node("form", null, `workspace-controls${moderation ? "" : " author"}`);
const searchLabel = node("label", choose("Поиск по названию, ключу, автору", "Search title, key or author"));
const search = node("input"); search.type = "search"; search.maxLength = 200; searchLabel.append(search);
const filter = selectField(choose("Состояние", "Status"), (moderation ? ["all", "in_review", "draft", "approved", "rejected"] : authorFilters).map(key => [key, t(key)]), moderation ? "in_review" : "all");
const visibility = selectField(choose("Доступность", "Visibility"), ["all", "public", "unlisted", "private", "hidden", "archived", "deleted"].map(key => [key, t(key)]), "all");
const refreshButton = button(choose("Обновить", "Refresh"), () => refreshAll());
controls.append(searchLabel, filter.field); if (moderation) controls.append(visibility.field); controls.append(refreshButton);
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
root.append(header, sessionStatus, controls, status, grid);

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
  try { await refreshSession(); controls.hidden = grid.hidden = false; await loadList(); if (state.selected) await openStory(state.selected, false); }
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
      const filtered = state.all.filter(story => matchesAuthorFilter(story, filter.control.value, search.value));
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
    const card = node("article", null, `workspace-card${story.storyId === state.selected ? " selected" : ""}`);
    const heading = node("h2"); const open = button(story.title || story.key, () => openStory(story.storyId, true).catch(error => setStatus(errorText(error), true)), "workspace-card-open");
    open.setAttribute("aria-pressed", String(story.storyId === state.selected)); heading.append(open); card.append(heading, badges(story));
    card.append(node("p", `${story.ownerName || "—"} · ${story.key}`));
    if (story.submittedAt) card.append(node("small", `${choose("Отправлена", "Submitted")}: ${date(story.submittedAt)}`));
    if (story.decidedAt) card.append(node("small", `${choose("Решение", "Decision")}: ${date(story.decidedAt)}`));
    if (story.reason) card.append(node("p", story.reason));
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

async function openStory(id, focus) {
  const current = ++state.detailRequest; ++state.previewRequest;
  state.selected = id; state.preview = null; state.detail = null;
  detailPanel.setAttribute("aria-busy", "true");
  detailPanel.replaceChildren(node("p", choose("Загружаем редакции…", "Loading revisions…")));
  renderList();
  try {
    const detail = await request(`${apiBase}/${encodeURIComponent(id)}`);
    if (current !== state.detailRequest) return;
    state.detail = detail;
    const params = new URLSearchParams(location.search); params.set("story", id); params.delete("revision"); history.replaceState({}, "", `${location.pathname}?${params}`);
    renderDetail();
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
  detailPanel.append(metadata);
  if (story.reason) detailPanel.append(node("p", `${choose("Причина / замечания", "Reason / feedback")}: ${story.reason}`, "workspace-notice"));
  if (story.visibility === "deleted") detailPanel.append(node("p", choose("История в корзине. Данные и решения сохранены; восстановление выполняется в модерации и не публикует историю.", "This story is in trash. Data and decisions are retained; moderation can restore it as private."), "workspace-notice"));
  if (moderation && isOwnStory(story, state.user)) detailPanel.append(node("p", state.user.roles.includes("admin")
    ? choose("Это ваша история. Одобрение и снятие ограничений требуют явного административного исключения с причиной.", "This is your story. Approval and restoring access require an explicit administrator override with a reason.")
    : choose("Это ваша история. Одобрение и снятие ограничений выполняет другой проверяющий.", "This is your story. Another reviewer must approve it or restore access."), "workspace-notice"));
  actionsNode = node("div", null, "workspace-actions"); detailPanel.append(actionsNode); renderActions();
  const previewHeading = node("div", null, "workspace-preview-heading");
  const versions = story.versions || [];
  const versionOptions = versions.map(version => [String(version.versionNumber), `v${version.versionNumber}${revisionRole(story, version.versionNumber)}`]);
  const field = selectField(choose("Приватный предпросмотр редакции", "Private revision preview"), versionOptions, ""); revisionSelect = field.control;
  revisionSelect.onchange = () => loadPreview(Number(revisionSelect.value)).catch(error => setStatus(errorText(error), true)); previewHeading.append(field.field);
  detailPanel.append(previewHeading);
  previewNode = node("div"); detailPanel.append(previewNode);
  const historySection = node("details"); historySection.open = true;
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
  historySection.append(events); detailPanel.append(historySection);
}
function revisionRole(story, revision) {
  const roles = revisionLabels(story, revision, language);
  return roles.length ? ` · ${roles.join(" / ")}` : "";
}
function renderActions() {
  const story = state.detail; if (!story || !actionsNode) return;
  actionsNode.replaceChildren();
  const publicUrl = publicStoryUrl(story); if (publicUrl) actionsNode.append(link(choose("Открыть публикацию", "Open publication"), publicUrl, "workspace-button"));
  const actions = moderation ? moderationActions(story, state.user) : authorActions(story, state.user);
  for (const action of actions) {
    if (action === "edit") { actionsNode.append(link(t(action), `/builder/?story=${encodeURIComponent(story.storyId)}`, "workspace-button")); continue; }
    const reviewing = ["approve", "approve-publish", "publish-approved", "reject"].includes(action);
    const label = moderation && needsOwnOverride(action, story, state.user) ? `${t(action)} · ${choose("своя история", "own story")}` : t(action);
    const control = button(label, () => showDecision(action), ["approve-publish", "submit", "publish-approved"].includes(action) ? "primary" : ["hide", "delete"].includes(action) ? "danger" : "");
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
    event.preventDefault(); if (pending) return; remember(); pending = true; submit.disabled = cancel.disabled = true; feedback.textContent = choose("Сохраняем решение…", "Saving decision…");
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
    } finally { pending = false; submit.disabled = cancel.disabled = false; }
  };
  dialog.showModal();
}

await refreshAll();
window.addEventListener("focus", () => { if (!dialog.open && !state.loading) refreshAll(); });
