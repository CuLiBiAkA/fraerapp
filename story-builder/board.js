import { emptyDraft, normalizeLanguage, translate } from "./core.js";

const draftStorageKey = "fraerapp.storyBuilderDraft";
const languageKey = "fraerapp.storyBuilderLanguage";
const boardStateKey = "fraerapp.storyBuilderBoardState";
const boardLayoutsKey = "fraerapp.storyBuilderBoardLayouts";
const legacyPositionsKey = "fraerapp.storyBuilderBoardPositions";
const legacyZoomKey = "fraerapp.storyBuilderBoardZoom";
const autoLayoutKey = "__autosave__";

const minZoom = 0.3;
const maxZoom = 2.5;
const defaultZoom = 1;

const ui = {
  ru: {
    title: "Карта сценария",
    subtitle: "Доска для больших историй: двигайте карточки, связывайте их линиями, добавляйте заметки и сохраняйте раскладки.",
    search: "Поиск",
    searchPlaceholder: "сцена, переменная, ассет, заметка",
    all: "Все",
    scenes: "Сцены",
    variables: "Переменные",
    assets: "Ассеты",
    notes: "Заметки",
    autoLayout: "Авто-раскладка",
    openBuilder: "Открыть Builder",
    backBuilder: "Назад в конструктор",
    addNote: "Добавить текст",
    addScene: "Добавить сцену",
    addVariable: "Добавить переменную",
    addAsset: "Добавить ассет",
    connectMode: "Режим линий",
    cancelConnect: "Отменить линию",
    saveLayout: "Сохранить раскладку",
    loadLayout: "Загрузить",
    deleteLayout: "Удалить",
    layoutPlaceholder: "Название раскладки",
    noLayouts: "Нет сохранённых раскладок",
    summaryScenes: "Сцен",
    summaryVariables: "Переменных",
    summaryAssets: "Ассетов",
    summaryLinks: "Линий",
    laneScenes: "Сцены",
    laneVariables: "Переменные",
    laneAssets: "Ассеты",
    laneNotes: "Заметки",
    sceneKind: "Сцена",
    variableKind: "Переменная",
    assetKind: "Ассет",
    noteKind: "Текст",
    edit: "Редактировать",
    connect: "Связать",
    remove: "Удалить",
    outgoing: "Исходящие переходы",
    background: "Фон",
    music: "Музыка",
    ending: "Финал",
    noChoices: "Без выборов",
    boardFor: "Карта: {title}",
    noDraft: "Черновик пуст. Вернитесь в Builder и создайте сценарий.",
    startScene: "Стартовая сцена",
    notePlaceholder: "Напишите заметку...",
    lineHintIdle: "Выберите режим линий, чтобы связать карточки.",
    lineHintPickSource: "Выберите первую карточку для линии.",
    lineHintPickTarget: "Теперь выберите карточку, к которой нужно провести линию.",
    layoutSaved: "Раскладка сохранена",
    layoutLoaded: "Раскладка загружена",
    layoutDeleted: "Раскладка удалена",
    lineRemoved: "Линия удалена",
    cardAdded: "Карточка добавлена",
    autoSavedLayout: "Автосейв",
    zoomReset: "100%",
    addChoice: "+ выбор",
    addChildScene: "+ сцена",
    addSceneAsset: "+ файл",
    addSceneVariable: "+ влож. перем.",
    addCondition: "+ условие",
    addEffect: "+ эффект",
    deleteCard: "Удалить карточку",
    resizeCard: "Изменить размер",
    target: "Цель",
    fallback: "Иначе",
    quickActions: "Быстрые действия",
  },
  en: {
    title: "Scenario Map",
    subtitle: "Board mode for large stories: move cards, connect them, add notes, and save layouts.",
    search: "Search",
    searchPlaceholder: "scene, variable, asset, note",
    all: "All",
    scenes: "Scenes",
    variables: "Variables",
    assets: "Assets",
    notes: "Notes",
    autoLayout: "Auto layout",
    openBuilder: "Open Builder",
    backBuilder: "Back to Builder",
    addNote: "Add text",
    addScene: "Add scene",
    addVariable: "Add variable",
    addAsset: "Add asset",
    connectMode: "Connect mode",
    cancelConnect: "Cancel link",
    saveLayout: "Save layout",
    loadLayout: "Load",
    deleteLayout: "Delete",
    layoutPlaceholder: "Layout name",
    noLayouts: "No saved layouts",
    summaryScenes: "Scenes",
    summaryVariables: "Variables",
    summaryAssets: "Assets",
    summaryLinks: "Lines",
    laneScenes: "Scenes",
    laneVariables: "Variables",
    laneAssets: "Assets",
    laneNotes: "Notes",
    sceneKind: "Scene",
    variableKind: "Variable",
    assetKind: "Asset",
    noteKind: "Text",
    edit: "Edit",
    connect: "Connect",
    remove: "Remove",
    outgoing: "Outgoing choices",
    background: "Background",
    music: "Music",
    ending: "Ending",
    noChoices: "No choices",
    boardFor: "Map: {title}",
    noDraft: "Draft is empty. Return to Builder and create a story.",
    startScene: "Start scene",
    notePlaceholder: "Write a note...",
    lineHintIdle: "Enable connect mode to link cards.",
    lineHintPickSource: "Pick the first card for the line.",
    lineHintPickTarget: "Now pick the card you want to connect to.",
    layoutSaved: "Layout saved",
    layoutLoaded: "Layout loaded",
    layoutDeleted: "Layout deleted",
    lineRemoved: "Line removed",
    cardAdded: "Card added",
    autoSavedLayout: "Autosave",
    zoomReset: "100%",
    addChoice: "+ choice",
    addChildScene: "+ scene",
    addSceneAsset: "+ file",
    addSceneVariable: "+ nested var",
    addCondition: "+ condition",
    addEffect: "+ effect",
    deleteCard: "Delete card",
    resizeCard: "Resize card",
    target: "Target",
    fallback: "Fallback",
    quickActions: "Quick actions",
  },
};

const els = {
  title: document.querySelector("#board-title"),
  subtitle: document.querySelector("#board-subtitle"),
  searchLabel: document.querySelector("#search-label"),
  searchInput: document.querySelector("#search-input"),
  filterAll: document.querySelector("#filter-all"),
  filterScenes: document.querySelector("#filter-scenes"),
  filterVariables: document.querySelector("#filter-variables"),
  filterAssets: document.querySelector("#filter-assets"),
  filterNotes: document.querySelector("#filter-notes"),
  autoLayout: document.querySelector("#auto-layout"),
  openBuilder: document.querySelector("#open-builder"),
  backBuilder: document.querySelector("#back-builder"),
  addScene: document.querySelector("#add-scene"),
  addVariable: document.querySelector("#add-variable"),
  addAsset: document.querySelector("#add-asset"),
  addNote: document.querySelector("#add-note"),
  connectMode: document.querySelector("#connect-mode"),
  lineHint: document.querySelector("#line-hint"),
  layoutName: document.querySelector("#layout-name"),
  layoutSelect: document.querySelector("#layout-select"),
  saveLayout: document.querySelector("#save-layout"),
  loadLayout: document.querySelector("#load-layout"),
  deleteLayout: document.querySelector("#delete-layout"),
  zoomOut: document.querySelector("#zoom-out"),
  zoomIn: document.querySelector("#zoom-in"),
  zoomReset: document.querySelector("#zoom-reset"),
  zoomValue: document.querySelector("#zoom-value"),
  stage: document.querySelector(".board-stage"),
  surface: document.querySelector("#board-surface"),
  lines: document.querySelector("#board-lines"),
  laneScenes: document.querySelector("#lane-scenes"),
  laneVariables: document.querySelector("#lane-variables"),
  laneAssets: document.querySelector("#lane-assets"),
  laneNotes: document.querySelector("#lane-notes"),
  canvas: document.querySelector("#board-canvas"),
  summaryScenesCount: document.querySelector("#summary-scenes-count"),
  summaryVariablesCount: document.querySelector("#summary-variables-count"),
  summaryAssetsCount: document.querySelector("#summary-assets-count"),
  summaryLinksCount: document.querySelector("#summary-links-count"),
  summaryScenesLabel: document.querySelector("#summary-scenes-label"),
  summaryVariablesLabel: document.querySelector("#summary-variables-label"),
  summaryAssetsLabel: document.querySelector("#summary-assets-label"),
  summaryLinksLabel: document.querySelector("#summary-links-label"),
  langRu: document.querySelector("#lang-ru"),
  langEn: document.querySelector("#lang-en"),
};

