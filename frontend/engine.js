import {
  credentialToJson,
  parseCreationOptions,
  parseRequestOptions,
  passkeysSupported,
} from "./passkeys.js";

const loginScreen = document.querySelector("#login-screen");
const authLoadingScreen = document.querySelector("#auth-loading-screen");
const storyScreen = document.querySelector("#story-screen");
const settingsScreen = document.querySelector("#settings-screen");
const sceneScreen = document.querySelector("#scene-screen");
const loginForm = document.querySelector("#login-form");
const usernameInput = document.querySelector("#username");
const personalDataConsent = document.querySelector("#personal-data-consent");
const consentHint = document.querySelector("#consent-hint");
const loginStatus = document.querySelector("#login-status");
const storiesList = document.querySelector("#stories");
const storySearch = document.querySelector("#story-search");
const storySort = document.querySelector("#story-sort");
const storyPagination = document.querySelector("#story-pagination");
const storiesPrev = document.querySelector("#stories-prev");
const storiesNext = document.querySelector("#stories-next");
const storiesPage = document.querySelector("#stories-page");
const sceneImage = document.querySelector("#scene-image");
const sceneTitle = document.querySelector("#scene-title");
const sceneText = document.querySelector("#scene-text");
const sceneStatsCount = document.querySelector("#scene-stats-count");
const sceneStatsList = document.querySelector("#scene-stats-list");
const choices = document.querySelector("#choices");
const status = document.querySelector("#status");
const playerName = document.querySelector("#player-name");
const sceneNode = document.querySelector("#scene-node");
const topSessionGroup = document.querySelector(".top-group-session");
const menuButton = document.querySelector("#menu-button");
const settingsButton = document.querySelector("#settings-button");
const logoutButton = document.querySelector("#logout");
const soundControl = document.querySelector("#sound-control");
const soundToggle = document.querySelector("#sound-toggle");
const volumeSlider = document.querySelector("#volume-slider");
const langRuButton = document.querySelector("#lang-ru");
const langEnButton = document.querySelector("#lang-en");
const passkeyLoginButton = document.querySelector("#passkey-login");
const telegramLoginButton = document.querySelector("#telegram-login");
const passkeyUnavailable = document.querySelector("#passkey-unavailable");
const passkeySettings = document.querySelector("#passkey-settings");
const passkeyName = document.querySelector("#passkey-name");
const passkeyRegisterButton = document.querySelector("#passkey-register");
const passkeyList = document.querySelector("#passkey-list");
const passkeyStatus = document.querySelector("#passkey-status");
const cookieBanner = document.querySelector("#cookie-banner");
const cookieAccept = document.querySelector("#cookie-accept");
const passkeyNudge = document.querySelector("#passkey-nudge");
const passkeyNudgeOpen = document.querySelector("#passkey-nudge-open");
const passkeyNudgeDismiss = document.querySelector("#passkey-nudge-dismiss");
const homeSearchButton = document.querySelector("#home-search");
const homeSettingsButton = document.querySelector("#home-settings");
const homeProfileButton = document.querySelector("#home-profile");
const homeReadButton = document.querySelector("#home-read");
const homeCreateButton = document.querySelector("#home-create");
const homeStories = document.querySelector("#home-stories");
const homePrevButton = document.querySelector("#home-prev");
const homeNextButton = document.querySelector("#home-next");
const authModal = document.querySelector("#auth-modal");
const authModalClose = document.querySelector("#auth-modal-close");
const settingsModal = document.querySelector("#settings-modal");
const settingsModalClose = document.querySelector("#settings-modal-close");
const profileModal = document.querySelector("#profile-modal");
const profileModalClose = document.querySelector("#profile-modal-close");
const profileModalEmail = document.querySelector("#profile-modal-email");
const profileLogoutButton = document.querySelector("#profile-logout");
const modalLangRuButton = document.querySelector("#modal-lang-ru");
const modalLangEnButton = document.querySelector("#modal-lang-en");

