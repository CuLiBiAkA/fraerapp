const loginScreen = document.querySelector("#login-screen");
const storyScreen = document.querySelector("#story-screen");
const profileScreen = document.querySelector("#profile-screen");
const sceneScreen = document.querySelector("#scene-screen");
const loginForm = document.querySelector("#login-form");
const usernameInput = document.querySelector("#username");
const storiesList = document.querySelector("#stories");
const storySearch = document.querySelector("#story-search");
const storySort = document.querySelector("#story-sort");
const storyPagination = document.querySelector("#story-pagination");
const storiesPrev = document.querySelector("#stories-prev");
const storiesNext = document.querySelector("#stories-next");
const storiesPage = document.querySelector("#stories-page");
const profileSummary = document.querySelector("#profile-summary");
const profileStories = document.querySelector("#profile-stories");
const backToGameButton = document.querySelector("#back-to-game");
const sceneImage = document.querySelector("#scene-image");
const sceneTitle = document.querySelector("#scene-title");
const sceneText = document.querySelector("#scene-text");
const choices = document.querySelector("#choices");
const status = document.querySelector("#status");
const playerName = document.querySelector("#player-name");
const sceneNode = document.querySelector("#scene-node");
const resetButton = document.querySelector("#reset");
const menuButton = document.querySelector("#menu-button");
const profileButton = document.querySelector("#profile-button");
const logoutButton = document.querySelector("#logout");
const soundToggle = document.querySelector("#sound-toggle");
const adminToken = document.querySelector("#admin-token");
const storyJson = document.querySelector("#story-json");
const importStory = document.querySelector("#import-story");
const publishStory = document.querySelector("#publish-story");
const adminOutput = document.querySelector("#admin-output");
const langRuButton = document.querySelector("#lang-ru");
const langEnButton = document.querySelector("#lang-en");