let currentLanguage = normalizeLanguage(localStorage.getItem(languageKey));
let filterKind = "all";
let searchTerm = "";
let draft = loadDraft() || emptyDraft(currentLanguage);
let boardState = loadBoardState();
let savedLayouts = loadSavedLayouts();
let connectState = {
  enabled: false,
  source: "",
};
let renderedCards = new Map();
let renderedAnchors = new Map();
let lineDrag = null;
let cameraInitialized = false;

function text(key, params = {}) {
  const template = ui[currentLanguage]?.[key] ?? ui.ru[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
}

function applyLanguage() {
  document.documentElement.lang = currentLanguage;
  document.title = `FraerApp - ${text("title")}`;
  els.title.textContent = text("title");
  els.subtitle.textContent = text("boardFor", { title: draft.title || translate(currentLanguage, "newStoryTitle") });
  els.searchLabel.textContent = text("search");
  els.searchInput.placeholder = text("searchPlaceholder");
  els.filterAll.textContent = text("all");
  els.filterScenes.textContent = text("scenes");
  els.filterVariables.textContent = text("variables");
  els.filterAssets.textContent = text("assets");
  els.filterNotes.textContent = text("notes");
  els.autoLayout.textContent = text("autoLayout");
  els.openBuilder.textContent = text("openBuilder");
  if (els.backBuilder) els.backBuilder.textContent = text("backBuilder");
  els.addScene.textContent = text("addScene");
  els.addVariable.textContent = text("addVariable");
  els.addAsset.textContent = text("addAsset");
  els.addNote.textContent = text("addNote");
  els.connectMode.textContent = connectState.enabled ? text("cancelConnect") : text("connectMode");
  els.layoutName.placeholder = text("layoutPlaceholder");
  els.saveLayout.textContent = text("saveLayout");
  els.loadLayout.textContent = text("loadLayout");
  els.deleteLayout.textContent = text("deleteLayout");
  els.zoomReset.textContent = text("zoomReset");
  els.zoomValue.textContent = `${Math.round(boardState.zoom * 100)}%`;
  els.laneScenes.textContent = text("laneScenes");
  els.laneVariables.textContent = text("laneVariables");
  els.laneAssets.textContent = text("laneAssets");
  els.laneNotes.textContent = text("laneNotes");
  els.summaryScenesLabel.textContent = text("summaryScenes");
  els.summaryVariablesLabel.textContent = text("summaryVariables");
  els.summaryAssetsLabel.textContent = text("summaryAssets");
  els.summaryLinksLabel.textContent = text("summaryLinks");
  els.langRu.classList.toggle("is-active", currentLanguage === "ru");
  els.langEn.classList.toggle("is-active", currentLanguage === "en");
  els.connectMode.classList.toggle("is-active", connectState.enabled);
  applyCamera();
  renderLayoutOptions();
  updateLineHint();
}

function render() {
  normalizeBoardState();
  applyLanguage();
  updateSummary();
  renderedCards = new Map();
  renderedAnchors = new Map();
  els.canvas.replaceChildren();
  els.lines.replaceChildren();
  if (!hasEntities()) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = text("noDraft");
    els.canvas.append(empty);
    return;
  }
  ensureEntityPositions();
  createSceneCards();
  createVariableCards();
  createAssetCards();
  createNoteCards();
  drawLines();
  initializeCamera();
  positionLaneLabels();
}

function normalizeBoardState() {
  if (!boardState || typeof boardState !== "object") {
    boardState = defaultBoardState();
  }
  boardState.positions ||= {};
  boardState.sizes ||= {};
  boardState.lineAdjustments ||= {};
  boardState.notes ||= [];
  boardState.lines ||= [];
  boardState.camera ||= {};
  boardState.zoom = clamp(Number(boardState.zoom) || defaultZoom, minZoom, maxZoom);
  boardState.camera.x = Number.isFinite(Number(boardState.camera.x)) ? Number(boardState.camera.x) : null;
  boardState.camera.y = Number.isFinite(Number(boardState.camera.y)) ? Number(boardState.camera.y) : null;
}

function defaultBoardState() {
  return {
    positions: loadLegacyPositions(),
    sizes: {},
    lineAdjustments: {},
    notes: [],
    lines: [],
    zoom: loadLegacyZoom(),
    camera: {},
  };
}

function updateSummary() {
  els.summaryScenesCount.textContent = String(draft.scenes?.length || 0);
  els.summaryVariablesCount.textContent = String(draft.variables?.length || 0);
  els.summaryAssetsCount.textContent = String(draft.assets?.length || 0);
  els.summaryLinksCount.textContent = String(allBoardLines().length);
}

function hasEntities() {
  return (draft.scenes?.length || 0) + (draft.variables?.length || 0) + (draft.assets?.length || 0) + (boardState.notes?.length || 0) > 0;
}

function ensureEntityPositions() {
  const generated = buildAutoLayoutPositions();
  entityKeys().forEach((key) => ensurePosition(key, generated[key] || { x: 0, y: 0 }));
  pruneBoardState();
  persistBoardState();
}

function ensurePosition(key, point) {
  if (!boardState.positions[key]) {
    boardState.positions[key] = point;
  }
}

function createVariableCards() {
  draft.variables.forEach((variable, index) => {
    const id = variable.name || `variable-${index}`;
    const card = createCard({
      kind: "variable",
      id,
      title: id,
      subtitle: `${text("variableKind")} · ${variable.type}`,
      meta: [pill(variable.type), pill(String(variable.value)), variable.showInStats ? pill("stats") : null].filter(Boolean),
      href: `/index.html#variable:${encodeURIComponent(id)}`,
    });
    placeCard(card, entityKey("variable", id));
  });
}

function createAssetCards() {
  draft.assets.forEach((asset, index) => {
    const id = asset.id || `asset-${index}`;
    const card = createCard({
      kind: "asset",
      id,
      title: id,
      subtitle: `${text("assetKind")} · ${asset.type || "image"}`,
      meta: [pill(asset.type || "image"), pill(trimText(asset.url || "", 22))],
      href: `/index.html#asset:${encodeURIComponent(id)}`,
    });
    placeCard(card, entityKey("asset", id));
  });
}