const translations = {
  ru: {
    loginEyebrow: "FraerApp Stories",
    authLoadingEyebrow: "FraerApp Stories",
    authLoadingTitle: "Проверяем вход",
    authLoadingText: "Подождите несколько секунд. Если сессия активна, мы сразу откроем библиотеку.",
    loginTitle: "Истории, которые оживают в твоем воображении",
    loginSubtitle: "Читай. Создавай. Твори.",
    homeReadStories: "Читать истории",
    homeCreateStory: "Создать свою",
    authModalTitle: "Начните знакомство с историей",
    authModalText: "Сейчас вам доступен просмотр карточек историй. После регистрации вы сможете проходить истории, сохранять прогресс и открыть доступ ко всей библиотеке.",
    settingsModalTitle: "Настройки",
    settingsLanguage: "Язык",
    profileModalTitle: "Аккаунт",
    usernameLabel: "Email",
    usernamePlaceholder: "you@example.com",
    loginButton: "Получить ссылку",
    personalDataConsent: "Я принимаю согласие на обработку персональных данных и ознакомлен с политикой конфиденциальности.",
    personalDataConsentHint: "Перед входом нужно поставить галочку согласия — без неё ссылка для входа не создаётся.",
    personalDataConsentRequired: "Перед входом необходимо согласиться с обработкой персональных данных.",
    consentLink: "Согласие",
    privacyLink: "Политика",
    termsLink: "Пользовательское соглашение",
    loginLinkSent: "Откройте Telegram-бота и напишите ему любое сообщение. Он отправит одноразовую ссылку для входа.",
    loginSpamHint: "При ручной выдаче администратор передаст ссылку напрямую.",
    loginDevLink: "Открыть dev-ссылку для входа",
    loginDevHint: "Локальный dev-режим: можно войти сразу по ссылке ниже.",
    loginEndpointHint: "Откройте приложение через http://localhost:8088, чтобы работали вход и API.",
    passkeyOr: "или",
    passkeyLogin: "Войти с passkey",
    telegramLogin: "Войти через Telegram",
    telegramLoginUnavailable: "Вход через Telegram пока недоступен.",
    passkeyUnavailable: "Вход по passkey недоступен в этом браузере",
    passkeySettingsTitle: "Безопасный вход",
    passkeySettingsHint: "Добавьте Touch ID, Face ID, Windows Hello или ключ безопасности для входа без email-ссылки.",
    passkeyNameLabel: "Название устройства",
    passkeyNamePlaceholder: "Мой телефон",
    passkeyRegister: "Добавить passkey",
    passkeyRegistered: "Passkey добавлен.",
    passkeyDeleted: "Passkey удалён.",
    passkeyEmpty: "Passkey пока не добавлены.",
    passkeyDelete: "Удалить",
    passkeyCreated: "Добавлен: {date}",
    passkeyLastUsed: "Последний вход: {date}",
    passkeySynced: "Синхронизируемый ключ",
    passkeyLocal: "Ключ устройства",
    passkeyLoginFailed: "Не удалось войти с passkey: {message}",
    passkeyRegistrationFailed: "Не удалось добавить passkey: {message}",
    passkeyRecentAuthRequired: "Чтобы добавить passkey, заново войдите по ссылке и сразу повторите привязку.",
    passkeyNotAllowed: "Браузер отменил или запретил операцию passkey. Откройте fraerapp.ru в Safari или Chrome по HTTPS, разрешите Face ID, Touch ID или ключ безопасности и попробуйте еще раз.",
    passkeyCredentialMissing: "Браузер не вернул passkey. Повторите попытку и завершите подтверждение Face ID, Touch ID или ключом безопасности.",
    passkeyAlreadyRegistered: "Этот passkey уже добавлен. Используйте другое устройство или удалите старый passkey в настройках.",
    passkeyNudgeTitle: "Добавьте быстрый вход",
    passkeyNudgeText: "Привяжите passkey после первого входа, чтобы дальше входить без email-ссылок.",
    passkeyNudgeOpen: "Открыть настройки",
    passkeyNudgeLater: "Позже",
    adminSummary: "Админка истории",
    adminTokenLabel: "Админ-действия требуют роль администратора",
    storyJsonLabel: "JSON истории",
    storyJsonPlaceholder: "Вставьте сюда JSON истории",
    importButton: "Импортировать",
    publishLastImportButton: "Опубликовать последний импорт",
    storyScreenEyebrow: "Библиотека FraerApp",
    storyScreenTitle: "Выберите историю",
    storyScreenSubtitle: "Интерактивные истории с сохранением прогресса, концовками и персональными маршрутами",
    storySearchLabel: "Поиск историй",
    storySearchPlaceholder: "Название, автор или ключ",
    storySortLabel: "Сортировка",
    sortLastPlayed: "Последний прогресс",
    sortCompletion: "Завершение",
    sortPublishedAt: "Опубликовано",
    sortUpdatedAt: "Обновлено",
    prevPage: "Назад",
    nextPage: "Далее",
    pageLabel: "Страница {page} из {pages}",
    noSearchResults: "По этому поиску историй нет.",
    continueButton: "Продолжить",
    startButton: "Начать",
    newRunButton: "Новая игра",
    newRunConfirm: "Начать новую игру? Текущее сохранение останется в списке, но вы начнете отдельный проход с первой сцены.",
    saveScene: "Сцена: {scene}",
    menuButton: "Истории",
    settingsButton: "Настройки",
    builderButton: "Конструктор",
    adminButton: "Админ",
    settingsEyebrow: "Настройки",
    settingsTitle: "Аккаунт и безопасность",
    settingsSubtitle: "Управляйте безопасным входом и устройствами passkey.",
    sceneStatsTitle: "Статистика",
    sceneStatsCount: "{count} шт.",
    statsEmpty: "Автор истории пока не выбрал переменные для статов.",
    statEnabled: "Да",
    statDisabled: "Нет",
    storyRuns: "Запуски: {runs}",
    finishedRuns: "Завершено: {runs}",
    completionPercent: "{percent}% пройдено",
    publishedDate: "Опубликовано: {date}",
    updatedDate: "Обновлено: {date}",
    lastPlayedDate: "Прогресс: {date}",
    noDate: "нет данных",
    soundOn: "Звук: включен",
    soundOff: "Звук: выключен",
    volumeLabel: "Громкость",
    logoutButton: "Выйти",
    noStories: "Опубликованных историй пока нет.",
    endingLabel: "Финал: {title}",
    endingFallback: "завершено",
    progressSaved: "Прогресс сохранен",
    sessionFinished: "Сессия завершена",
    loading: "Загрузка...",
    loginFailed: "Не удалось войти: {message}",
    loginLinkInvalid: "Ссылка для входа недействительна, уже использована или истекла. Запросите новую ссылку.",
    loginLinkInvalidAction: "Войти через Telegram",
    webAudioUnsupported: "Web Audio не поддерживается в этом браузере",
    importFirst: "Сначала импортируйте историю.",
    errorPrefix: "Ошибка: {message}",
    cookieBannerTitle: "Мы используем cookie",
    cookieBannerText: "Cookie нужны для входа, сохранения сессии и стабильной работы игры.",
    cookieAccept: "Понятно",
  },
  en: {
    loginEyebrow: "FraerApp Stories",
    authLoadingEyebrow: "FraerApp Stories",
    authLoadingTitle: "Checking sign-in",
    authLoadingText: "Please wait a few seconds. If your session is active, we will open the library.",
    loginTitle: "Stories that come alive in your imagination",
    loginSubtitle: "Read. Create. Imagine.",
    homeReadStories: "Read stories",
    homeCreateStory: "Create yours",
    authModalTitle: "Start exploring the story",
    authModalText: "You can browse story cards now. After sign-in you can play stories, save progress, and access the full library.",
    settingsModalTitle: "Settings",
    settingsLanguage: "Language",
    profileModalTitle: "Account",
    usernameLabel: "Email",
    usernamePlaceholder: "you@example.com",
    loginButton: "Get link",
    personalDataConsent: "I accept the personal data processing consent and acknowledge the privacy policy.",
    personalDataConsentHint: "You need to tick the consent checkbox before sign-in; otherwise the link will not be created.",
    personalDataConsentRequired: "You need to accept personal data processing before sign-in.",
    consentLink: "Consent",
    privacyLink: "Privacy policy",
    termsLink: "Terms of use",
    loginLinkSent: "Open the Telegram bot and send it any message. It will reply with a one-time sign-in link.",
    loginSpamHint: "For manual delivery, an administrator will provide the link directly.",
    loginDevLink: "Open dev sign-in link",
    loginDevHint: "Local dev mode: you can sign in with the link below.",
    loginEndpointHint: "Open the app through http://localhost:8088 so sign-in and API routes work.",
    passkeyOr: "or",
    passkeyLogin: "Sign in with a passkey",
    telegramLogin: "Sign in with Telegram",
    telegramLoginUnavailable: "Telegram sign-in is not available yet.",
    passkeyUnavailable: "Passkeys are unavailable in this browser or the connection is not secure.",
    passkeySettingsTitle: "Secure sign-in",
    passkeySettingsHint: "Add Touch ID, Face ID, Windows Hello, or a security key to sign in without an email link.",
    passkeyNameLabel: "Device name",
    passkeyNamePlaceholder: "My phone",
    passkeyRegister: "Add passkey",
    passkeyRegistered: "Passkey added.",
    passkeyDeleted: "Passkey deleted.",
    passkeyEmpty: "No passkeys have been added yet.",
    passkeyDelete: "Delete",
    passkeyCreated: "Added: {date}",
    passkeyLastUsed: "Last sign-in: {date}",
    passkeySynced: "Synced passkey",
    passkeyLocal: "Device passkey",
    passkeyLoginFailed: "Passkey sign-in failed: {message}",
    passkeyRegistrationFailed: "Could not add passkey: {message}",
    passkeyRecentAuthRequired: "To add a passkey, sign in again with an email link and bind the passkey right after that.",
    passkeyNotAllowed: "The browser cancelled or blocked the passkey operation. Open fraerapp.ru in Safari or Chrome over HTTPS, allow Face ID, Touch ID, or your security key, and try again.",
    passkeyCredentialMissing: "The browser did not return a passkey. Try again and complete the Face ID, Touch ID, or security key prompt.",
    passkeyAlreadyRegistered: "This passkey is already added. Use another device or remove the old passkey in settings.",
    passkeyNudgeTitle: "Add quick sign-in",
    passkeyNudgeText: "Bind a passkey after your first sign-in to continue without email links.",
    passkeyNudgeOpen: "Open settings",
    passkeyNudgeLater: "Later",
    adminSummary: "Story admin",
    adminTokenLabel: "Admin actions require the admin role",
    storyJsonLabel: "Story JSON",
    storyJsonPlaceholder: "Paste Story JSON here",
    importButton: "Import",
    publishLastImportButton: "Publish last import",
    storyScreenEyebrow: "FraerApp Library",
    storyScreenTitle: "Choose a story",
    storyScreenSubtitle: "Interactive stories with saved progress, endings and personal routes.",
    storySearchLabel: "Search",
    storySearchPlaceholder: "Title, author or key",
    storySortLabel: "Sort",
    sortLastPlayed: "Recent progress",
    sortCompletion: "Completion",
    sortPublishedAt: "Published date",
    sortUpdatedAt: "Updated date",
    prevPage: "Prev",
    nextPage: "Next",
    pageLabel: "Page {page} of {pages}",
    noSearchResults: "No stories match this search.",
    continueButton: "Continue",
    startButton: "Start",
    newRunButton: "New game",
    newRunConfirm: "Start a new game? Your current save will stay in the list, but this will create a separate run from the first scene.",
    saveScene: "Scene: {scene}",
    menuButton: "Stories",
    settingsButton: "Settings",
    builderButton: "Builder",
    adminButton: "Admin",
    settingsEyebrow: "Settings",
    settingsTitle: "Account and security",
    settingsSubtitle: "Manage secure sign-in and passkey devices.",
    sceneStatsTitle: "Stats",
    sceneStatsCount: "{count}",
    statsEmpty: "The story author has not selected any stats yet.",
    statEnabled: "Yes",
    statDisabled: "No",
    storyRuns: "Runs: {runs}",
    finishedRuns: "Finished: {runs}",
    completionPercent: "{percent}% complete",
    publishedDate: "Published: {date}",
    updatedDate: "Updated: {date}",
    lastPlayedDate: "Progress: {date}",
    noDate: "no data",
    soundOn: "Sound: on",
    soundOff: "Sound: off",
    volumeLabel: "Volume",
    logoutButton: "Log out",
    noStories: "No published stories yet.",
    endingLabel: "Ending: {title}",
    endingFallback: "finished",
    progressSaved: "Progress saved",
    sessionFinished: "Session finished",
    loading: "Loading...",
    loginFailed: "Login failed: {message}",
    loginLinkInvalid: "This sign-in link is invalid, already used, or expired. Request a new link.",
    loginLinkInvalidAction: "Sign in with Telegram",
    webAudioUnsupported: "Web Audio is not supported",
    importFirst: "Import a story first.",
    errorPrefix: "Error: {message}",
    cookieBannerTitle: "We use cookies",
    cookieBannerText: "Cookies are required for sign-in, session storage, and stable game operation.",
    cookieAccept: "Got it",
  },
};