const translations = {
  ru: {
    loginEyebrow: "Поезд 404",
    loginTitle: "Назови себя",
    loginSubtitle: "Ночной вокзал уже знает маршрут. Ему осталось узнать, кто держит билет.",
    usernameLabel: "Имя игрока",
    usernamePlaceholder: "Например: Алекс",
    loginButton: "Войти",
    adminSummary: "Админка истории",
    adminTokenLabel: "Токен администратора",
    storyJsonLabel: "Story JSON",
    storyJsonPlaceholder: "Вставьте сюда Story JSON",
    importButton: "Импортировать",
    publishLastImportButton: "Опубликовать последний импорт",
    storyScreenEyebrow: "Движок историй",
    storyScreenTitle: "Выберите историю",
    storyScreenSubtitle: "Каждая история запускается через единый backend-движок.",
    storySearchLabel: "Поиск историй",
    storySearchPlaceholder: "Название, ключ или автор",
    storySortLabel: "Сортировка",
    sortLastPlayed: "Последний вход",
    sortCompletion: "Процент прохождения",
    sortPublishedAt: "Дата публикации",
    sortUpdatedAt: "Дата обновления",
    prevPage: "Назад",
    nextPage: "Вперед",
    pageLabel: "Страница {page} из {pages}",
    noSearchResults: "По этому поиску историй нет.",
    menuButton: "Истории",
    profileButton: "Статы",
    profileEyebrow: "Механика истории",
    profileTitle: "Статы",
    profileSubtitle: "Текущие переменные, предметы и флаги этой истории.",
    backToGameButton: "Назад к игре",
    statsEmpty: "Автор истории пока не выбрал переменные для статов.",
    statEnabled: "Да",
    statDisabled: "Нет",
    storyRuns: "Запуски: {runs}",
    finishedRuns: "Финалы: {runs}",
    completionPercent: "{percent}% пройдено",
    publishedDate: "Опубликовано: {date}",
    updatedDate: "Обновлено: {date}",
    lastPlayedDate: "Последний вход: {date}",
    noDate: "нет данных",
    soundOn: "Звук: включен",
    soundOff: "Звук: выключен",
    resetButton: "Начать заново",
    logoutButton: "Выйти",
    noStories: "Опубликованных историй пока нет.",
    endingLabel: "Финал: {title}",
    endingFallback: "завершено",
    progressSaved: "Прогресс сохранен",
    sessionFinished: "Сессия завершена",
    loading: "Загрузка...",
    loginFailed: "Не удалось войти: {message}",
    webAudioUnsupported: "Web Audio не поддерживается в этом браузере",
    importFirst: "Сначала импортируйте историю.",
    errorPrefix: "Ошибка: {message}",
  },
  en: {
    loginEyebrow: "Train 404",
    loginTitle: "Name yourself",
    loginSubtitle: "The night station already knows the route. It only needs to know who holds the ticket.",
    usernameLabel: "Player name",
    usernamePlaceholder: "For example: Alex",
    loginButton: "Log in",
    adminSummary: "Story admin",
    adminTokenLabel: "Admin token",
    storyJsonLabel: "Story JSON",
    storyJsonPlaceholder: "Paste Story JSON here",
    importButton: "Import",
    publishLastImportButton: "Publish last import",
    storyScreenEyebrow: "Story Engine",
    storyScreenTitle: "Choose a story",
    storyScreenSubtitle: "Every story runs through the same backend engine.",
    storySearchLabel: "Search stories",
    storySearchPlaceholder: "Title, key or author",
    storySortLabel: "Sort",
    sortLastPlayed: "Last played",
    sortCompletion: "Completion",
    sortPublishedAt: "Published date",
    sortUpdatedAt: "Updated date",
    prevPage: "Prev",
    nextPage: "Next",
    pageLabel: "Page {page} of {pages}",
    noSearchResults: "No stories match this search.",
    menuButton: "Stories",
    profileButton: "Stats",
    profileEyebrow: "Story mechanics",
    profileTitle: "Stats",
    profileSubtitle: "Current variables, items and flags for this story.",
    backToGameButton: "Back to game",
    statsEmpty: "The story author has not selected any stats yet.",
    statEnabled: "Yes",
    statDisabled: "No",
    storyRuns: "Runs: {runs}",
    finishedRuns: "Finished: {runs}",
    completionPercent: "{percent}% complete",
    publishedDate: "Published: {date}",
    updatedDate: "Updated: {date}",
    lastPlayedDate: "Last played: {date}",
    noDate: "no data",
    soundOn: "Sound: on",
    soundOff: "Sound: off",
    resetButton: "Start over",
    logoutButton: "Log out",
    noStories: "No published stories yet.",
    endingLabel: "Ending: {title}",
    endingFallback: "finished",
    progressSaved: "Progress saved",
    sessionFinished: "Session finished",
    loading: "Loading...",
    loginFailed: "Login failed: {message}",
    webAudioUnsupported: "Web Audio is not supported",
    importFirst: "Import a story first.",
    errorPrefix: "Error: {message}",
  },
};

const storage = {
  get playerId() {
    return localStorage.getItem("fraerapp.playerId");
  },
  get username() {
    return localStorage.getItem("fraerapp.username");
  },
  get sessionId() {
    return localStorage.getItem("fraerapp.sessionId");
  },
  get language() {
    return localStorage.getItem("fraerapp.language") || "ru";
  },
  setSession(player) {
    localStorage.setItem("fraerapp.playerId", player.playerId);
    localStorage.setItem("fraerapp.username", player.username);
  },
  setGame(session) {
    localStorage.setItem("fraerapp.sessionId", session.sessionId);
    localStorage.setItem("fraerapp.storyKey", session.story.key);
  },
  setLanguage(language) {
    localStorage.setItem("fraerapp.language", language);
  },
  clearGame() {
    localStorage.removeItem("fraerapp.sessionId");
    localStorage.removeItem("fraerapp.storyKey");
  },
  clear() {
    this.clearGame();
    localStorage.removeItem("fraerapp.playerId");
    localStorage.removeItem("fraerapp.username");
  },
};

let sound = null;
let lastImportedStoryId = null;
let currentLanguage = storage.language;
let currentState = null;
let catalogStories = [];
let catalogPage = 1;

const storiesPerPage = 5;