function createSceneCards() {
  draft.scenes.forEach((scene, index) => {
    const id = scene.id || `scene-${index}`;
    const card = createCard({
      kind: "scene",
      id,
      title: scene.title || id,
      subtitle: scene.id === draft.startSceneId ? `${text("startScene")} · ${id}` : id,
      meta: [
        pill(`${scene.choices?.length || 0} ${text("summaryLinks").toLowerCase()}`),
        scene.endingEnabled ? pill(text("ending")) : null,
        scene.background ? pill(`${text("background")}: ${scene.background}`) : null,
        scene.music ? pill(`${text("music")}: ${scene.music}`) : null,
      ].filter(Boolean),
      href: `/index.html#scene:${encodeURIComponent(id)}`,
    });

    const body = card.querySelector(".card-body");
    body.append(createSceneQuickActions(scene));
    const choices = scene.choices || [];
    if (choices.length) {
      const label = document.createElement("strong");
      label.textContent = text("outgoing");
      body.append(label);
      const list = document.createElement("div");
      list.className = "choice-list";
      choices.forEach((choice, choiceIndex) => {
        const row = document.createElement("div");
        row.className = "choice-row";
        const choiceLabel = document.createElement("a");
        choiceLabel.className = "choice-label";
        choiceLabel.href = `/index.html#scene:${encodeURIComponent(id)}`;
        choiceLabel.textContent = trimText(choice.label || choice.id || "choice", 26);
        const target = document.createElement("div");
        target.className = "choice-targets";
        const targetPill = pill(`${text("target")}: ${choice.target || "none"}`);
        targetPill.classList.add("choice-pin", "target-pin");
        renderedAnchors.set(choiceLineId(scene.id, choice, choiceIndex, "target"), targetPill);
        target.append(targetPill);
        if (choice.fallbackTarget) {
          const fallbackPill = pill(`${text("fallback")}: ${choice.fallbackTarget}`);
          fallbackPill.classList.add("choice-pin", "fallback-pin");
          renderedAnchors.set(choiceLineId(scene.id, choice, choiceIndex, "fallback"), fallbackPill);
          target.append(fallbackPill);
        }
        const actions = document.createElement("div");
        actions.className = "choice-actions";
        actions.append(
          miniAction(text("addCondition"), () => addChoiceCondition(id, choiceIndex)),
          miniAction(text("addEffect"), () => addChoiceEffect(id, choiceIndex)),
        );
        row.append(choiceLabel, target, actions);
        list.append(row);
      });
      body.append(list);
    } else {
      body.append(pill(text("noChoices")));
    }
    placeCard(card, entityKey("scene", id));
  });
}

function createNoteCards() {
  boardState.notes.forEach((note) => {
    const card = createCard({
      kind: "note",
      id: note.id,
      title: note.title || text("noteKind"),
      subtitle: text("noteKind"),
      meta: [],
      href: "",
      editable: true,
      removable: true,
    });
    const body = card.querySelector(".card-body");
    const textarea = document.createElement("textarea");
    textarea.className = "note-editor";
    textarea.rows = 6;
    textarea.placeholder = text("notePlaceholder");
    textarea.value = note.text || "";
    textarea.addEventListener("input", () => {
      note.text = textarea.value;
      persistBoardState();
      updateVisibility(card);
    });
    body.prepend(textarea);
    placeCard(card, entityKey("note", note.id));
  });
}

function createCard({ kind, id, title, subtitle, meta, href, editable = false, removable = true }) {
  const card = document.createElement("article");
  card.className = "board-card";
  card.dataset.kind = kind;
  card.dataset.id = id;

  const head = document.createElement("div");
  head.className = "card-head";

  if (removable) {
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "card-close";
    closeButton.title = text("deleteCard");
    closeButton.setAttribute("aria-label", text("deleteCard"));
    closeButton.textContent = "x";
    closeButton.onclick = (event) => {
      event.stopPropagation();
      removeEntity(kind, id);
    };
    head.append(closeButton);
  }

  const kindTag = document.createElement("span");
  kindTag.className = "card-kind";
  kindTag.textContent = text(`${kind}Kind`);

  const titleNode = document.createElement("h2");
  titleNode.className = "card-title";
  titleNode.textContent = title;

  const subtitleNode = document.createElement("p");
  subtitleNode.className = "card-subtitle";
  subtitleNode.textContent = subtitle;

  head.append(kindTag, titleNode, subtitleNode);

  const body = document.createElement("div");
  body.className = "card-body";

  if (meta?.length) {
    const metaRow = document.createElement("div");
    metaRow.className = "meta-row";
    meta.forEach((item) => metaRow.append(item));
    body.append(metaRow);
  }

  const actions = document.createElement("div");
  actions.className = "card-actions";

  if (href) {
    const editLink = document.createElement("a");
    editLink.className = "card-link";
    editLink.href = href;
    editLink.textContent = text("edit");
    actions.append(editLink);
  }

  const connectButton = document.createElement("button");
  connectButton.type = "button";
  connectButton.className = "secondary small-button";
  connectButton.textContent = text("connect");
  connectButton.onclick = (event) => {
    event.stopPropagation();
    handleConnectClick(entityKey(kind, id));
  };
  actions.append(connectButton);

  body.append(actions);
  const resizeHandle = document.createElement("button");
  resizeHandle.type = "button";
  resizeHandle.className = "resize-handle";
  resizeHandle.title = text("resizeCard");
  resizeHandle.setAttribute("aria-label", text("resizeCard"));
  card.append(head, body, resizeHandle);
  makeDraggable(card, editable);
  makeResizable(card);
  updateVisibility(card);
  return card;
}

function placeCard(card, key) {
  const point = boardState.positions[key] || { x: 24, y: 24 };
  const size = boardState.sizes[key];
  card.style.left = `${point.x}px`;
  card.style.top = `${point.y}px`;
  if (size?.width) card.style.width = `${size.width}px`;
  if (size?.height) card.style.height = `${size.height}px`;
  els.canvas.append(card);
  renderedCards.set(key, card);
}

function makeDraggable(card, editable) {
  let drag = null;

  card.addEventListener("pointerdown", (event) => {
    if (event.target.closest("a,button,textarea,input,select,.resize-handle")) return;
    const pointer = clientToWorld(event.clientX, event.clientY);
    drag = {
      key: entityKey(card.dataset.kind, card.dataset.id),
      offsetX: pointer.x - card.offsetLeft,
      offsetY: pointer.y - card.offsetTop,
    };
    card.classList.add("is-dragging");
    card.setPointerCapture(event.pointerId);
  });

  card.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const pointer = clientToWorld(event.clientX, event.clientY);
    const nextX = pointer.x - drag.offsetX;
    const nextY = pointer.y - drag.offsetY;
    card.style.left = `${nextX}px`;
    card.style.top = `${nextY}px`;
    boardState.positions[drag.key] = { x: nextX, y: nextY };
    drawLines();
  });

  card.addEventListener("pointerup", (event) => {
    if (!drag) return;
    card.classList.remove("is-dragging");
    card.releasePointerCapture(event.pointerId);
    persistBoardState();
    drag = null;
  });

  card.addEventListener("click", () => {
    if (connectState.enabled && !editable) {
      handleConnectClick(entityKey(card.dataset.kind, card.dataset.id));
    }
  });
}