const storage = {
  get email() {
    return localStorage.getItem("fraerapp.email");
  },
  get sessionId() {
    return localStorage.getItem("fraerapp.sessionId");
  },
  get language() {
    return localStorage.getItem("fraerapp.language") || "ru";
  },
  get volume() {
    return Number(localStorage.getItem("fraerapp.volume") ?? 45);
  },
  get roles() {
    try {
      const roles = JSON.parse(localStorage.getItem("fraerapp.roles") || "[]");
      return Array.isArray(roles) ? roles : [];
    } catch {
      return [];
    }
  },
  get cookieConsent() {
    return localStorage.getItem("fraerapp.cookieConsent");
  },
  get passkeyNudgeDismissed() {
    return localStorage.getItem("fraerapp.passkeyNudgeDismissed") === "true";
  },
  setUser(user) {
    localStorage.setItem("fraerapp.email", user.email);
    localStorage.setItem("fraerapp.roles", JSON.stringify(user.roles || []));
  },
  setGame(session) {
    localStorage.setItem("fraerapp.sessionId", session.sessionId);
    localStorage.setItem("fraerapp.storyKey", session.story.key);
  },
  setLanguage(language) {
    localStorage.setItem("fraerapp.language", language);
  },
  setVolume(volume) {
    localStorage.setItem("fraerapp.volume", String(volume));
  },
  acceptCookies() {
    localStorage.setItem("fraerapp.cookieConsent", "accepted");
  },
  dismissPasskeyNudge() {
    localStorage.setItem("fraerapp.passkeyNudgeDismissed", "true");
  },
  clearGame() {
    localStorage.removeItem("fraerapp.sessionId");
    localStorage.removeItem("fraerapp.storyKey");
  },
  clear() {
    this.clearGame();
    localStorage.removeItem("fraerapp.email");
    localStorage.removeItem("fraerapp.roles");
  },
};

let sound = null;
let soundRequested = false;
let soundUnavailableReason = "";
let soundVolume = clamp(Number.isFinite(storage.volume) ? storage.volume : 45, 0, 100);
let lastImportedStoryId = null;
let currentLanguage = storage.language;
let currentState = null;
let catalogStories = [];
let catalogPage = 1;
let choiceInFlight = false;
let telegramBotUrl = "";
let builderButton = null;
let adminButton = null;
let homeCarouselIndex = 0;

const storiesPerPage = 4;