const api = {
  login(username) {
    return request("/api/auth/login", { method: "POST", body: { username } });
  },
  stories() {
    return request("/api/catalog/stories");
  },
  createSession(storyKey) {
    return request("/api/sessions", { method: "POST", body: { storyKey } });
  },
  state(sessionId) {
    return request(`/api/sessions/${sessionId}/state`);
  },
  choice(sessionId, choiceId) {
    return request(`/api/sessions/${sessionId}/choice`, { method: "POST", body: { choiceId } });
  },
  reset(sessionId) {
    return request(`/api/sessions/${sessionId}/reset`, { method: "POST" });
  },
  importStory(rawJson, token) {
    return request("/api/admin/stories/import", { method: "POST", rawBody: rawJson, adminToken: token });
  },
  publishStory(storyId, token) {
    return request(`/api/admin/stories/${storyId}/publish`, { method: "POST", adminToken: token });
  },
};

function t(key, params = {}) {
  const template = translations[currentLanguage]?.[key] ?? translations.ru[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
}

function applyTranslations() {
  document.documentElement.lang = currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  updateLanguageButtons();
}

function updateLanguageButtons() {
  langRuButton.classList.toggle("is-active", currentLanguage === "ru");
  langEnButton.classList.toggle("is-active", currentLanguage === "en");
}

function setLanguage(language) {
  currentLanguage = language === "en" ? "en" : "ru";
  storage.setLanguage(currentLanguage);
  applyTranslations();
  if (soundToggle.dataset.soundState === "on") {
    soundToggle.textContent = t("soundOn");
  } else {
    soundToggle.textContent = t("soundOff");
  }
  if (currentState) {
    render(currentState);
  } else if (!storyScreen.classList.contains("hidden") && catalogStories.length > 0) {
    renderStoryPage();
  } else {
    setStatus(t("loading"));
  }
}

async function request(path, options = {}) {
  const headers = { Accept: "application/json" };
  if (options.body || options.rawBody) {
    headers["Content-Type"] = "application/json";
  }
  if (storage.playerId) {
    headers["X-Player-Id"] = storage.playerId;
  }
  if (options.adminToken) {
    headers["X-Admin-Token"] = options.adminToken;
  }

  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.rawBody || (options.body ? JSON.stringify(options.body) : undefined),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload.message || `HTTP ${response.status}`);
  }
  return payload;
}

function showOnly(screen) {
  loginScreen.classList.toggle("hidden", screen !== loginScreen);
  storyScreen.classList.toggle("hidden", screen !== storyScreen);
  profileScreen.classList.toggle("hidden", screen !== profileScreen);
  sceneScreen.classList.toggle("hidden", screen !== sceneScreen);
  updateTopActions(screen);
}

function updateTopActions(screen) {
  const loggedIn = Boolean(storage.playerId);
  const inScene = screen === sceneScreen;
  menuButton.classList.toggle("hidden", !loggedIn || screen === storyScreen);
  profileButton.classList.toggle("hidden", !currentState || screen === profileScreen);
  soundToggle.classList.toggle("hidden", !inScene);
  logoutButton.classList.toggle("hidden", !loggedIn);
}

function setStatus(message) {
  status.textContent = message;
}

async function afterLogin() {
  if (storage.sessionId) {
    try {
      render(await api.state(storage.sessionId));
      return;
    } catch (error) {
      storage.clearGame();
    }
  }

  const stories = await api.stories();
  renderStories(stories);
}

function renderStories(stories) {
  catalogStories = Array.isArray(stories) ? stories : [];
  catalogPage = 1;
  renderStoryPage();
  return;
  showOnly(storyScreen);
  storiesList.replaceChildren();
  if (stories.length === 0) {
    storiesList.textContent = t("noStories");
    return;
  }
  for (const story of stories) {
    const button = document.createElement("button");
    button.type = "button";
    const author = story.authorName ? ` • ${story.authorName}` : "";
    const runs = typeof story.totalRuns === "number" ? ` • ${story.totalRuns}` : "";
    button.textContent = `${story.title} (${story.key})${author}${runs}`;
    button.addEventListener("click", () => startStory(story.key));
    storiesList.append(button);
  }
}

async function startStory(storyKey) {
  const session = await api.createSession(storyKey);
  storage.setGame(session);
  render(session);
}