function makeResizable(card) {
  const handle = card.querySelector(".resize-handle");
  if (!handle) return;
  let resize = null;

  handle.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    resize = {
      key: entityKey(card.dataset.kind, card.dataset.id),
      startX: event.clientX,
      startY: event.clientY,
      width: card.offsetWidth,
      height: card.offsetHeight,
    };
    card.classList.add("is-resizing");
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener("pointermove", (event) => {
    if (!resize) return;
    const deltaX = (event.clientX - resize.startX) / boardState.zoom;
    const deltaY = (event.clientY - resize.startY) / boardState.zoom;
    const width = clamp(Math.round(resize.width + deltaX), 240, 680);
    const height = clamp(Math.round(resize.height + deltaY), 180, 760);
    card.style.width = `${width}px`;
    card.style.height = `${height}px`;
    boardState.sizes[resize.key] = { width, height };
    drawLines();
  });

  handle.addEventListener("pointerup", (event) => {
    if (!resize) return;
    card.classList.remove("is-resizing");
    handle.releasePointerCapture(event.pointerId);
    resize = null;
    persistBoardState();
  });
}

function updateVisibility(card) {
  const matchesFilter = filterKind === "all" || card.dataset.kind === filterKind;
  const haystack = [
    card.dataset.id,
    card.querySelector(".card-title")?.textContent || "",
    card.querySelector(".card-subtitle")?.textContent || "",
    card.querySelector("textarea")?.value || "",
  ].join(" ").toLowerCase();
  const matchesSearch = !searchTerm || haystack.includes(searchTerm);
  card.classList.toggle("is-hidden", !(matchesFilter && matchesSearch));
}

function drawLines() {
  els.lines.replaceChildren();
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <marker id="board-arrow-internal" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
      <path d="M 0 0 L 12 6 L 0 12 z" fill="#075f7a"></path>
    </marker>
    <marker id="board-arrow-fallback" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
      <path d="M 0 0 L 12 6 L 0 12 z" fill="#b35a05"></path>
    </marker>
    <marker id="board-arrow-manual" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
      <path d="M 0 0 L 12 6 L 0 12 z" fill="#455a64"></path>
    </marker>
  `;
  els.lines.append(defs);

  const routeCounts = new Map();
  allBoardLines().forEach((line, index) => {
    const from = renderedCards.get(line.from);
    const to = renderedCards.get(line.to);
    if (!from || !to) return;
    if (from.classList.contains("is-hidden") || to.classList.contains("is-hidden")) return;
    const routeKey = `${line.from}->${line.to}`;
    const routeIndex = routeCounts.get(routeKey) || 0;
    routeCounts.set(routeKey, routeIndex + 1);
    const route = buildLineRoute(line, from, to, routeIndex, index);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", route.path);
    path.setAttribute("class", `board-line ${line.kind || "manual"}`);
    path.setAttribute("marker-end", `url(#board-arrow-${line.kind || "manual"})`);
    path.setAttribute("data-line-id", line.id);
    if (line.removable !== false) {
      path.addEventListener("click", () => removeLine(line.id));
    }
    els.lines.append(path);

    if (line.label) {
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("class", `line-label ${line.kind || "manual"}`);
      label.setAttribute("x", String(route.label.x));
      label.setAttribute("y", String(route.label.y));
      label.setAttribute("tabindex", "0");
      label.setAttribute("role", "button");
      label.textContent = trimText(line.label, 32);
      label.addEventListener("pointerdown", (event) => startLineDrag(event, line.id, "label"));
      els.lines.append(label);
    }

    const handle = document.createElementNS("http://www.w3.org/2000/svg", "g");
    handle.setAttribute("class", `line-route-handle ${line.kind || "manual"}`);
    handle.setAttribute("tabindex", "0");
    handle.setAttribute("role", "slider");
    handle.setAttribute("aria-label", text("resizeCard"));
    handle.setAttribute("transform", `translate(${route.handle.x} ${route.handle.y})`);
    handle.addEventListener("pointerdown", (event) => startLineDrag(event, line.id, "route"));
    const handleCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    handleCircle.setAttribute("r", "8");
    const handleLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
    handleLine.setAttribute("d", "M -4 0 L 4 0 M 0 -4 L 0 4");
    handle.append(handleCircle, handleLine);
    els.lines.append(handle);

    if (line.removable === false) return;

    const deleteButton = document.createElementNS("http://www.w3.org/2000/svg", "g");
    deleteButton.setAttribute("class", "line-delete");
    deleteButton.setAttribute("tabindex", "0");
    deleteButton.setAttribute("role", "button");
    deleteButton.setAttribute("aria-label", text("remove"));
    deleteButton.setAttribute("transform", `translate(${route.label.x} ${route.label.y + 18})`);
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      removeLine(line.id);
    });
    deleteButton.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        removeLine(line.id);
      }
    });
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("r", "14");
    const mark = document.createElementNS("http://www.w3.org/2000/svg", "text");
    mark.textContent = "x";
    deleteButton.append(circle, mark);
    els.lines.append(deleteButton);
  });
}

function buildLineRoute(line, fromCard, toCard, routeIndex, globalIndex) {
  const adjustment = boardState.lineAdjustments?.[line.id] || {};
  const anchor = renderedAnchors.get(line.anchorId);
  const start = anchor ? elementWorldPoint(anchor, "right") : cardWorldPoint(fromCard, "right");
  const toSide = toCard.offsetLeft >= fromCard.offsetLeft ? "left" : "right";
  const end = cardWorldPoint(toCard, toSide);
  const forward = end.x >= start.x;
  const laneOffset = (routeIndex * 18) + ((globalIndex % 5) - 2) * 4;
  const horizontalGap = Math.max(84, Math.min(220, Math.abs(end.x - start.x) * 0.42));
  const forwardMidX = end.x - start.x > 140
    ? Math.min(start.x + horizontalGap + laneOffset, end.x - 60)
    : start.x + 90 + laneOffset;
  const midX = (forward ? forwardMidX : Math.min(start.x, end.x) - 110 - laneOffset) + (Number(adjustment.routeDx) || 0);
  const points = [
    { x: start.x, y: start.y },
    { x: midX, y: start.y },
    { x: midX, y: end.y },
    { x: end.x, y: end.y },
  ];
  const path = [
    `M ${points[0].x} ${points[0].y}`,
    `L ${points[1].x} ${points[1].y}`,
    `L ${points[2].x} ${points[2].y}`,
    `L ${points[3].x} ${points[3].y}`,
  ].join(" ");
  const label = pointOnPolyline(points, clamp(Number(adjustment.labelT) || 0.28, 0.08, 0.92));
  return {
    path,
    label: {
      x: Math.round(label.x),
      y: Math.round(label.y - 4),
    },
    handle: {
      x: Math.round(midX),
      y: Math.round((start.y + end.y) / 2),
    },
    points,
  };
}