const api = {
  loginLink(email, consent) {
    return request("/auth/login-link", {
      method: "POST",
      body: { email, redirectPath: "/", personalDataConsent: consent },
    });
  },
  verify(token) {
    return request("/auth/verify", { method: "POST", body: { token } });
  },
  me() {
    return request("/auth/me");
  },
  logout() {
    return request("/auth/logout", { method: "POST" });
  },
  passkeyAuthenticationOptions() {
    return request("/auth/passkeys/authentication/options", { method: "POST" });
  },
  telegramLogin() {
    return request("/auth/telegram/login");
  },
  passkeyAuthenticationVerify(challengeId, credential) {
    return request("/auth/passkeys/authentication/verify", {
      method: "POST",
      body: { challengeId, credential },
    });
  },
  passkeyRegistrationOptions() {
    return request("/auth/passkeys/registration/options", { method: "POST" });
  },
  passkeyRegistrationVerify(challengeId, displayName, credential) {
    return request("/auth/passkeys/registration/verify", {
      method: "POST",
      body: { challengeId, displayName, credential },
    });
  },
  passkeys() {
    return request("/auth/passkeys");
  },
  deletePasskey(credentialId) {
    return request(`/auth/passkeys/${encodeURIComponent(credentialId)}`, { method: "DELETE" });
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
  importStory(rawJson) {
    return request("/api/admin/stories/import", { method: "POST", rawBody: rawJson });
  },
  publishStory(storyId) {
    return request(`/api/admin/stories/${storyId}/publish`, { method: "POST" });
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
  syncRoleActionButtons();
  renderHomeCarousel();
}

function updateLanguageButtons() {
  langRuButton.classList.toggle("is-active", currentLanguage === "ru");
  langEnButton.classList.toggle("is-active", currentLanguage === "en");
  modalLangRuButton.classList.toggle("is-active", currentLanguage === "ru");
  modalLangEnButton.classList.toggle("is-active", currentLanguage === "en");
}

function setLanguage(language) {
  currentLanguage = language === "en" ? "en" : "ru";
  storage.setLanguage(currentLanguage);
  applyTranslations();
  updateSoundLabel();
  if (currentState) {
    render(currentState);
  } else if (!storyScreen.classList.contains("hidden") && catalogStories.length > 0) {
    renderStoryPage();
  } else {
    setStatus(t("loading"));
  }
}

async function request(path, options = {}) {
  return requestAttempt(path, options, true);
}

async function requestAttempt(path, options, allowRefresh) {
  const headers = { Accept: "application/json" };
  if (options.body || options.rawBody) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    credentials: "include",
    body: options.rawBody || (options.body ? JSON.stringify(options.body) : undefined),
  });
  if (response.status === 401 && allowRefresh && shouldRefreshAuth(path)) {
    const refreshed = await fetch("/auth/refresh", {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    if (refreshed.ok) {
      return requestAttempt(path, options, false);
    }
  }
  const responseText = await response.text();
  let payload = {};
  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = { message: responseText.replace(/\s+/g, " ").trim() };
    }
  }
  if (!response.ok) {
    throw new Error(payload.message || payload.detail || `HTTP ${response.status}`);
  }
  return payload;
}

function shouldRefreshAuth(path) {
  return !String(path).startsWith("/auth/login-link")
    && !String(path).startsWith("/auth/verify")
    && !String(path).startsWith("/auth/refresh")
    && !String(path).startsWith("/auth/passkeys/authentication");
}

function showOnly(screen) {
  authLoadingScreen.classList.toggle("hidden", screen !== authLoadingScreen);
  loginScreen.classList.toggle("hidden", screen !== loginScreen);
  storyScreen.classList.toggle("hidden", screen !== storyScreen);
  settingsScreen.classList.toggle("hidden", screen !== settingsScreen);
  sceneScreen.classList.toggle("hidden", screen !== sceneScreen);
  document.body.classList.toggle("is-public-home", screen === loginScreen);
  updateTopActions(screen);
}

function updateTopActions(screen) {
  const loggedIn = Boolean(storage.email);
  const roles = storage.roles;
  const inScene = screen === sceneScreen;
  document.body.classList.toggle("is-authenticated", loggedIn);
  syncRoleActionButtons();
  menuButton.classList.toggle("hidden", !loggedIn || screen === storyScreen);
  settingsButton.classList.toggle("hidden", !loggedIn || screen === settingsScreen);
  homeSearchButton.classList.toggle("hidden", !loggedIn);
  homeProfileButton.classList.toggle("is-guest", !loggedIn);
  builderButton?.classList.toggle("hidden", !loggedIn || !hasAnyRole(roles, ["author", "admin"]));
  adminButton?.classList.toggle("hidden", !loggedIn || !hasRole(roles, "admin"));
  soundControl.classList.toggle("hidden", !inScene);
  logoutButton.classList.toggle("hidden", !loggedIn);
}

function hasRole(roles, role) {
  return Array.isArray(roles) && roles.includes(role);
}

function hasAnyRole(roles, allowed) {
  return allowed.some((role) => hasRole(roles, role));
}

function syncRoleActionButtons() {
  const roles = storage.roles;
  builderButton = syncRoleActionButton(
    builderButton,
    hasAnyRole(roles, ["author", "admin"]),
    "builder-button",
    "builderButton",
    () => {
      window.location.href = "/builder/";
    },
  );
  adminButton = syncRoleActionButton(
    adminButton,
    hasRole(roles, "admin"),
    "admin-button",
    "adminButton",
    () => {
      window.location.href = "/auth/admin";
    },
  );
}

function syncRoleActionButton(current, shouldExist, id, i18nKey, onClick) {
  if (!shouldExist) {
    current?.remove();
    return null;
  }
  if (current) {
    current.textContent = t(i18nKey);
    return current;
  }
  const button = document.createElement("button");
  button.id = id;
  button.type = "button";
  button.className = "secondary hidden";
  button.dataset.i18n = i18nKey;
  button.textContent = t(i18nKey);
  button.addEventListener("click", onClick);
  topSessionGroup.insertBefore(button, logoutButton);
  return button;
}

function setStatus(message) {
  status.textContent = message;
}

function setLoginStatus(message, tone = "info") {
  loginStatus.replaceChildren();
  loginStatus.textContent = message;
  loginStatus.dataset.tone = tone;
  delete loginStatus.dataset.kind;
}

function showInvalidLoginLink(message) {
  loginStatus.replaceChildren();
  loginStatus.dataset.tone = "error";
  loginStatus.dataset.kind = "invalid-link";
  const text = document.createElement("span");
  text.textContent = message || t("loginLinkInvalid");
  const action = document.createElement("button");
  action.type = "button";
  action.className = "secondary";
  action.textContent = t("loginLinkInvalidAction");
  action.addEventListener("click", () => {
    setLoginStatus("");
    if (telegramBotUrl) {
      window.open(telegramBotUrl, "_blank", "noopener");
      setLoginStatus(t("loginLinkSent"));
      return;
    }
    telegramLoginButton.focus();
  });
  loginStatus.append(text, action);
}