async function openStoryMenu() {
  storage.clearGame();
  currentState = null;
  renderStories(await api.stories());
}

async function openProfile() {
  if (!currentState) {
    return;
  }
  showOnly(profileScreen);
  renderGameStats(currentState);
}

function renderGameStats(state) {
  profileSummary.replaceChildren();
  profileStories.replaceChildren();
  const variables = Object.entries(state.statsVariables || {});
  const sceneCard = statCard(state.story.title, state.scene.title, "scene");
  const statusCard = statCard(state.status, `${state.story.key} / ${state.scene.id}`, "status");
  profileSummary.append(sceneCard, statusCard);

  if (variables.length === 0) {
    profileStories.textContent = t("statsEmpty");
    return;
  }

  for (const [name, value] of variables) {
    profileStories.append(variableCard(name, value));
  }
}

function statCard(title, subtitle, kind) {
  const card = document.createElement("div");
  card.className = `stat-card stat-card-${kind}`;
  const valueNode = document.createElement("strong");
  valueNode.textContent = title;
  const label = document.createElement("span");
  label.textContent = subtitle;
  card.append(valueNode, label);
  return card;
}

function variableCard(name, value) {
  const item = document.createElement("div");
  item.className = `variable-card variable-${variableKind(value)}`;
  const header = document.createElement("div");
  header.className = "variable-header";
  const title = document.createElement("strong");
  title.textContent = formatVariableName(name);
  const rawName = document.createElement("span");
  rawName.textContent = name;
  header.append(title, rawName);

  const valueNode = document.createElement("div");
  valueNode.className = "variable-value";
  if (typeof value === "boolean") {
    valueNode.textContent = value ? t("statEnabled") : t("statDisabled");
    valueNode.classList.toggle("is-enabled", value);
  } else if (typeof value === "number") {
    valueNode.textContent = formatNumber(value);
    if (value >= 0 && value <= 100) {
      const track = document.createElement("span");
      track.className = "variable-meter";
      track.style.setProperty("--meter-width", `${value}%`);
      item.append(header, valueNode, track);
      return item;
    }
  } else if (value == null) {
    valueNode.textContent = t("noDate");
  } else if (typeof value === "object") {
    valueNode.textContent = JSON.stringify(value);
  } else {
    valueNode.textContent = String(value);
  }
  item.append(header, valueNode);
  return item;
}

function variableKind(value) {
  if (typeof value === "boolean") {
    return "flag";
  }
  if (typeof value === "number") {
    return "number";
  }
  return "text";
}

function formatVariableName(name) {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function renderStoryPage() {
  showOnly(storyScreen);
  storiesList.replaceChildren();
  const query = storySearch.value.trim().toLowerCase();
  const filtered = sortStories(catalogStories.filter((story) => storyMatchesQuery(story, query)));
  if (catalogStories.length === 0) {
    storiesList.textContent = t("noStories");
    storyPagination.classList.add("hidden");
    return;
  }
  if (filtered.length === 0) {
    storiesList.textContent = t("noSearchResults");
    storyPagination.classList.add("hidden");
    return;
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / storiesPerPage));
  catalogPage = Math.min(Math.max(catalogPage, 1), pageCount);
  const pageStories = filtered.slice((catalogPage - 1) * storiesPerPage, catalogPage * storiesPerPage);
  for (const story of pageStories) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "story-card";
    const author = story.authorName ? ` • ${story.authorName}` : "";
    const progress = Math.round(story.completionRate ?? 0);
    const titleRow = document.createElement("div");
    titleRow.className = "story-title-row";
    const title = document.createElement("strong");
    title.textContent = story.title;
    const key = document.createElement("span");
    key.className = "story-key";
    key.textContent = `${story.key}${author}`;
    titleRow.append(title, key);

    const meta = document.createElement("div");
    meta.className = "story-meta";
    for (const text of [
      t("storyRuns", { runs: story.totalRuns ?? 0 }),
      t("finishedRuns", { runs: story.finishedRuns ?? 0 }),
      t("publishedDate", { date: formatDate(story.publishedAt) }),
      t("updatedDate", { date: formatDate(story.updatedAt) }),
      t("lastPlayedDate", { date: formatDate(story.lastPlayedAt) }),
    ]) {
      const item = document.createElement("span");
      item.textContent = text;
      meta.append(item);
    }

    const progressRow = document.createElement("div");
    progressRow.className = "progress-row";
    const completion = document.createElement("span");
    completion.className = "completion-rate";
    completion.style.setProperty("--completion-color", completionColor(story.completionRate));
    completion.textContent = t("completionPercent", { percent: progress });
    const track = document.createElement("span");
    track.className = "progress-track";
    track.style.setProperty("--completion-color", completionColor(story.completionRate));
    track.style.setProperty("--completion-width", `${progress}%`);
    progressRow.append(completion, track);
    button.append(titleRow, meta, progressRow);
    button.addEventListener("click", () => startStory(story.key));
    storiesList.append(button);
  }
  storyPagination.classList.toggle("hidden", pageCount <= 1);
  storiesPage.textContent = t("pageLabel", { page: catalogPage, pages: pageCount });
  storiesPrev.disabled = catalogPage <= 1;
  storiesNext.disabled = catalogPage >= pageCount;
}