function startLineDrag(event, lineId, mode) {
  event.preventDefault();
  event.stopPropagation();
  const pointer = clientToWorld(event.clientX, event.clientY);
  const base = boardState.lineAdjustments?.[lineId] || {};
  lineDrag = {
    id: lineId,
    mode,
    start: pointer,
    base: {
      labelT: Number(base.labelT) || 0.28,
      routeDx: Number(base.routeDx) || 0,
    },
  };
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function updateLineDrag(event) {
  if (!lineDrag) return;
  const pointer = clientToWorld(event.clientX, event.clientY);
  const dx = pointer.x - lineDrag.start.x;
  const dy = pointer.y - lineDrag.start.y;
  const next = { ...lineDrag.base };
  if (lineDrag.mode === "label") {
    const line = allBoardLines().find((item) => item.id === lineDrag.id);
    const from = line ? renderedCards.get(line.from) : null;
    const to = line ? renderedCards.get(line.to) : null;
    if (line && from && to) {
      const routeKey = `${line.from}->${line.to}`;
      const sameRouteLines = allBoardLines().filter((item) => `${item.from}->${item.to}` === routeKey);
      const routeIndex = Math.max(0, sameRouteLines.findIndex((item) => item.id === line.id));
      const route = buildLineRoute(line, from, to, routeIndex, 0);
      next.labelT = nearestPolylineT(route.points, pointer);
    }
  } else {
    next.routeDx = Math.round(lineDrag.base.routeDx + dx);
  }
  boardState.lineAdjustments[lineDrag.id] = next;
  drawLines();
}

function finishLineDrag() {
  if (!lineDrag) return;
  lineDrag = null;
  persistBoardState();
}

function elementWorldPoint(element, side = "right") {
  const rect = element.getBoundingClientRect();
  const x = side === "left" ? rect.left : rect.right;
  const y = rect.top + rect.height / 2;
  return clientToWorld(x, y);
}

function cardWorldPoint(card, side = "right") {
  const x = side === "left" ? card.offsetLeft : card.offsetLeft + card.offsetWidth;
  return {
    x,
    y: card.offsetTop + Math.min(card.offsetHeight - 36, Math.max(48, card.offsetHeight / 2)),
  };
}

function pointOnPolyline(points, t) {
  const segments = polylineSegments(points);
  const total = segments.reduce((sum, segment) => sum + segment.length, 0) || 1;
  let distance = total * clamp(t, 0, 1);
  for (const segment of segments) {
    if (distance <= segment.length) {
      const ratio = segment.length ? distance / segment.length : 0;
      return {
        x: segment.a.x + (segment.b.x - segment.a.x) * ratio,
        y: segment.a.y + (segment.b.y - segment.a.y) * ratio,
      };
    }
    distance -= segment.length;
  }
  return points[points.length - 1];
}

function nearestPolylineT(points, pointer) {
  const segments = polylineSegments(points);
  const total = segments.reduce((sum, segment) => sum + segment.length, 0) || 1;
  let best = { distance: Infinity, length: 0 };
  let walked = 0;
  segments.forEach((segment) => {
    const dx = segment.b.x - segment.a.x;
    const dy = segment.b.y - segment.a.y;
    const lengthSquared = Math.max(1, dx * dx + dy * dy);
    const raw = ((pointer.x - segment.a.x) * dx + (pointer.y - segment.a.y) * dy) / lengthSquared;
    const ratio = clamp(raw, 0, 1);
    const x = segment.a.x + dx * ratio;
    const y = segment.a.y + dy * ratio;
    const distance = Math.hypot(pointer.x - x, pointer.y - y);
    if (distance < best.distance) {
      best = { distance, length: walked + segment.length * ratio };
    }
    walked += segment.length;
  });
  return clamp(best.length / total, 0.08, 0.92);
}

function polylineSegments(points) {
  const segments = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    segments.push({ a, b, length: Math.hypot(b.x - a.x, b.y - a.y) });
  }
  return segments;
}

function handleConnectClick(key) {
  if (!connectState.enabled) {
    connectState.enabled = true;
    connectState.source = key;
    applyLanguage();
    highlightConnectSource();
    return;
  }

  if (!connectState.source) {
    connectState.source = key;
    updateLineHint();
    highlightConnectSource();
    return;
  }

  if (connectState.source === key) {
    connectState.source = "";
    highlightConnectSource();
    updateLineHint();
    return;
  }

  const existing = boardState.lines.find((line) => line.from === connectState.source && line.to === key);
  if (existing) {
    removeLine(existing.id);
    connectState.source = "";
    highlightConnectSource();
    updateLineHint(text("lineRemoved"));
    return;
  }

  boardState.lines.push(createLine(connectState.source, key));
  persistBoardState();
  connectState.source = "";
  highlightConnectSource();
  drawLines();
  updateSummary();
  updateLineHint();
}

function highlightConnectSource() {
  renderedCards.forEach((card, key) => {
    card.classList.toggle("is-connect-source", connectState.source === key);
  });
}

function updateLineHint(message = "") {
  if (message) {
    els.lineHint.textContent = message;
    return;
  }
  if (!connectState.enabled) {
    els.lineHint.textContent = text("lineHintIdle");
  } else if (!connectState.source) {
    els.lineHint.textContent = text("lineHintPickSource");
  } else {
    els.lineHint.textContent = text("lineHintPickTarget");
  }
}

function createSceneQuickActions(scene) {
  const wrap = document.createElement("div");
  wrap.className = "quick-actions";
  const caption = document.createElement("span");
  caption.className = "quick-actions-label";
  caption.textContent = text("quickActions");
  wrap.append(
    caption,
    miniAction(text("addChildScene"), () => addChildScene(scene.id)),
    miniAction(text("addChoice"), () => addChoice(scene.id)),
    miniAction(text("addSceneAsset"), () => addSceneAsset(scene.id)),
    miniAction(text("addSceneVariable"), () => addSceneVariable(scene.id)),
  );
  return wrap;
}

function miniAction(label, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary micro-button";
  button.textContent = label;
  button.onclick = (event) => {
    event.stopPropagation();
    handler();
  };
  return button;
}

function addChoice(sceneId) {
  const scene = findScene(sceneId);
  if (!scene) return;
  scene.choices ||= [];
  const target = (draft.scenes || []).find((item) => item.id !== sceneId)?.id || sceneId;
  scene.choices.push({
    id: uniqueId("choice", scene.choices.map((choice) => choice.id)),
    label: `${text("addChoice").replace("+ ", "")} ${scene.choices.length + 1}`,
    target,
    conditions: [],
    effects: [],
  });
  persistDraft();
  render();
  updateLineHint(text("cardAdded"));
}

function addChildScene(sceneId) {
  const parent = findScene(sceneId);
  if (!parent) return;
  const id = uniqueId("scene", draft.scenes.map((scene) => scene.id));
  draft.scenes.push({
    id,
    title: `${text("sceneKind")} ${draft.scenes.length + 1}`,
    text: "",
    background: "",
    music: "",
    variables: [],
    assets: [],
    animationType: "fade-in",
    animationDurationMs: 700,
    effects: [],
    endingEnabled: false,
    endingType: "",
    endingTitle: "",
    choices: [],
  });
  parent.choices ||= [];
  parent.choices.push({
    id: uniqueId("choice", parent.choices.map((choice) => choice.id)),
    label: `${text("sceneKind")} ${id}`,
    target: id,
    conditions: [],
    effects: [],
  });
  const parentPoint = boardState.positions[entityKey("scene", sceneId)] || nextInsertionPoint();
  boardState.positions[entityKey("scene", id)] = { x: parentPoint.x + 420, y: parentPoint.y + 120 };
  persistDraft();
  persistBoardState();
  render();
  updateLineHint(text("cardAdded"));
}

function addSceneAsset(sceneId) {
  const scene = findScene(sceneId);
  if (!scene) return;
  scene.assets ||= [];
  scene.assets.push({
    id: uniqueId("scene_asset", scene.assets.map((asset) => asset.id)),
    type: "image",
    url: "",
    metadata: "",
  });
  persistDraft();
  render();
  window.location.href = `/index.html#scene:${encodeURIComponent(sceneId)}`;
}

function addSceneVariable(sceneId) {
  const scene = findScene(sceneId);
  if (!scene) return;
  scene.variables ||= [];
  scene.variables.push({
    name: uniqueId("local_variable", scene.variables.map((variable) => variable.name)),
    type: "number",
    value: 0,
    showInStats: false,
  });
  persistDraft();
  render();
  window.location.href = `/index.html#scene:${encodeURIComponent(sceneId)}`;
}