function updateConsentState({ showError = false } = {}) {
  const accepted = personalDataConsent.checked;
  loginForm.classList.toggle("consent-missing", showError && !accepted);
  consentHint.dataset.tone = showError && !accepted ? "error" : "info";
  return accepted;
}

async function showLoginLinkResult(email) {
  loginStatus.replaceChildren();
  loginStatus.dataset.tone = "success";
  const sent = document.createElement("span");
  sent.textContent = t("loginLinkSent");
  const spamHint = document.createElement("span");
  spamHint.className = "mail-hint";
  spamHint.textContent = t("loginSpamHint");
  loginStatus.append(sent, spamHint);
  try {
    const dev = await request(`/auth/dev/magic-links?email=${encodeURIComponent(email)}`);
    const link = dev.links?.[0]?.link;
    if (!link) return;
    const token = new URL(link).searchParams.get("auth_token");
    if (token) {
      setLoginStatus(t("loading"), "success");
      const result = await api.verify(token);
      storage.setUser(result.user);
      window.history.replaceState({}, document.title, result.redirectPath || "/");
      await afterLogin();
      return;
    }
    loginStatus.replaceChildren();
    const hint = document.createElement("span");
    hint.textContent = t("loginDevHint");
    const action = document.createElement("a");
    action.href = link;
    action.textContent = t("loginDevLink");
    loginStatus.append(hint, action);
  } catch {
    // Production hides the dev magic-link endpoint; the email message is enough.
  }
}

async function afterLogin() {
  closeModals();
  const passkeyItems = await loadPasskeys().catch((error) => {
    passkeyStatus.textContent = t("errorPrefix", { message: error.message });
    passkeyStatus.dataset.tone = "error";
    return [];
  });
  updatePasskeyNudge(passkeyItems);
  if (storage.sessionId) {
    try {
      render(await api.state(storage.sessionId));
      return;
    } catch (error) {
      storage.clearGame();
    }
  }

  renderStories(await api.stories());
}

async function signInWithPasskey() {
  if (!passkeysSupported()) {
    throw new Error(t("passkeyUnavailable"));
  }
  const options = await api.passkeyAuthenticationOptions();
  const credential = await navigator.credentials.get({
    publicKey: parseRequestOptions(options.publicKey),
  });
  if (!credential) {
    throw new Error("Passkey credential was not returned");
  }
  const result = await api.passkeyAuthenticationVerify(options.challengeId, credentialToJson(credential));
  storage.setUser(result.user);
  await afterLogin();
}

async function initTelegramLogin() {
  try {
    const config = await api.telegramLogin();
    telegramBotUrl = config.enabled ? config.botUrl || "" : "";
    telegramLoginButton.classList.toggle("hidden", !telegramBotUrl);
  } catch (error) {
    telegramBotUrl = "";
    telegramLoginButton.classList.add("hidden");
  }
}

async function registerPasskey() {
  if (!passkeysSupported()) {
    throw new Error(t("passkeyUnavailable"));
  }
  const options = await api.passkeyRegistrationOptions();
  const credential = await navigator.credentials.create({
    publicKey: parseCreationOptions(options.publicKey),
  });
  if (!credential) {
    throw new Error("Passkey credential was not returned");
  }
  await api.passkeyRegistrationVerify(
    options.challengeId,
    passkeyName.value.trim(),
    credentialToJson(credential),
  );
  passkeyName.value = "";
  passkeyStatus.textContent = t("passkeyRegistered");
  passkeyStatus.dataset.tone = "success";
  const items = await loadPasskeys();
  updatePasskeyNudge(items);
}

function passkeyRegistrationErrorMessage(error) {
  if (error.message === "Recent authentication required") {
    return t("passkeyRecentAuthRequired");
  }
  return passkeyErrorMessage(error, "passkeyRegistrationFailed");
}

function passkeyLoginErrorMessage(error) {
  return passkeyErrorMessage(error, "passkeyLoginFailed");
}

function passkeyErrorMessage(error, fallbackKey) {
  if (isPasskeyNotAllowedError(error)) {
    return t("passkeyNotAllowed");
  }
  if (error?.name === "InvalidStateError") {
    return t("passkeyAlreadyRegistered");
  }
  if (String(error?.message || "").includes("Passkey credential was not returned")) {
    return t("passkeyCredentialMissing");
  }
  return t(fallbackKey, { message: error?.message || t("passkeyCredentialMissing") });
}

function isPasskeyNotAllowedError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.name === "NotAllowedError"
    || message.includes("not allowed")
    || message.includes("denied permission")
    || message.includes("current context")
    || message.includes("operation either timed out")
    || message.includes("user denied");
}

async function loadPasskeys() {
  const response = await api.passkeys();
  const items = response.passkeys || [];
  renderPasskeys(items);
  return items;
}

function renderPasskeys(passkeys) {
  passkeyList.replaceChildren();
  if (!passkeys.length) {
    const empty = document.createElement("p");
    empty.textContent = t("passkeyEmpty");
    passkeyList.append(empty);
    return;
  }
  for (const passkey of passkeys) {
    const item = document.createElement("article");
    item.className = "passkey-item";
    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = passkey.displayName;
    const meta = document.createElement("small");
    const created = formatPasskeyDate(passkey.createdAt);
    const used = passkey.lastUsedAt ? ` · ${t("passkeyLastUsed", { date: formatPasskeyDate(passkey.lastUsedAt) })}` : "";
    meta.textContent = `${passkey.backupEligible ? t("passkeySynced") : t("passkeyLocal")} · ${t("passkeyCreated", { date: created })}${used}`;
    details.append(name, meta);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary";
    remove.textContent = t("passkeyDelete");
    remove.addEventListener("click", async () => {
      remove.disabled = true;
      try {
        await api.deletePasskey(passkey.credentialId);
        passkeyStatus.textContent = t("passkeyDeleted");
        passkeyStatus.dataset.tone = "success";
        await loadPasskeys();
      } catch (error) {
        passkeyStatus.textContent = t("errorPrefix", { message: error.message });
        passkeyStatus.dataset.tone = "error";
        remove.disabled = false;
      }
    });
    item.append(details, remove);
    passkeyList.append(item);
  }
}

