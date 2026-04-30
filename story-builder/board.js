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
  els.backBuilder.textContent = text("backBuilder");
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
  els.summaryLinksCount.textContent = String((boardState.lines || []).length);
}

function hasEntities() {
  return (draft.scenes?.length || 0) + (draft.variables?.length || 0) + (draft.assets?.length || 0) + (boardState.notes?.length || 0) > 0;
}

function ensureEntityPositions() {
  draft.variables.forEach((variable, index) => ensurePosition(entityKey("variable", variable.name || `variable-${index}`), layoutPoint("variable", index)));
  draft.assets.forEach((asset, index) => ensurePosition(entityKey("asset", asset.id || `asset-${index}`), layoutPoint("asset", index)));
  draft.scenes.forEach((scene, index) => ensurePosition(entityKey("scene", scene.id || `scene-${index}`), layoutPoint("scene", index)));
  boardState.notes.forEach((note, index) => ensurePosition(entityKey("note", note.id), layoutPoint("note", index)));
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
      meta: [pill(variable.type), pill(String(variable.value))],
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
    const choices = scene.choices || [];
    if (choices.length) {
      const label = document.createElement("strong");
      label.textContent = text("outgoing");
      body.append(label);
      const list = document.createElement("div");
      list.className = "choice-list";
      choices.forEach((choice) => {
        const row = document.createElement("div");
        row.className = "choice-row";
        const choiceLabel = document.createElement("span");
        choiceLabel.className = "choice-label";
        choiceLabel.textContent = trimText(choice.label || choice.id || "choice", 26);
        row.append(choiceLabel, pill(choice.target || "none"));
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

function createCard({ kind, id, title, subtitle, meta, href, editable = false, removable = false }) {
  const card = document.createElement("article");
  card.className = "board-card";
  card.dataset.kind = kind;
  card.dataset.id = id;

  const head = document.createElement("div");
  head.className = "card-head";

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

  if (removable) {
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "secondary small-button danger-button";
    removeButton.textContent = text("remove");
    removeButton.onclick = (event) => {
      event.stopPropagation();
      removeNote(id);
    };
    actions.append(removeButton);
  }

  body.append(actions);
  card.append(head, body);
  makeDraggable(card, editable);
  updateVisibility(card);
  return card;
}

function placeCard(card, key) {
  const point = boardState.positions[key] || { x: 24, y: 24 };
  card.style.left = `${point.x}px`;
  card.style.top = `${point.y}px`;
  els.canvas.append(card);
  renderedCards.set(key, card);
}

function makeDraggable(card, editable) {
  let drag = null;

  card.addEventListener("pointerdown", (event) => {
    if (event.target.closest("a,button,textarea,input,select")) return;
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
  boardState.lines.forEach((line) => {
    const from = renderedCards.get(line.from);
    const to = renderedCards.get(line.to);
    if (!from || !to) return;
    if (from.classList.contains("is-hidden") || to.classList.contains("is-hidden")) return;
    const x1 = from.offsetLeft + from.offsetWidth / 2;
    const y1 = from.offsetTop + from.offsetHeight / 2;
    const x2 = to.offsetLeft + to.offsetWidth / 2;
    const y2 = to.offsetTop + to.offsetHeight / 2;
    const curve = Math.max(60, Math.abs(x2 - x1) / 2);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`);
    path.setAttribute("class", "board-line");
    path.setAttribute("data-line-id", line.id);
    path.addEventListener("click", () => {
      removeLine(line.id);
    });
    els.lines.append(path);

    const deleteButton = document.createElementNS("http://www.w3.org/2000/svg", "g");
    deleteButton.setAttribute("class", "line-delete");
    deleteButton.setAttribute("tabindex", "0");
    deleteButton.setAttribute("role", "button");
    deleteButton.setAttribute("aria-label", text("remove"));
    deleteButton.setAttribute("transform", `translate(${(x1 + x2) / 2} ${(y1 + y2) / 2})`);
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
  draft.variables.push({ name, type: "number", value: 0 });
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
  boardState.lines = boardState.lines.filter((line) => line.from !== entityKey("note", noteId) && line.to !== entityKey("note", noteId));
  persistBoardState();
  render();
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
  };
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
  boardState.positions = {};
  ensureEntityPositions();
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
    variable: -840,
    asset: -280,
    note: 280,
    scene: 840,
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
els.backBuilder.addEventListener("click", autoSaveLayout);
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

window.addEventListener("pagehide", autoSaveLayout);
window.addEventListener("beforeunload", autoSaveLayout);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    autoSaveLayout();
  }
});

render();
setFilter("all");