function addChoiceCondition(sceneId, choiceIndex) {
  const choice = findScene(sceneId)?.choices?.[choiceIndex];
  if (!choice) return;
  choice.conditions ||= [];
  choice.conditions.push({ variable: draft.variables?.[0]?.name || "", op: ">=", value: 0 });
  persistDraft();
  render();
  window.location.href = `/index.html#scene:${encodeURIComponent(sceneId)}`;
}

function addChoiceEffect(sceneId, choiceIndex) {
  const choice = findScene(sceneId)?.choices?.[choiceIndex];
  if (!choice) return;
  choice.effects ||= [];
  choice.effects.push({ type: "set", variable: draft.variables?.[0]?.name || "", value: 0 });
  persistDraft();
  render();
  window.location.href = `/index.html#scene:${encodeURIComponent(sceneId)}`;
}

function addNote() {
  const note = {
    id: `note-${Date.now()}`,
    title: text("noteKind"),
    text: "",
  };
  const point = nextInsertionPoint();
  boardState.notes.push(note);
  boardState.positions[entityKey("note", note.id)] = point;
  persistBoardState();
  render();
  updateLineHint(text("cardAdded"));
}

function addScene() {
  const id = uniqueId("scene", draft.scenes.map((scene) => scene.id));
  draft.scenes.push({
    id,
    title: `${text("sceneKind")} ${draft.scenes.length + 1}`,
    text: "",
    background: draft.assets[0]?.id || "",
    music: "",
    variables: [],
    assets: [],
    animationType: "fade-in",
    animationDurationMs: 700,
    effects: [],
    endingEnabled: false,
    endingType: "",
    endingTitle: "",
    choices: [],
  });
  addDraftEntityPosition("scene", id);
}

function addVariable() {
  const name = uniqueId("variable", draft.variables.map((variable) => variable.name));
  draft.variables.push({ name, type: "number", value: 0, showInStats: false });
  addDraftEntityPosition("variable", name);
}

function addAsset() {
  const id = uniqueId("asset", draft.assets.map((asset) => asset.id));
  draft.assets.push({ id, type: "image", url: "", metadata: "" });
  addDraftEntityPosition("asset", id);
}

function addDraftEntityPosition(kind, id) {
  boardState.positions[entityKey(kind, id)] = nextInsertionPoint();
  persistDraft();
  persistBoardState();
  render();
  updateLineHint(text("cardAdded"));
}

function removeNote(noteId) {
  boardState.notes = boardState.notes.filter((note) => note.id !== noteId);
  delete boardState.positions[entityKey("note", noteId)];
  delete boardState.sizes[entityKey("note", noteId)];
  boardState.lines = boardState.lines.filter((line) => line.from !== entityKey("note", noteId) && line.to !== entityKey("note", noteId));
  persistBoardState();
  render();
}

function removeEntity(kind, id) {
  if (kind === "note") {
    removeNote(id);
    return;
  }
  if (kind === "scene") {
    draft.scenes = (draft.scenes || []).filter((scene) => scene.id !== id);
    draft.scenes.forEach((scene) => {
      scene.choices = (scene.choices || []).filter((choice) => choice.target !== id && choice.fallbackTarget !== id);
    });
    if (draft.startSceneId === id) draft.startSceneId = draft.scenes[0]?.id || "";
  }
  if (kind === "variable") {
    draft.variables = (draft.variables || []).filter((variable) => variable.name !== id);
    cleanVariableReferences(id);
  }
  if (kind === "asset") {
    draft.assets = (draft.assets || []).filter((asset) => asset.id !== id);
    cleanAssetReferences(id);
  }
  const key = entityKey(kind, id);
  delete boardState.positions[key];
  delete boardState.sizes[key];
  boardState.lines = (boardState.lines || []).filter((line) => line.from !== key && line.to !== key);
  persistDraft();
  persistBoardState();
  render();
}

function cleanVariableReferences(name) {
  (draft.scenes || []).forEach((scene) => {
    scene.variables = (scene.variables || []).filter((variable) => variable.name !== name);
    scene.effects = (scene.effects || []).filter((effect) => effect.variable !== name);
    (scene.choices || []).forEach((choice) => {
      choice.conditions = (choice.conditions || []).filter((condition) => condition.variable !== name);
      choice.effects = (choice.effects || []).filter((effect) => effect.variable !== name);
    });
  });
}

function cleanAssetReferences(id) {
  (draft.scenes || []).forEach((scene) => {
    if (scene.background === id) scene.background = "";
    if (scene.music === id) scene.music = "";
    scene.assets = (scene.assets || []).filter((asset) => asset.id !== id);
  });
}

function findScene(sceneId) {
  return (draft.scenes || []).find((scene) => scene.id === sceneId);
}

function removeLine(lineId) {
  boardState.lines = boardState.lines.filter((line) => line.id !== lineId);
  persistBoardState();
  drawLines();
  updateSummary();
  updateLineHint(text("lineRemoved"));
}