function formatPasskeyDate(value) {
  return new Intl.DateTimeFormat(currentLanguage === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function renderStories(stories) {
  catalogStories = Array.isArray(stories) ? stories : [];
  catalogPage = 1;
  renderStoryPage();
}

async function startStory(storyKey) {
  if (!confirm(t("newRunConfirm"))) {
    return;
  }
  stopSound({ resetPreference: true });
  const session = await api.createSession(storyKey);
  storage.setGame(session);
  render(session);
}

async function continueStory(sessionId) {
  stopSound({ resetPreference: true });
  const state = await api.state(sessionId);
  storage.setGame(state);
  render(state);
}

async function openStoryMenu() {
  stopSound({ resetPreference: true });
  storage.clearGame();
  currentState = null;
  renderStories(await api.stories());
}

function openSettings() {
  stopSound({ resetPreference: true });
  currentState = null;
  showOnly(settingsScreen);
  loadPasskeys().then(updatePasskeyNudge).catch((error) => {
    passkeyStatus.textContent = t("errorPrefix", { message: error.message });
    passkeyStatus.dataset.tone = "error";
  });
}

function updatePasskeyNudge(passkeys = []) {
  const shouldShow = Boolean(storage.email)
    && passkeysSupported()
    && passkeys.length === 0
    && !storage.passkeyNudgeDismissed;
  passkeyNudge.classList.toggle("hidden", !shouldShow);
}

function openModal(modal) {
  closeModals();
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModals() {
  authModal.classList.add("hidden");
  settingsModal.classList.add("hidden");
  profileModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function openAuthModal() {
  openModal(authModal);
}

function openSettingsModal() {
  openModal(settingsModal);
}

function openProfileModal() {
  if (!storage.email) {
    openAuthModal();
    return;
  }
  profileModalEmail.textContent = storage.email;
  openModal(profileModal);
}

async function showPublicHome() {
  stopSound({ resetPreference: true });
  currentState = null;
  try {
    const stories = await api.stories();
    catalogStories = Array.isArray(stories) ? stories : [];
  } catch {
    catalogStories = [];
  }
  homeCarouselIndex = 0;
  showOnly(loginScreen);
  renderHomeCarousel();
}

function renderHomeCarousel() {
  if (!homeStories) return;
  homeStories.replaceChildren();
  const stories = catalogStories.slice(0, 12);
  if (stories.length === 0) {
    const empty = document.createElement("article");
    empty.className = "home-story-card home-story-empty";
    empty.textContent = t("noStories");
    homeStories.append(empty);
    homePrevButton.disabled = true;
    homeNextButton.disabled = true;
    return;
  }

  homeCarouselIndex = Math.min(Math.max(homeCarouselIndex, 0), stories.length - 1);
  stories.forEach((story, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "home-story-card";
    card.style.setProperty("--story-offset", String(index - homeCarouselIndex));
    const cover = document.createElement("span");
    cover.className = "home-story-cover";
    cover.style.backgroundImage = `url("${storyCoverAsset(story)}")`;
    const title = document.createElement("strong");
    title.textContent = story.title;
    card.append(cover, title);
    card.addEventListener("click", () => {
      if (!storage.email) {
        openAuthModal();
        return;
      }
      const action = story.lastSessionId ? continueStory(story.lastSessionId) : startStory(story.key);
      action.catch((error) => setStatus(t("errorPrefix", { message: error.message })));
    });
    homeStories.append(card);
  });
  homePrevButton.disabled = stories.length <= 1;
  homeNextButton.disabled = stories.length <= 1;
}

function moveHomeCarousel(direction) {
  const stories = catalogStories.slice(0, 12);
  if (stories.length <= 1) return;
  homeCarouselIndex = (homeCarouselIndex + direction + stories.length) % stories.length;
  renderHomeCarousel();
}

function renderGameStats(state) {
  sceneStatsList.replaceChildren();
  const variables = Object.entries(state.statsVariables || {});
  sceneStatsCount.textContent = t("sceneStatsCount", { count: variables.length });

  if (variables.length === 0) {
    const empty = document.createElement("p");
    empty.className = "stats-empty";
    empty.textContent = t("statsEmpty");
    sceneStatsList.append(empty);
    return;
  }

  for (const [name, value] of variables) {
    sceneStatsList.append(variableCard(name, value));
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
    storiesList.append(emptyCatalogMessage(t("noStories")));
    storyPagination.classList.add("hidden");
    return;
  }
  if (filtered.length === 0) {
    storiesList.append(emptyCatalogMessage(t("noSearchResults")));
    storyPagination.classList.add("hidden");
    return;
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / storiesPerPage));
  catalogPage = Math.min(Math.max(catalogPage, 1), pageCount);
  const pageStories = filtered.slice((catalogPage - 1) * storiesPerPage, catalogPage * storiesPerPage);
  for (const story of pageStories) {
    const card = document.createElement("article");
    card.className = "story-card";
    const cover = document.createElement("div");
    cover.className = "story-cover";
    cover.style.backgroundImage = `url("${storyCoverAsset(story)}")`;
    const author = story.authorName ? story.authorName : "";
    const progress = Math.round(story.completionRate ?? 0);
    const titleRow = document.createElement("div");
    titleRow.className = "story-title-row";
    const title = document.createElement("strong");
    title.textContent = story.title;
    const key = document.createElement("span");
    key.className = "story-key";
    key.textContent = author;
    titleRow.append(title, key);

    const description = document.createElement("p");
    description.className = "story-description";
    description.textContent = story.description || story.key;

    const meta = document.createElement("div");
    meta.className = "story-meta";
    meta.append(
      metric(t("storyRuns", { runs: "" }).replace(":", "").trim(), story.totalRuns ?? 0),
      metric(t("finishedRuns", { runs: "" }).replace(":", "").trim(), story.finishedRuns ?? 0),
      metric(t("updatedDate", { date: "" }).replace(":", "").trim(), formatDate(story.updatedAt)),
    );

    const saveContext = document.createElement("p");
    saveContext.className = "save-context";
    saveContext.textContent = story.lastSessionId
      ? `${t("saveScene", { scene: story.lastSceneTitle || story.lastSaveName || story.key })} · ${t("lastPlayedDate", { date: formatDate(story.lastPlayedAt) })}`
      : t("publishedDate", { date: formatDate(story.publishedAt) });

    const progressRow = document.createElement("div");
    progressRow.className = "progress-row";
    const progressLabel = document.createElement("div");
    progressLabel.className = "progress-label";
    const progressText = document.createElement("span");
    progressText.textContent = t("completionPercent", { percent: progress });
    const slotText = document.createElement("strong");
    slotText.textContent = story.lastSaveName || "";
    progressLabel.append(progressText, slotText);
    const track = document.createElement("span");
    track.className = "progress-track";
    track.style.setProperty("--completion-color", completionColor(story.completionRate));
    track.style.setProperty("--completion-width", `${progress}%`);
    progressRow.append(progressLabel, track);
    const actions = document.createElement("div");
    actions.className = "story-actions";
    if (story.lastSessionId) {
      actions.append(actionButton(t("continueButton"), () => continueStory(story.lastSessionId)));
      actions.append(actionButton(t("newRunButton"), () => startStory(story.key), "secondary"));
    } else {
      actions.append(actionButton(t("startButton"), () => startStory(story.key)));
    }
    card.append(cover, titleRow, description, meta, saveContext, progressRow, actions);
    storiesList.append(card);
  }
  storyPagination.classList.toggle("hidden", pageCount <= 1);
  storiesPage.textContent = t("pageLabel", { page: catalogPage, pages: pageCount });
  storiesPrev.disabled = catalogPage <= 1;
  storiesNext.disabled = catalogPage >= pageCount;
}

function storyCoverAsset(story) {
  const explicitCover = story.coverUrl || story.imageUrl || story.backgroundUrl;
  if (explicitCover) {
    return explicitCover;
  }
  const assets = [
    "/assets/platform.svg",
    "/assets/hall.svg",
    "/assets/ticket.svg",
    "/assets/door.svg",
    "/assets/tracks.svg",
    "/assets/signal.svg",
    "/assets/conductor.svg",
  ];
  const source = story.key || story.title || "";
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash + source.charCodeAt(index) * (index + 1)) % assets.length;
  }
  return assets[hash];
}

function metric(label, value) {
  const item = document.createElement("div");
  item.className = "story-metric";
  const labelNode = document.createElement("span");
  labelNode.textContent = label;
  const valueNode = document.createElement("strong");
  valueNode.textContent = String(value);
  item.append(labelNode, valueNode);
  return item;
}

function emptyCatalogMessage(message) {
  const item = document.createElement("article");
  item.className = "story-card catalog-empty";
  const title = document.createElement("strong");
  title.textContent = message;
  const description = document.createElement("p");
  description.className = "story-description";
  description.textContent = currentLanguage === "en"
    ? "New published stories will appear here automatically."
    : "Новые опубликованные истории появятся здесь автоматически.";
  item.append(title, description);
  return item;
}

function actionButton(label, action, variant = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (variant) {
    button.className = variant;
  }
  button.addEventListener("click", () => {
    action().catch((error) => setStatus(t("errorPrefix", { message: error.message })));
  });
  return button;
}

function sortStories(stories) {
  const sortMode = storySort.value;
  return [...stories].sort((first, second) => {
    if (sortMode === "completion") {
      return compareNumber(second.completionRate, first.completionRate)
        || compareDate(second.lastPlayedAt, first.lastPlayedAt)
        || compareStoryTitle(first, second);
    }
    if (sortMode === "publishedAt") {
      return compareDate(second.publishedAt, first.publishedAt)
        || compareDate(second.updatedAt, first.updatedAt)
        || compareStoryTitle(first, second);
    }
    if (sortMode === "updatedAt") {
      return compareDate(second.updatedAt, first.updatedAt)
        || compareDate(second.publishedAt, first.publishedAt)
        || compareStoryTitle(first, second);
    }
    return compareDate(second.lastPlayedAt, first.lastPlayedAt)
      || compareDate(second.updatedAt, first.updatedAt)
      || compareDate(second.publishedAt, first.publishedAt)
      || compareStoryTitle(first, second);
  });
}

function compareNumber(first, second) {
  return Number(first ?? -1) - Number(second ?? -1);
}

function compareDate(first, second) {
  return dateValue(first) - dateValue(second);
}

function compareStoryTitle(first, second) {
  return String(first.title || first.key || "").localeCompare(String(second.title || second.key || ""), currentLanguage);
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

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max);
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
  releaseChoices();
  const scene = state.scene;
  showOnly(sceneScreen);
  playerName.textContent = storage.email || "";
  sceneNode.textContent = state.story.authorName ? state.story.authorName : state.story.title;
  sceneTitle.textContent = scene.title;
  sceneText.textContent = scene.text;
  renderGameStats(state);
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
    if (!choice.id) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = false;
    button.textContent = choice.label;
    button.addEventListener("click", () => withChoiceBusy(button, async () => {
      render(await api.choice(state.sessionId, choice.id));
    }));
    choices.append(button);
  }
  releaseChoices();

  setStatus(state.status === "finished" ? t("sessionFinished") : t("progressSaved"));
  if (state.status === "finished") {
    stopSound({ resetPreference: true });
  } else {
    syncSoundToScene();
  }
}

