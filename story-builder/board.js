import { emptyDraft, normalizeLanguage, translate } from "./core.js";

const draftStorageKey = "fraerapp.storyBuilderDraft";
const languageKey = "fraerapp.storyBuilderLanguage";
const positionsKey = "fraerapp.storyBuilderBoardPositions";
const zoomKey = "fraerapp.storyBuilderBoardZoom";
const surfaceWidth = 1600;
const surfaceHeight = 1400;

const ui = {
  ru: {
    title: "Карта сценария",
    subtitle: "Визуальный режим для больших историй: двигайте карточки, фильтруйте и быстро переходите к редактированию.",
    search: "Поиск",
    searchPlaceholder: "сцена, переменная, ассет",
    all: "Все",
    scenes: "Сцены",
    variables: "Переменные",
    assets: "Ассеты",
    autoLayout: "Авто-раскладка",
    openBuilder: "Открыть Builder",
    summaryScenes: "Сцен",
    summaryVariables: "Переменных",
    summaryAssets: "Ассетов",
    summaryLinks: "Переходов",
    laneScenes: "Сцены",
    laneVariables: "Переменные",
    laneAssets: "Ассеты",
    sceneKind: "Сцена",
    variableKind: "Переменная",
    assetKind: "Ассет",
    edit: "Редактировать",
    outgoing: "Исходящие переходы",
    background: "Фон",
    music: "Музыка",
    ending: "Финал",
    noChoices: "Без выборов",
    boardFor: "Карта: {title}",
    noDraft: "Черновик пуст. Вернитесь в Builder и создайте сценарий.",
    startScene: "Стартовая сцена",
  },
  en: {
    title: "Scenario Map",
    subtitle: "Visual mode for large stories: move cards, filter entities, and jump back into editing.",
    search: "Search",
    searchPlaceholder: "scene, variable, asset",
    all: "All",
    scenes: "Scenes",
    variables: "Variables",
    assets: "Assets",
    autoLayout: "Auto layout",
    openBuilder: "Open Builder",
    summaryScenes: "Scenes",
    summaryVariables: "Variables",
    summaryAssets: "Assets",
    summaryLinks: "Links",
    laneScenes: "Scenes",
    laneVariables: "Variables",
    laneAssets: "Assets",
    sceneKind: "Scene",
    variableKind: "Variable",
    assetKind: "Asset",
    edit: "Edit",
    outgoing: "Outgoing choices",
    background: "Background",
    music: "Music",
    ending: "Ending",
    noChoices: "No choices",
    boardFor: "Map: {title}",
    noDraft: "Draft is empty. Return to Builder and create a story.",
    startScene: "Start scene",
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
  autoLayout: document.querySelector("#auto-layout"),
  openBuilder: document.querySelector("#open-builder"),
  zoomOut: document.querySelector("#zoom-out"),
  zoomIn: document.querySelector("#zoom-in"),
  zoomReset: document.querySelector("#zoom-reset"),
  zoomValue: document.querySelector("#zoom-value"),
  stage: document.querySelector(".board-stage"),
  surface: document.querySelector("#board-surface"),
  laneScenes: document.querySelector("#lane-scenes"),
  laneVariables: document.querySelector("#lane-variables"),
  laneAssets: document.querySelector("#lane-assets"),
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
let positions = loadPositions();
let draft = loadDraft() || emptyDraft(currentLanguage);
let zoom = loadZoom();

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
  els.autoLayout.textContent = text("autoLayout");
  els.openBuilder.textContent = text("openBuilder");
  els.zoomValue.textContent = `${Math.round(zoom * 100)}%`;
  els.laneScenes.textContent = text("laneScenes");
  els.laneVariables.textContent = text("laneVariables");
  els.laneAssets.textContent = text("laneAssets");
  els.summaryScenesLabel.textContent = text("summaryScenes");
  els.summaryVariablesLabel.textContent = text("summaryVariables");
  els.summaryAssetsLabel.textContent = text("summaryAssets");
  els.summaryLinksLabel.textContent = text("summaryLinks");
  els.langRu.classList.toggle("is-active", currentLanguage === "ru");
  els.langEn.classList.toggle("is-active", currentLanguage === "en");
  els.stage.style.setProperty("--board-zoom", String(zoom));
}

function render() {
  applyLanguage();
  updateSummary();
  els.canvas.replaceChildren();
  if (!hasEntities()) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = text("noDraft");
    els.canvas.append(empty);
    return;
  }
  ensurePositions();
  createSceneCards();
  createVariableCards();
  createAssetCards();
}

function updateSummary() {
  const linkCount = (draft.scenes || []).reduce((sum, scene) => sum + (scene.choices?.length || 0), 0);
  els.summaryScenesCount.textContent = String(draft.scenes?.length || 0);
  els.summaryVariablesCount.textContent = String(draft.variables?.length || 0);
  els.summaryAssetsCount.textContent = String(draft.assets?.length || 0);
  els.summaryLinksCount.textContent = String(linkCount);
}

function hasEntities() {
  return (draft.scenes?.length || 0) + (draft.variables?.length || 0) + (draft.assets?.length || 0) > 0;
}