function createLine(from, to) {
  return {
    id: `line-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    from,
    to,
    kind: "manual",
  };
}

function allBoardLines() {
  return [...internalSceneLines(), ...(boardState.lines || []).map((line) => ({ ...line, kind: line.kind || "manual" }))];
}

function internalSceneLines() {
  const sceneIds = new Set((draft.scenes || []).map((scene) => scene.id).filter(Boolean));
  const lines = [];
  (draft.scenes || []).forEach((scene) => {
    (scene.choices || []).forEach((choice, index) => {
      const choiceName = choice.label || choice.id || `choice ${index + 1}`;
      if (choice.target && sceneIds.has(choice.target)) {
        lines.push({
          id: choiceLineId(scene.id, choice, index, "target"),
          from: entityKey("scene", scene.id),
          to: entityKey("scene", choice.target),
          anchorId: choiceLineId(scene.id, choice, index, "target"),
          label: choiceName,
          kind: "internal",
          removable: false,
        });
      }
      if (choice.fallbackTarget && sceneIds.has(choice.fallbackTarget)) {
        lines.push({
          id: choiceLineId(scene.id, choice, index, "fallback"),
          from: entityKey("scene", scene.id),
          to: entityKey("scene", choice.fallbackTarget),
          anchorId: choiceLineId(scene.id, choice, index, "fallback"),
          label: `${text("fallback")}: ${choiceName}`,
          kind: "fallback",
          removable: false,
        });
      }
    });
  });
  return lines;
}

function choiceLineId(sceneId, choice, index, route) {
  return `choice:${sceneId}:${choice.id || index}:${route}`;
}

function entityKeys() {
  return [
    ...(draft.variables || []).map((variable, index) => entityKey("variable", variable.name || `variable-${index}`)),
    ...(draft.assets || []).map((asset, index) => entityKey("asset", asset.id || `asset-${index}`)),
    ...(draft.scenes || []).map((scene, index) => entityKey("scene", scene.id || `scene-${index}`)),
    ...(boardState.notes || []).map((note) => entityKey("note", note.id)),
  ];
}

function pruneBoardState() {
  const live = new Set(entityKeys());
  Object.keys(boardState.positions || {}).forEach((key) => {
    if (!live.has(key)) delete boardState.positions[key];
  });
  Object.keys(boardState.sizes || {}).forEach((key) => {
    if (!live.has(key)) delete boardState.sizes[key];
  });
  boardState.lines = (boardState.lines || []).filter((line) => live.has(line.from) && live.has(line.to));
  const liveLineIds = new Set(allBoardLines().map((line) => line.id));
  Object.keys(boardState.lineAdjustments || {}).forEach((lineId) => {
    if (!liveLineIds.has(lineId)) delete boardState.lineAdjustments[lineId];
  });
}

function buildAutoLayoutPositions() {
  const positions = {};
  const sceneLevels = computeSceneLevels();
  const sceneWeights = computeSceneSortWeights(sceneLevels);
  const sceneGroups = new Map();

  (draft.scenes || []).forEach((scene, index) => {
    const level = sceneLevels.get(scene.id) ?? index;
    if (!sceneGroups.has(level)) sceneGroups.set(level, []);
    sceneGroups.get(level).push(scene);
  });

  [...sceneGroups.keys()].sort((a, b) => a - b).forEach((level) => {
    const scenes = sceneGroups.get(level).sort((a, b) => (sceneWeights.get(a.id) ?? 0) - (sceneWeights.get(b.id) ?? 0) || String(a.id).localeCompare(String(b.id)));
    const heights = scenes.map(estimateSceneHeight);
    const totalHeight = heights.reduce((sum, height) => sum + height, 0) + Math.max(0, scenes.length - 1) * 90;
    let cursorY = -Math.round(totalHeight / 2);
    scenes.forEach((scene, index) => {
      const height = heights[index];
      positions[entityKey("scene", scene.id)] = {
        x: level * 560,
        y: cursorY,
      };
      cursorY += height + 90;
    });
  });

  (draft.variables || []).forEach((variable, index) => {
    positions[entityKey("variable", variable.name || `variable-${index}`)] = { x: -680, y: index * 150 - 280 };
  });
  (draft.assets || []).forEach((asset, index) => {
    positions[entityKey("asset", asset.id || `asset-${index}`)] = { x: -340, y: index * 150 - 280 };
  });
  (boardState.notes || []).forEach((note, index) => {
    positions[entityKey("note", note.id)] = { x: -1040, y: index * 220 - 160 };
  });
  return positions;
}

function computeSceneSortWeights(levels) {
  const weights = new Map();
  const order = new Map((draft.scenes || []).map((scene, index) => [scene.id, index * 100]));
  const startId = draft.startSceneId || draft.scenes?.[0]?.id;
  if (startId) weights.set(startId, -10000);

  (draft.scenes || []).forEach((scene) => {
    const parentLevel = levels.get(scene.id) ?? 0;
    (scene.choices || []).forEach((choice, choiceIndex) => {
      [choice.target, choice.fallbackTarget].filter(Boolean).forEach((target, routeIndex) => {
        const targetLevel = levels.get(target) ?? parentLevel + 1;
        const base = (weights.get(scene.id) ?? order.get(scene.id) ?? 0) + choiceIndex * 120 + routeIndex * 24;
        const spread = targetLevel === parentLevel ? 40 : 0;
        const nextWeight = base + spread;
        if (!weights.has(target) || nextWeight < weights.get(target)) {
          weights.set(target, nextWeight);
        }
      });
    });
  });

  (draft.scenes || []).forEach((scene) => {
    if (!weights.has(scene.id)) weights.set(scene.id, order.get(scene.id) ?? 0);
  });
  return weights;
}

function estimateSceneHeight(scene) {
  const choiceCount = Math.max(1, scene.choices?.length || 0);
  return 190 + choiceCount * 74;
}

function computeSceneLevels() {
  const scenes = draft.scenes || [];
  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  const startId = byId.has(draft.startSceneId) ? draft.startSceneId : scenes[0]?.id;
  const levels = new Map();
  const queue = startId ? [{ id: startId, level: 0 }] : [];

  while (queue.length) {
    const item = queue.shift();
    if (!item?.id || levels.has(item.id)) continue;
    levels.set(item.id, item.level);
    const scene = byId.get(item.id);
    (scene?.choices || []).forEach((choice) => {
      [choice.target, choice.fallbackTarget].filter((target) => byId.has(target)).forEach((target) => {
        if (!levels.has(target)) queue.push({ id: target, level: item.level + 1 });
      });
    });
  }

  let orphanLevel = levels.size ? Math.max(...levels.values()) + 1 : 0;
  scenes.forEach((scene) => {
    if (!levels.has(scene.id)) {
      levels.set(scene.id, orphanLevel);
      orphanLevel += 1;
    }
  });
  return levels;
}

function layoutPoint(kind, index) {
  const lanes = {
    variable: -840,
    asset: -280,
    note: 280,
    scene: 840,
  };
  const x = lanes[kind] ?? 34;
  const y = 84 + (index % 8) * 134 + Math.floor(index / 8) * 18;
  return { x, y };
}

function nextInsertionPoint() {
  const center = viewportCenterWorld();
  const offset = (Object.keys(boardState.positions || {}).length % 6) * 28;
  return {
    x: Math.round(center.x + offset),
    y: Math.round(center.y + offset),
  };
}

function viewportCenterWorld() {
  const rect = els.stage.getBoundingClientRect();
  return {
    x: (rect.width / 2 - boardState.camera.x) / boardState.zoom,
    y: (rect.height / 2 - boardState.camera.y) / boardState.zoom,
  };
}

function initializeCamera() {
  if (cameraInitialized) return;
  cameraInitialized = true;
  requestAnimationFrame(() => {
    const rect = els.stage.getBoundingClientRect();
    if (boardState.camera.x === null || boardState.camera.y === null) {
      boardState.camera.x = Math.round(rect.width / 2);
      boardState.camera.y = Math.round(rect.height / 2 - 80);
      persistBoardState();
    }
    applyCamera();
    positionLaneLabels();
  });
}

function autoLayout() {
  boardState.positions = buildAutoLayoutPositions();
  pruneBoardState();
  persistBoardState();
  render();
}

function setZoom(nextZoom, focusClientX = null, focusClientY = null) {
  const previousZoom = boardState.zoom;
  const targetZoom = clamp(Math.round(nextZoom * 10) / 10, minZoom, maxZoom);
  if (targetZoom === previousZoom) return;

  const stageRect = els.stage.getBoundingClientRect();
  const focusX = focusClientX ?? (stageRect.left + stageRect.width / 2);
  const focusY = focusClientY ?? (stageRect.top + stageRect.height / 2);
  const screenX = focusX - stageRect.left;
  const screenY = focusY - stageRect.top;
  const worldX = (screenX - boardState.camera.x) / previousZoom;
  const worldY = (screenY - boardState.camera.y) / previousZoom;

  boardState.zoom = targetZoom;
  boardState.camera.x = screenX - worldX * targetZoom;
  boardState.camera.y = screenY - worldY * targetZoom;
  persistBoardState();
  applyLanguage();
  positionLaneLabels();
}

function setFilter(kind) {
  filterKind = kind;
  [
    [els.filterAll, "all"],
    [els.filterScenes, "scene"],
    [els.filterVariables, "variable"],
    [els.filterAssets, "asset"],
    [els.filterNotes, "note"],
  ].forEach(([button, value]) => button.classList.toggle("is-active", filterKind === value));
  document.querySelectorAll(".board-card").forEach(updateVisibility);
  drawLines();
}

function pill(textValue) {
  const item = document.createElement("span");
  item.className = "pill";
  item.textContent = textValue;
  return item;
}

function renderLayoutOptions() {
  els.layoutSelect.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = text("noLayouts");
  els.layoutSelect.append(placeholder);
  Object.keys(savedLayouts).sort().forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name === autoLayoutKey ? text("autoSavedLayout") : name;
    els.layoutSelect.append(option);
  });
}

function saveNamedLayout() {
  const name = els.layoutName.value.trim();
  if (!name) return;
  savedLayouts[name] = cloneBoardState();
  persistSavedLayouts();
  renderLayoutOptions();
  els.layoutSelect.value = name;
  updateLineHint(text("layoutSaved"));
}

function autoSaveLayout() {
  normalizeBoardState();
  savedLayouts[autoLayoutKey] = cloneBoardState();
  persistBoardState();
  persistSavedLayouts();
}

function loadNamedLayout() {
  const name = els.layoutSelect.value;
  if (!name || !savedLayouts[name]) return;
  boardState = structuredClone(savedLayouts[name]);
  persistBoardState();
  render();
  setFilter(filterKind);
  updateLineHint(text("layoutLoaded"));
}

function deleteNamedLayout() {
  const name = els.layoutSelect.value;
  if (!name || !savedLayouts[name]) return;
  delete savedLayouts[name];
  persistSavedLayouts();
  renderLayoutOptions();
  updateLineHint(text("layoutDeleted"));
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(draftStorageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistDraft() {
  localStorage.setItem(draftStorageKey, JSON.stringify(draft));
}

function loadBoardState() {
  try {
    const raw = localStorage.getItem(boardStateKey);
    return raw ? JSON.parse(raw) : defaultBoardState();
  } catch {
    return defaultBoardState();
  }
}

function persistBoardState() {
  localStorage.setItem(boardStateKey, JSON.stringify(boardState));
}

function persistSavedLayouts() {
  localStorage.setItem(boardLayoutsKey, JSON.stringify(savedLayouts));
}

function cloneBoardState() {
  return structuredClone(boardState);
}

function loadSavedLayouts() {
  try {
    const raw = localStorage.getItem(boardLayoutsKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadLegacyPositions() {
  try {
    const raw = localStorage.getItem(legacyPositionsKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadLegacyZoom() {
  const raw = Number(localStorage.getItem(legacyZoomKey));
  if (Number.isFinite(raw)) {
    return clamp(raw, minZoom, maxZoom);
  }
  return defaultZoom;
}

function entityKey(kind, id) {
  return `${kind}:${id}`;
}

function applyCamera() {
  const cameraX = Number.isFinite(boardState.camera?.x) ? boardState.camera.x : 0;
  const cameraY = Number.isFinite(boardState.camera?.y) ? boardState.camera.y : 0;
  const gridSize = 32 * boardState.zoom;
  els.stage.style.setProperty("--board-zoom", String(boardState.zoom));
  els.stage.style.setProperty("--camera-x", `${cameraX}px`);
  els.stage.style.setProperty("--camera-y", `${cameraY}px`);
  els.stage.style.setProperty("--grid-x", `${positiveModulo(cameraX, gridSize)}px`);
  els.stage.style.setProperty("--grid-y", `${positiveModulo(cameraY, gridSize)}px`);
  els.zoomValue.textContent = `${Math.round(boardState.zoom * 100)}%`;
}

function clientToWorld(clientX, clientY) {
  const rect = els.stage.getBoundingClientRect();
  return {
    x: (clientX - rect.left - boardState.camera.x) / boardState.zoom,
    y: (clientY - rect.top - boardState.camera.y) / boardState.zoom,
  };
}

function positionLaneLabels() {
  const lanePositions = {
    variable: -680,
    asset: -340,
    note: -1040,
    scene: 0,
  };
  [
    [els.laneVariables, lanePositions.variable],
    [els.laneAssets, lanePositions.asset],
    [els.laneNotes, lanePositions.note],
    [els.laneScenes, lanePositions.scene],
  ].forEach(([label, x]) => {
    label.parentElement.style.left = `${x}px`;
  });
}

function positiveModulo(value, modulo) {
  return ((value % modulo) + modulo) % modulo;
}

function uniqueId(prefix, usedValues) {
  const used = new Set((usedValues || []).filter(Boolean));
  for (let index = used.size + 1; index < used.size + 1000; index += 1) {
    const candidate = `${prefix}_${index}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${prefix}_${Date.now()}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function trimText(value, limit) {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

els.searchInput.addEventListener("input", () => {
  searchTerm = els.searchInput.value.trim().toLowerCase();
  document.querySelectorAll(".board-card").forEach(updateVisibility);
  drawLines();
});

els.filterAll.onclick = () => setFilter("all");
els.filterScenes.onclick = () => setFilter("scene");
els.filterVariables.onclick = () => setFilter("variable");
els.filterAssets.onclick = () => setFilter("asset");
els.filterNotes.onclick = () => setFilter("note");
els.autoLayout.onclick = autoLayout;
els.addScene.onclick = addScene;
els.addVariable.onclick = addVariable;
els.addAsset.onclick = addAsset;
els.addNote.onclick = addNote;
els.backBuilder?.addEventListener("click", autoSaveLayout);
els.openBuilder.addEventListener("click", autoSaveLayout);
els.connectMode.onclick = () => {
  connectState.enabled = !connectState.enabled;
  if (!connectState.enabled) connectState.source = "";
  highlightConnectSource();
  applyLanguage();
};
els.saveLayout.onclick = saveNamedLayout;
els.loadLayout.onclick = loadNamedLayout;
els.deleteLayout.onclick = deleteNamedLayout;
els.zoomOut.onclick = () => setZoom(boardState.zoom - 0.1);
els.zoomIn.onclick = () => setZoom(boardState.zoom + 0.1);
els.zoomReset.onclick = () => setZoom(1);
els.langRu.onclick = () => {
  currentLanguage = "ru";
  localStorage.setItem(languageKey, currentLanguage);
  render();
  setFilter(filterKind);
};
els.langEn.onclick = () => {
  currentLanguage = "en";
  localStorage.setItem(languageKey, currentLanguage);
  render();
  setFilter(filterKind);
};

els.stage.addEventListener("wheel", (event) => {
  event.preventDefault();
  if (event.ctrlKey) {
    setZoom(boardState.zoom + (event.deltaY < 0 ? 0.1 : -0.1), event.clientX, event.clientY);
    return;
  }
  boardState.camera.x -= event.deltaX;
  boardState.camera.y -= event.deltaY;
  persistBoardState();
  applyCamera();
}, { passive: false });

let stagePan = null;

els.stage.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  if (event.target.closest(".board-card, a, button, textarea, input, select, .line-delete, .board-line")) return;
  stagePan = {
    x: event.clientX,
    y: event.clientY,
    cameraX: boardState.camera.x,
    cameraY: boardState.camera.y,
  };
  els.stage.classList.add("is-panning");
  els.stage.setPointerCapture(event.pointerId);
});

els.stage.addEventListener("pointermove", (event) => {
  if (!stagePan) return;
  boardState.camera.x = stagePan.cameraX + (event.clientX - stagePan.x);
  boardState.camera.y = stagePan.cameraY + (event.clientY - stagePan.y);
  applyCamera();
});

els.stage.addEventListener("pointerup", (event) => {
  if (!stagePan) return;
  stagePan = null;
  els.stage.classList.remove("is-panning");
  els.stage.releasePointerCapture(event.pointerId);
  persistBoardState();
});

els.stage.addEventListener("pointercancel", () => {
  stagePan = null;
  els.stage.classList.remove("is-panning");
});

document.addEventListener("pointermove", updateLineDrag);
document.addEventListener("pointerup", finishLineDrag);
document.addEventListener("pointercancel", finishLineDrag);

window.addEventListener("pagehide", autoSaveLayout);
window.addEventListener("beforeunload", autoSaveLayout);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    autoSaveLayout();
  }
});

render();
setFilter("all");