function setChoicesBusy(busy) {
  choices.classList.toggle("choices-busy", busy);
  choices.toggleAttribute("aria-busy", busy);
  choices.querySelectorAll("button").forEach((choiceButton) => {
    choiceButton.disabled = busy;
  });
}

function releaseChoices() {
  choiceInFlight = false;
  choices.classList.remove("choices-busy");
  choices.removeAttribute("aria-busy");
  choices.querySelectorAll("button").forEach((choiceButton) => {
    choiceButton.disabled = false;
    choiceButton.classList.remove("choice-selected");
  });
}

async function withChoiceBusy(button, action) {
  if (choiceInFlight) {
    return;
  }
  choiceInFlight = true;
  try {
    setChoicesBusy(true);
    button.classList.add("choice-selected");
    setStatus(t("loading"));
    await action();
  } catch (error) {
    setStatus(t("errorPrefix", { message: error.message }));
  } finally {
    releaseChoices();
  }
}

function updateSoundLabel() {
  const state = soundRequested ? "on" : "off";
  soundToggle.dataset.soundState = state;
  soundToggle.textContent = t(soundRequested ? "soundOn" : "soundOff");
  volumeSlider.value = String(soundVolume);
  volumeSlider.style.setProperty("--volume-level", `${soundVolume}%`);
}

function stopSound({ resetPreference = false } = {}) {
  if (resetPreference) {
    soundRequested = false;
  }
  if (sound) {
    sound.stop();
  }
  updateSoundLabel();
}

function syncSoundToScene() {
  if (!soundRequested || !sound || !currentState) {
    return;
  }
  sound.setVolume(soundVolume / 100);
  sound.start(currentState.scene.musicUrl).catch((error) => {
    stopSound({ resetPreference: true });
    setStatus(t("errorPrefix", { message: error.message }));
  });
}