function sortStories(stories) {
  const sortMode = storySort.value;
  const lastPlayedStory = [...stories].sort((first, second) => compareDate(second.lastPlayedAt, first.lastPlayedAt))[0];
  const rest = lastPlayedStory?.lastPlayedAt
    ? stories.filter((story) => story !== lastPlayedStory)
    : stories;
  const sorted = [...rest].sort((first, second) => {
    if (sortMode === "completion") {
      return compareNumber(second.completionRate, first.completionRate) || compareDate(second.lastPlayedAt, first.lastPlayedAt);
    }
    if (sortMode === "publishedAt") {
      return compareDate(second.publishedAt, first.publishedAt) || compareDate(second.lastPlayedAt, first.lastPlayedAt);
    }
    if (sortMode === "updatedAt") {
      return compareDate(second.updatedAt, first.updatedAt) || compareDate(second.lastPlayedAt, first.lastPlayedAt);
    }
    return compareDate(second.lastPlayedAt, first.lastPlayedAt)
      || compareDate(second.updatedAt, first.updatedAt)
      || compareDate(second.publishedAt, first.publishedAt);
  });
  return lastPlayedStory?.lastPlayedAt ? [lastPlayedStory, ...sorted] : sorted;
}

function compareNumber(first, second) {
  return Number(first ?? -1) - Number(second ?? -1);
}

function compareDate(first, second) {
  return dateValue(first) - dateValue(second);
}

function dateValue(value) {
  return value ? new Date(value).getTime() || 0 : 0;
}