function ensurePositions() {
  draft.variables.forEach((variable, index) => {
    const key = entityKey("variable", variable.name || `variable-${index}`);
    if (!positions[key]) positions[key] = layoutPoint("variable", index);
  });
  draft.assets.forEach((asset, index) => {
    const key = entityKey("asset", asset.id || `asset-${index}`);
    if (!positions[key]) positions[key] = layoutPoint("asset", index);
  });
  draft.scenes.forEach((scene, index) => {
    const key = entityKey("scene", scene.id || `scene-${index}`);
    if (!positions[key]) positions[key] = layoutPoint("scene", index);
  });
  savePositions();
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
    const wrap = createCard({
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

    const body = wrap.querySelector(".card-body");
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
    placeCard(wrap, entityKey("scene", id));
  });
}

function createCard({ kind, id, title, subtitle, meta, href }) {
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
  const link = document.createElement("a");
  link.className = "card-link";
  link.href = href;
  link.textContent = text("edit");
  actions.append(link);
  body.append(actions);

  card.append(head, body);
  makeDraggable(card);
  updateVisibility(card);
  return card;
}

function placeCard(card, key) {
  const point = positions[key] || { x: 24, y: 24 };
  card.style.left = `${point.x}px`;
  card.style.top = `${point.y}px`;
  els.canvas.append(card);
}

function makeDraggable(card) {
  let drag = null;
  card.addEventListener("pointerdown", (event) => {
    if (event.target.closest("a")) return;
    const bounds = els.surface.getBoundingClientRect();
    const pointerX = (event.clientX - bounds.left) / zoom;
    const pointerY = (event.clientY - bounds.top) / zoom;
    drag = {
      id: entityKey(card.dataset.kind, card.dataset.id),
      offsetX: pointerX - card.offsetLeft,
      offsetY: pointerY - card.offsetTop,
    };
    card.classList.add("is-dragging");
    card.setPointerCapture(event.pointerId);
  });

  card.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const bounds = els.surface.getBoundingClientRect();
    const pointerX = (event.clientX - bounds.left) / zoom;
    const pointerY = (event.clientY - bounds.top) / zoom;
    const nextX = clamp(pointerX - drag.offsetX, 12, Math.max(12, surfaceWidth - card.offsetWidth - 12));
    const nextY = clamp(pointerY - drag.offsetY, 12, Math.max(12, surfaceHeight - card.offsetHeight - 12));
    card.style.left = `${nextX}px`;
    card.style.top = `${nextY}px`;
    positions[drag.id] = { x: nextX, y: nextY };
  });

  card.addEventListener("pointerup", (event) => {
    if (!drag) return;
    card.classList.remove("is-dragging");
    card.releasePointerCapture(event.pointerId);
    savePositions();
    drag = null;
  });
}

function updateVisibility(card) {
  const matchesFilter = filterKind === "all" || card.dataset.kind === filterKind;
  const haystack = `${card.dataset.id} ${card.querySelector(".card-title")?.textContent || ""} ${card.querySelector(".card-subtitle")?.textContent || ""}`.toLowerCase();
  const matchesSearch = !searchTerm || haystack.includes(searchTerm);
  card.classList.toggle("is-hidden", !(matchesFilter && matchesSearch));
}

function layoutPoint(kind, index) {
  const lanes = {
    variable: 24,
    asset: 540,
    scene: 1056,
  };
  const x = lanes[kind] ?? 24;
  const y = 70 + (index % 8) * 116 + Math.floor(index / 8) * 18;
  return { x, y };
}

function autoLayout() {
  positions = {};
  ensurePositions();
  render();
}

function setZoom(nextZoom) {
  zoom = clamp(Math.round(nextZoom * 10) / 10, 0.6, 1.8);
  localStorage.setItem(zoomKey, String(zoom));
  applyLanguage();
}

function setFilter(kind) {
  filterKind = kind;
  [
    [els.filterAll, "all"],
    [els.filterScenes, "scene"],
    [els.filterVariables, "variable"],
    [els.filterAssets, "asset"],
  ].forEach(([button, value]) => button.classList.toggle("is-active", filterKind === value));
  document.querySelectorAll(".board-card").forEach(updateVisibility);
}

function pill(textValue) {
  const item = document.createElement("span");
  item.className = "pill";
  item.textContent = textValue;
  return item;
}

function entityKey(kind, id) {
  return `${kind}:${id}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function trimText(value, limit) {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(draftStorageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadPositions() {
  try {
    const raw = localStorage.getItem(positionsKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePositions() {
  localStorage.setItem(positionsKey, JSON.stringify(positions));
}

function loadZoom() {
  const raw = Number(localStorage.getItem(zoomKey));
  if (Number.isFinite(raw) && raw >= 0.6 && raw <= 1.8) {
    return raw;
  }
  return 1;
}

els.searchInput.addEventListener("input", () => {
  searchTerm = els.searchInput.value.trim().toLowerCase();
  document.querySelectorAll(".board-card").forEach(updateVisibility);
});

els.filterAll.onclick = () => setFilter("all");
els.filterScenes.onclick = () => setFilter("scene");
els.filterVariables.onclick = () => setFilter("variable");
els.filterAssets.onclick = () => setFilter("asset");
els.autoLayout.onclick = autoLayout;
els.zoomOut.onclick = () => setZoom(zoom - 0.1);
els.zoomIn.onclick = () => setZoom(zoom + 0.1);
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
  if (!event.ctrlKey) return;
  event.preventDefault();
  setZoom(zoom + (event.deltaY < 0 ? 0.1 : -0.1));
}, { passive: false });

render();
setFilter("all");