function createSound() {
  if (typeof Audio === "undefined") {
    soundUnavailableReason = t("webAudioUnsupported");
    return null;
  }
  const audio = new Audio();
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = soundVolume / 100;
  let currentUrl = "";
  return {
    async start(url) {
      if (!url) {
        audio.pause();
        audio.removeAttribute("src");
        currentUrl = "";
        return;
      }
      if (currentUrl !== url) {
        audio.pause();
        audio.src = url;
        currentUrl = url;
      }
      if (!audio.paused) {
        return;
      }
      await audio.play();
    },
    stop() {
      audio.pause();
    },
    setVolume(volume) {
      audio.volume = clamp(volume, 0, 1);
    },
  };
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = usernameInput.value.trim();
  if (!email) {
    return;
  }
  if (!updateConsentState({ showError: true })) {
    setLoginStatus(t("personalDataConsentRequired"), "error");
    loginStatus.dataset.kind = "consent";
    personalDataConsent.focus();
    return;
  }
  const submitButton = loginForm.querySelector("button[type='submit']");
  try {
    if (submitButton) {
      submitButton.disabled = true;
    }
    setLoginStatus(t("loading"));
    await api.loginLink(email, personalDataConsent.checked);
    await showLoginLinkResult(email);
  } catch (error) {
    const endpointHint = location.port === "4173" ? ` ${t("loginEndpointHint")}` : "";
    setLoginStatus(`${t("loginFailed", { message: error.message })}${endpointHint}`, "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
});

personalDataConsent.addEventListener("change", () => {
  updateConsentState({ showError: false });
  if (personalDataConsent.checked && loginStatus.dataset.kind === "consent") {
    setLoginStatus("");
  }
});

passkeyLoginButton.addEventListener("click", async () => {
  if (!passkeysSupported()) {
    updatePasskeyAvailability();
    return;
  }
  try {
    passkeyLoginButton.disabled = true;
    setLoginStatus(t("loading"));
    await signInWithPasskey();
  } catch (error) {
    setLoginStatus(passkeyLoginErrorMessage(error), "error");
  } finally {
    passkeyLoginButton.disabled = false;
  }
});

telegramLoginButton.addEventListener("click", () => {
  if (!telegramBotUrl) {
    setLoginStatus(t("telegramLoginUnavailable"), "error");
    return;
  }
  window.open(telegramBotUrl, "_blank", "noopener");
  setLoginStatus(t("loginLinkSent"));
});

passkeyRegisterButton.addEventListener("click", async () => {
  try {
    passkeyRegisterButton.disabled = true;
    passkeyStatus.textContent = t("loading");
    passkeyStatus.dataset.tone = "info";
    await registerPasskey();
  } catch (error) {
    passkeyStatus.textContent = passkeyRegistrationErrorMessage(error);
    passkeyStatus.dataset.tone = "error";
  } finally {
    passkeyRegisterButton.disabled = false;
  }
});

menuButton.addEventListener("click", () => {
  openStoryMenu().catch((error) => setStatus(t("errorPrefix", { message: error.message })));
});

settingsButton.addEventListener("click", () => {
  openSettings();
});

logoutButton.addEventListener("click", async () => {
  stopSound({ resetPreference: true });
  try {
    await api.logout();
  } catch (error) {
    setStatus(t("errorPrefix", { message: error.message }));
  }
  storage.clear();
  currentState = null;
  passkeyNudge.classList.add("hidden");
  showPublicHome();
});

soundToggle.addEventListener("click", async () => {
  if (!sound) {
    sound = createSound();
  }
  if (!sound) {
    setStatus(soundUnavailableReason || t("webAudioUnsupported"));
    return;
  }
  if (soundRequested) {
    stopSound({ resetPreference: true });
    return;
  }
  try {
    soundRequested = true;
    sound.setVolume(soundVolume / 100);
    await sound.start(currentState?.scene?.musicUrl);
    updateSoundLabel();
  } catch (error) {
    stopSound({ resetPreference: true });
    setStatus(t("errorPrefix", { message: error.message }));
  }
});

volumeSlider.addEventListener("input", () => {
  soundVolume = clamp(Number(volumeSlider.value), 0, 100);
  storage.setVolume(soundVolume);
  updateSoundLabel();
  if (sound) {
    sound.setVolume(soundVolume / 100);
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

cookieAccept.addEventListener("click", () => {
  storage.acceptCookies();
  cookieBanner.classList.add("hidden");
});

passkeyNudgeOpen.addEventListener("click", () => {
  openSettings();
});

passkeyNudgeDismiss.addEventListener("click", () => {
  storage.dismissPasskeyNudge();
  passkeyNudge.classList.add("hidden");
});

homeReadButton.addEventListener("click", () => {
  document.querySelector(".home-carousel")?.scrollIntoView({ behavior: "smooth", block: "center" });
});

homeCreateButton.addEventListener("click", () => {
  if (hasAnyRole(storage.roles, ["author", "admin"])) {
    window.location.href = "/builder/";
    return;
  }
  openAuthModal();
});

homeSearchButton.addEventListener("click", () => {
  if (storage.email) {
    openStoryMenu().catch((error) => setStatus(t("errorPrefix", { message: error.message })));
  }
});

homeSettingsButton.addEventListener("click", openSettingsModal);
homeProfileButton.addEventListener("click", openProfileModal);
homePrevButton.addEventListener("click", () => moveHomeCarousel(-1));
homeNextButton.addEventListener("click", () => moveHomeCarousel(1));
authModalClose.addEventListener("click", closeModals);
settingsModalClose.addEventListener("click", closeModals);
profileModalClose.addEventListener("click", closeModals);
document.querySelectorAll("[data-modal-close]").forEach((node) => {
  node.addEventListener("click", closeModals);
});
modalLangRuButton.addEventListener("click", () => setLanguage("ru"));
modalLangEnButton.addEventListener("click", () => setLanguage("en"));
profileLogoutButton.addEventListener("click", async () => {
  try {
    await api.logout();
  } catch (error) {
    setStatus(t("errorPrefix", { message: error.message }));
  }
  storage.clear();
  closeModals();
  passkeyNudge.classList.add("hidden");
  showPublicHome();
});

function initCookieBanner() {
  cookieBanner.classList.toggle("hidden", storage.cookieConsent === "accepted");
}

function updatePasskeyAvailability() {
  const supported = passkeysSupported();
  passkeyLoginButton.classList.toggle("hidden", !supported);
  passkeyLoginButton.disabled = !supported;
  passkeyRegisterButton.disabled = !supported;
  passkeyUnavailable.classList.toggle("hidden", supported);
  passkeySettings.classList.toggle("passkey-unavailable", !supported);
}

sound = createSound();
applyTranslations();
updateSoundLabel();
updateConsentState();
initCookieBanner();
updatePasskeyAvailability();
initTelegramLogin();
setStatus(t("loading"));
showOnly(authLoadingScreen);
const authToken = new URLSearchParams(window.location.search).get("auth_token");
if (authToken) {
  api.verify(authToken)
    .then((result) => {
      storage.setUser(result.user);
      window.history.replaceState({}, document.title, result.redirectPath || "/");
      return afterLogin();
    })
    .catch((error) => {
      storage.clear();
      currentState = null;
      window.history.replaceState({}, document.title, "/");
      showPublicHome();
      showInvalidLoginLink(t("loginLinkInvalid"));
      openAuthModal();
    });
} else {
  api.me()
    .then((user) => {
      storage.setUser(user);
      return afterLogin();
    })
    .catch(() => {
      storage.clear();
      currentState = null;
      showPublicHome();
    });
}