function formatDate(value) {
  if (!value) {
    return t("noDate");
  }
  return new Intl.DateTimeFormat(currentLanguage === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function completionColor(rate) {
  const normalized = Math.max(0, Math.min(100, Number(rate ?? 0))) / 100;
  const hue = normalized * 120;
  return `hsl(${hue} 72% 46%)`;
}

function storyMatchesQuery(story, query) {
  if (!query) {
    return true;
  }
  return [story.title, story.key, story.description, story.authorName]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function render(state) {
  currentState = state;
  const scene = state.scene;
  showOnly(sceneScreen);
  playerName.textContent = storage.username || "";
  sceneNode.textContent = `${state.story.key} / ${scene.id}`;
  sceneTitle.textContent = scene.title;
  sceneText.textContent = scene.text;
  sceneImage.src = scene.backgroundUrl || "/assets/platform.svg";
  sceneImage.alt = scene.title;
  sceneImage.classList.remove("fade-in");
  if (scene.animation && scene.animation.type === "fade-in") {
    requestAnimationFrame(() => sceneImage.classList.add("fade-in"));
  }
  choices.replaceChildren();

  if (scene.ending) {
    const ending = document.createElement("p");
    ending.className = "status";
    ending.textContent = t("endingLabel", {
      title: scene.ending.title || scene.ending.type || t("endingFallback"),
    });
    choices.append(ending);
  }

  for (const choice of scene.choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = choice.label;
    button.addEventListener("click", () => withBusy(button, async () => {
      ensureSound();
      render(await api.choice(state.sessionId, choice.id));
    }));
    choices.append(button);
  }

  setStatus(state.status === "finished" ? t("sessionFinished") : t("progressSaved"));
  if (!profileScreen.classList.contains("hidden")) {
    renderGameStats(state);
  }
}

async function withBusy(button, action) {
  try {
    button.disabled = true;
    setStatus(t("loading"));
    await action();
  } catch (error) {
    setStatus(t("errorPrefix", { message: error.message }));
  } finally {
    button.disabled = false;
  }
}

function ensureSound() {
  if (sound) {
    sound.start();
  }
}

function createSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return null;
  }
  let context;
  let gain;
  let oscillators = [];
  let enabled = false;
  return {
    async start() {
      if (enabled) {
        return;
      }
      if (!context) {
        context = new AudioContext();
      }
      await context.resume();
      gain = context.createGain();
      gain.gain.value = 0.025;
      gain.connect(context.destination);
      oscillators = [146.83, 220, 293.66].map((frequency) => {
        const osc = context.createOscillator();
        osc.type = "sine";
        osc.frequency.value = frequency;
        osc.connect(gain);
        osc.start();
        return osc;
      });
      enabled = true;
      soundToggle.dataset.soundState = "on";
      soundToggle.textContent = t("soundOn");
    },
    stop() {
      for (const osc of oscillators) {
        osc.stop();
      }
      oscillators = [];
      enabled = false;
      soundToggle.dataset.soundState = "off";
      soundToggle.textContent = t("soundOff");
    },
    toggle() {
      if (enabled) {
        this.stop();
      } else {
        this.start();
      }
    },
  };
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = usernameInput.value.trim();
  if (!username) {
    return;
  }
  try {
    storage.setSession(await api.login(username));
    ensureSound();
    await afterLogin();
  } catch (error) {
    alert(t("loginFailed", { message: error.message }));
  }
});

resetButton.addEventListener("click", async () => {
  if (storage.sessionId) {
    render(await api.reset(storage.sessionId));
  }
});

menuButton.addEventListener("click", () => {
  openStoryMenu().catch((error) => setStatus(t("errorPrefix", { message: error.message })));
});

profileButton.addEventListener("click", () => {
  openProfile();
});

backToGameButton.addEventListener("click", () => {
  if (currentState) {
    showOnly(sceneScreen);
  }
});

logoutButton.addEventListener("click", () => {
  storage.clear();
  currentState = null;
  showOnly(loginScreen);
});

soundToggle.addEventListener("click", () => {
  if (!sound) {
    sound = createSound();
  }
  if (!sound) {
    setStatus(t("webAudioUnsupported"));
    return;
  }
  sound.toggle();
});

importStory.addEventListener("click", async () => {
  try {
    const result = await api.importStory(storyJson.value, adminToken.value || "dev-admin-token");
    lastImportedStoryId = result.storyId;
    adminOutput.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    adminOutput.textContent = error.message;
  }
});

publishStory.addEventListener("click", async () => {
  if (!lastImportedStoryId) {
    adminOutput.textContent = t("importFirst");
    return;
  }
  try {
    const result = await api.publishStory(lastImportedStoryId, adminToken.value || "dev-admin-token");
    adminOutput.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    adminOutput.textContent = error.message;
  }
});

langRuButton.addEventListener("click", () => setLanguage("ru"));
langEnButton.addEventListener("click", () => setLanguage("en"));

storySearch.addEventListener("input", () => {
  catalogPage = 1;
  renderStoryPage();
});

storySort.addEventListener("change", () => {
  catalogPage = 1;
  renderStoryPage();
});

storiesPrev.addEventListener("click", () => {
  catalogPage -= 1;
  renderStoryPage();
});

storiesNext.addEventListener("click", () => {
  catalogPage += 1;
  renderStoryPage();
});

sound = createSound();
applyTranslations();
soundToggle.dataset.soundState = "off";
soundToggle.textContent = t("soundOff");
setStatus(t("loading"));
if (storage.playerId) {
  afterLogin().catch(() => {
    storage.clear();
    currentState = null;
    showOnly(loginScreen);
  });
} else {
  showOnly(loginScreen);
}
