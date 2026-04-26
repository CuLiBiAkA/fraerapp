const loginScreen = document.querySelector("#login-screen");
const storyScreen = document.querySelector("#story-screen");
const sceneScreen = document.querySelector("#scene-screen");
const loginForm = document.querySelector("#login-form");
const usernameInput = document.querySelector("#username");
const storiesList = document.querySelector("#stories");
const sceneImage = document.querySelector("#scene-image");
const sceneTitle = document.querySelector("#scene-title");
const sceneText = document.querySelector("#scene-text");
const choices = document.querySelector("#choices");
const status = document.querySelector("#status");
const playerName = document.querySelector("#player-name");
const sceneNode = document.querySelector("#scene-node");
const resetButton = document.querySelector("#reset");
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
  sceneScreen.classList.toggle("hidden", screen !== sceneScreen);
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
  if (stories.length === 1) {
    await startStory(stories[0].key);
    return;
  }
  renderStories(stories);
}

function renderStories(stories) {
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
