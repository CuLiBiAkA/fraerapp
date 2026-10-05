import {
  credentialToJson,
  parseCreationOptions,
  parseRequestOptions,
  passkeysSupported,
} from "./passkeys.js";

import { enhanceFilterSelect } from "./filter-select.js?v=1";
import { observeHomeFit } from "./home-fit.js?v=3";
import { createAccountUI } from "./account-ui.js?v=3";

observeHomeFit();

const loginScreen = document.querySelector("#login-screen");
const authLoadingScreen = document.querySelector("#auth-loading-screen");
const storyScreen = document.querySelector("#story-screen");
const storyDetailScreen = document.querySelector("#story-detail-screen");
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
const storyDetailBack = document.querySelector("#story-detail-back");
const storyDetailCover = document.querySelector("#story-detail-cover");
const storyDetailTitle = document.querySelector("#story-detail-title");
const storyDetailDescription = document.querySelector("#story-detail-description");
const storyDetailMeta = document.querySelector("#story-detail-meta");
const storyDetailAction = document.querySelector("#story-detail-action");
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
const homeSearchInput = document.querySelector("#home-search-input");
const catalogSelect = enhanceFilterSelect(storySort);
const homeSearchStatus = document.querySelector("#home-search-status");
const homeSettingsButton = document.querySelector("#home-settings");
const homeProfileButton = document.querySelector("#home-profile");
const homeReadButton = document.querySelector("#home-read");
const homeCreateButton = document.querySelector("#home-create");
const homeStories = document.querySelector("#home-stories");
const homePrevButton = document.querySelector("#home-prev");
const homeNextButton = document.querySelector("#home-next");
const appNotice = document.querySelector("#app-notice");
const appNoticeText = document.querySelector("#app-notice-text");
let modalReturnFocus = null;
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
const modalSoundToggle = document.querySelector("#modal-sound-toggle");
const modalNotificationsToggle = document.querySelector("#modal-notifications-toggle");
const modalSettingsStatus = document.querySelector("#modal-settings-status");
const modalPasskeyButton = document.querySelector("#modal-passkey");

const translations = {
  ru: {
    myStories: "Мои истории", moderationButton: "Модерация",
    viewsLabel: "Просмотры", ratingLabel: "Оценка", rateStory: "Ваша оценка:", noRatings: "Пока нет оценок",
    genreUnknown: "Без жанра", favoritesOnly: "Избранное", addFavorite: "Добавить в избранное", removeFavorite: "Удалить из избранного",
    favoriteGuest: "Чтобы сохранить историю в избранном и легко найти её позже, войдите в аккаунт или зарегистрируйтесь через Telegram.",
    ratingGuest: "Чтобы оценить историю, войдите в аккаунт или зарегистрируйтесь через Telegram.",
    engagementTitle: "Ваши истории", engagementLogin: "Войти или зарегистрироваться",
    engagementFailed: "Не удалось сохранить изменение. Попробуйте ещё раз немного позже.",
    loginEyebrow: "FraerApp Stories",
    authLoadingEyebrow: "FraerApp Stories",
    authLoadingTitle: "Пробуждаем истории…",
    authLoadingText: "Ещё мгновение — и воображение оживёт.",
    loginTitle: "Истории,\nкоторые оживают\nв твоем воображении",
    loginSubtitle: "Читай. Создавай. Твори.",
    homeReadStories: "Читать истории",
    backHome: "← На главную",
    catalogLoadFailed: "Не удалось загрузить истории. Обновите страницу, чтобы повторить попытку.",
    homeCreateStory: "Создать свою",
    homeSearchLabel: "Поиск историй",
    homeAllStories: "Все истории",
    homeDefaultOrder: "По умолчанию",
    homeTitleOrder: "По названию: А–Я",
    homeNewest: "Сначала новые",
    homeUpdated: "Недавно обновлённые",
    homeFound: "Найдено историй: {count}",
    homeNoMatches: "Ничего не найдено. Попробуйте другой запрос.",
    homeSettingsLabel: "Настройки",
    homeProfileGuestLabel: "Войти в профиль",
    homeProfileAccountLabel: "Открыть аккаунт",
    authModalTitle: "Начните знакомство с историей",
    authModalText: "Сейчас вам доступен просмотр карточек историй. После регистрации вы сможете проходить истории, сохранять прогресс и открыть доступ ко всей библиотеке.",
    settingsModalTitle: "Настройки",
    settingsLanguage: "Язык",
    settingsSound: "Звук",
    profileModalTitle: "Аккаунт",
    settingsNotifications: "Уведомления",
    notificationsHint: "Уведомления доступны в личном кабинете. Push-уведомления появятся позже.",
    settingsSupport: "Поддержка",
    settingsPasskey: "Привязать passkey",
    supportSoon: "Контакт поддержки скоро появится здесь.",
    settingsPasskeyFailed: "Не удалось привязать passkey. Попробуйте снова или заново войдите через Telegram.",
    authorAccessRequired: "Чтобы создавать истории, нужно получить права автора. Отправьте заявку — администратор рассмотрит её и откроет доступ к конструктору.",
    demoWelcomeTitle: "Первый шаг в историю",
    demoWelcomeText: "Каждая история начинается с первого шага. Гостям доступны три демоистории — познакомьтесь с миром FraerApp, попробуйте делать выбор и узнайте, как он меняет сюжет. Зарегистрируйтесь, чтобы открыть всю библиотеку и сохранять свой путь.",
    demoWelcomeContinue: "Продолжить", demoWelcomeRegister: "Зарегистрироваться",
    authorRequestTitle: "Создавайте свои истории", becomeAuthor: "Стать автором",
    authorSessionRefreshFailed: "Не удалось обновить права доступа. Войдите снова, чтобы открыть конструктор.",
    authorRequestPending: "Заявка отправлена. Администратор рассмотрит ваш запрос.",
    authorRequestSent: "Заявка отправлена", authorRequestFailed: "Не удалось отправить заявку. Попробуйте ещё раз.",
    ratingSort: "По рейтингу",
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
    telegramLoginUnavailable: "Вход через Telegram временно недоступен. Попробуйте позже.",
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
    passkeyLoginFailed: "Не удалось войти. Попробуйте позже или войдите через Telegram.",
    passkeyLoginFirst: "Сначала войдите через Telegram, затем добавьте passkey в настройках аккаунта.",
    passkeyPreview: "На этом адресе passkey недоступен. Войдите через Telegram — ссылка из бота откроет рабочий сайт, где можно зарегистрироваться.",
    passkeyRegistrationFailed: "Не удалось добавить passkey: {message}",
    passkeyRecentAuthRequired: "Для защиты аккаунта подтвердите вход заново: нажмите «Войти через Telegram» и откройте новую ссылку из бота в этом браузере. Затем нажмите «Привязать passkey» в настройках.",
    passkeyReadyToRegister: "Вход подтверждён. Нажмите «Привязать passkey» и подтвердите создание ключа на устройстве.",
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
    storyScreenEyebrow: "Библиотека историй",
    storyScreenTitle: "Выберите историю",
    storyScreenSubtitle: "Интерактивные истории с сохранением прогресса,\nнесколькими концовками и персональными маршрутами",
    storyDetailEyebrow: "История FraerApp",
    storyDetailBack: "Все истории",
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
    noFavorites: "В избранном пока пусто. Избранных историй не найдено.",
    favoritesSort: "Избранные",
    noFavoriteMatches: "Избранных историй по этим фильтрам не найдено.",
    continueButton: "Продолжить",
    startButton: "Начать",
    newRunButton: "Новая игра",
    newRunConfirm: "Начать новую игру? Текущее сохранение останется в списке, но вы начнете отдельный проход с первой сцены.",
    saveScene: "Сцена: {scene}",
    menuButton: "Истории",
    settingsButton: "Настройки",
    builderButton: "Конструктор",
    profileAdmin: "Администратор",
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
    cookieBannerText: "Cookie используются для входа, сохранения сессии и подсчёта просмотров историй.",
    cookieAccept: "Понятно",
  },
  en: {
    myStories: "My stories", moderationButton: "Moderation",
    viewsLabel: "Views", ratingLabel: "Rating", rateStory: "Your rating:", noRatings: "No ratings yet",
    genreUnknown: "No genre", favoritesOnly: "Favorites", addFavorite: "Add to favorites", removeFavorite: "Remove from favorites",
    favoriteGuest: "Sign in or register through Telegram to save this story to your favorites and find it easily later.",
    ratingGuest: "Sign in or register through Telegram to rate this story.",
    engagementTitle: "Your stories", engagementLogin: "Sign in or register",
    engagementFailed: "Could not save your change. Please try again shortly.",
    loginEyebrow: "FraerApp Stories",
    authLoadingEyebrow: "FraerApp Stories",
    authLoadingTitle: "Awakening stories…",
    authLoadingText: "Just a moment — let your imagination come alive.",
    loginTitle: "Stories,\nthat come alive\nin your imagination",
    loginSubtitle: "Read. Create. Imagine.",
    homeReadStories: "Read stories",
    backHome: "← Home",
    catalogLoadFailed: "Could not load stories. Reload the page to try again.",
    homeCreateStory: "Create yours",
    homeSearchLabel: "Search stories",
    homeAllStories: "All stories",
    homeDefaultOrder: "Default order",
    homeTitleOrder: "Title: A–Z",
    homeNewest: "Newest first",
    homeUpdated: "Recently updated",
    homeFound: "Stories found: {count}",
    homeNoMatches: "No matches. Try another search.",
    homeSettingsLabel: "Settings",
    homeProfileGuestLabel: "Sign in",
    homeProfileAccountLabel: "Open account",
    authModalTitle: "Start exploring the story",
    authModalText: "You can browse story cards now. After sign-in you can play stories, save progress, and access the full library.",
    settingsModalTitle: "Settings",
    settingsLanguage: "Language",
    settingsSound: "Sound",
    profileModalTitle: "Account",
    settingsNotifications: "Notifications",
    notificationsHint: "Notifications are available in your account. Push notifications are coming later.",
    settingsSupport: "Support",
    settingsPasskey: "Add passkey",
    supportSoon: "Support contact details will appear here soon.",
    settingsPasskeyFailed: "Could not add a passkey. Try again or sign in again through Telegram.",
    authorAccessRequired: "To create stories, you need author access. Submit a request and an administrator will review it and enable the builder.",
    demoWelcomeTitle: "Your first step into a story",
    demoWelcomeText: "Every story begins with a first step. Guests can explore three demo stories — discover the world of FraerApp, make choices and see how they shape the plot. Register to unlock the full library and save your journey.",
    demoWelcomeContinue: "Continue", demoWelcomeRegister: "Register",
    authorRequestTitle: "Create your own stories", becomeAuthor: "Become an author",
    authorSessionRefreshFailed: "Could not refresh your access. Sign in again to open the builder.",
    authorRequestPending: "Request sent. An administrator will review it.",
    authorRequestSent: "Request sent", authorRequestFailed: "Could not send your request. Please try again.",
    ratingSort: "Highest rated",
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
    telegramLoginUnavailable: "Telegram sign-in is temporarily unavailable. Please try again later.",
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
    passkeyLoginFailed: "Could not sign in. Try again later or sign in with Telegram.",
    passkeyLoginFirst: "Sign in with Telegram first, then add a passkey in your account settings.",
    passkeyPreview: "Passkeys are unavailable at this address. Sign in with Telegram — the bot's link opens the live website where you can create an account.",
    passkeyRegistrationFailed: "Could not add passkey: {message}",
    passkeyRecentAuthRequired: "To protect your account, confirm sign-in again: choose Sign in with Telegram and open a new link from the bot in this browser. Then choose Add passkey in settings.",
    passkeyReadyToRegister: "Sign-in confirmed. Choose Add passkey and approve key creation on your device.",
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
    storyScreenEyebrow: "Story library",
    storyScreenTitle: "Choose a story",
    storyScreenSubtitle: "Interactive stories with saved progress,\nmultiple endings and personal routes.",
    storyDetailEyebrow: "FraerApp story",
    storyDetailBack: "All stories",
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
    noFavorites: "Your favorites are empty. No favorite stories found.",
    favoritesSort: "Favorites",
    noFavoriteMatches: "No favorite stories match these filters.",
    continueButton: "Continue",
    startButton: "Start",
    newRunButton: "New game",
    newRunConfirm: "Start a new game? Your current save will stay in the list, but this will create a separate run from the first scene.",
    saveScene: "Scene: {scene}",
    menuButton: "Stories",
    settingsButton: "Settings",
    builderButton: "Builder",
    profileAdmin: "Administrator",
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
    cookieBannerText: "Cookies are used for sign-in, session storage, and counting story views.",
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
  async stories() {
    const [stories, metrics] = await Promise.all([
      request("/api/catalog/stories"), request("/api/catalog/engagement"),
    ]);
    const bySlug = new Map(metrics.map((item) => [item.slug, item]));
    return stories.map((story) => ({ ...story, ...bySlug.get(story.slug) }));
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
    if (node.dataset.i18n === "loginTitle") {
      const [display, ...lines] = t("loginTitle").split("\n");
      const first = document.createElement("span");
      first.className = "hero-display";
      first.textContent = display;
      const rest = document.createElement("span");
      rest.className = "hero-heading";
      rest.textContent = lines.join("\n");
      node.replaceChildren(first, rest);
    }
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  updateLanguageButtons();
  catalogSelect.refresh();
  homeSearchInput.setAttribute("aria-label", t("homeSearchLabel"));
  syncRoleActionButtons();
  renderHomeCarousel();
}

function updateLanguageButtons() {
  langRuButton.classList.toggle("is-active", currentLanguage === "ru");
  langEnButton.classList.toggle("is-active", currentLanguage === "en");
  modalLangRuButton.classList.toggle("is-active", currentLanguage === "ru");
  modalLangEnButton.classList.toggle("is-active", currentLanguage === "en");
  modalLangRuButton.setAttribute("aria-pressed", String(currentLanguage === "ru"));
  modalLangEnButton.setAttribute("aria-pressed", String(currentLanguage === "en"));
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
    const error = new Error(payload.message || payload.detail || `HTTP ${response.status}`);
    error.code = payload.code;
    error.status = response.status;
    throw error;
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
  storyDetailScreen.classList.toggle("hidden", screen !== storyDetailScreen);
  document.body.classList.toggle("modal-open", Boolean(document.querySelector(".modal-layer:not(.hidden)")));
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
  homeProfileButton.classList.toggle("is-guest", !loggedIn);
  homeSearchButton.setAttribute("aria-label", t("homeSearchLabel"));
  homeSettingsButton.setAttribute("aria-label", t("homeSettingsLabel"));
  homeProfileButton.setAttribute("aria-label", loggedIn ? t("homeProfileAccountLabel") : t("homeProfileGuestLabel"));
  homeCreateButton.classList.remove("hidden");
  builderButton?.classList.toggle("hidden", !loggedIn || !hasAnyRole(roles, ["author", "admin"]));
  adminButton?.classList.toggle("hidden", !loggedIn || !hasRole(roles, "admin"));
  soundControl.classList.toggle("hidden", !inScene);
  logoutButton.classList.toggle("hidden", !loggedIn);
  storyScreen.classList.toggle("is-guest-catalog", !loggedIn);
  document.querySelector("#home-all-stories").classList.toggle("hidden", !loggedIn);
  accountUI.refresh();
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
  if (sceneScreen.classList.contains("hidden") && message.startsWith(t("errorPrefix", { message: "" }))) {
    appNoticeText.textContent = message;
    appNotice.classList.remove("hidden");
  }
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
  catalogStories = [];
  closeModals();
  const passkeyItems = await loadPasskeys().catch((error) => {
    passkeyStatus.textContent = t("errorPrefix", { message: error.message });
    passkeyStatus.dataset.tone = "error";
    return [];
  });
  updatePasskeyNudge(passkeyItems);
  await handleRoute();
  resumePasskeyRegistration();
}

function resumePasskeyRegistration() {
  const expiresAt = Number(localStorage.getItem("fraerapp.passkeyRegistrationPending"));
  localStorage.removeItem("fraerapp.passkeyRegistrationPending");
  if (expiresAt > Date.now()) {
    openSettingsModal();
    modalSettingsStatus.textContent = t("passkeyReadyToRegister");
  }
}

function requestPasskeyReauthentication(error) {
  if (error?.message !== "Recent authentication required" && error?.status !== 401) return false;
  localStorage.setItem("fraerapp.passkeyRegistrationPending", String(Date.now() + 30 * 60 * 1000));
  openAuthModal();
  setLoginStatus(t("passkeyRecentAuthRequired"));
  telegramLoginButton.focus();
  return true;
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
  } catch (error) {
    telegramBotUrl = "";
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
  if (error?.code === "AUTH_PREVIEW") return t("passkeyPreview");
  if (error.message === "Recent authentication required") {
    return t("passkeyRecentAuthRequired");
  }
  return passkeyErrorMessage(error, "passkeyRegistrationFailed");
}

function passkeyLoginErrorMessage(error) {
  if (error?.code === "AUTH_PREVIEW") return t("passkeyPreview");
  if (isPasskeyNotAllowedError(error) || error?.message === "Passkey credential was not returned") {
    return t("passkeyLoginFirst");
  }
  return t("passkeyLoginFailed");
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
  return t(fallbackKey, { message: t("settingsPasskeyFailed") });
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

async function ensureCatalogStories() {
  if (catalogStories.length > 0) {
    return catalogStories;
  }
  const stories = await api.stories();
  catalogStories = Array.isArray(stories) ? stories : [];
  return catalogStories;
}

function storyRoute(story) {
  return `/history/${encodeURIComponent(story.slug || story.key)}`;
}

function navigateTo(path, { replace = false } = {}) {
  if (window.location.pathname !== path) {
    const method = replace ? "replaceState" : "pushState";
    const detailFrom = path.startsWith("/history/")
      ? (window.location.pathname.startsWith("/history/") ? window.history.state?.detailFrom : window.location.pathname)
      : undefined;
    window.history[method]({ detailFrom }, document.title, path);
  }
  return handleRoute().catch((error) => setStatus(t("errorPrefix", { message: error.message })));
}

async function handleRoute() {
  closeModals();
  appNotice.classList.add("hidden");
  try {
    const path = normalizePath(window.location.pathname);
    if (path === "/history") {
      if (!storage.email) {
        window.history.replaceState({}, document.title, "/");
        await showPublicHome();
        openAuthModal();
        return;
      }
      await renderHistoryRoute();
      return;
    }
    if (path.startsWith("/history/")) {
      await renderStoryDetailRoute(path.slice("/history/".length));
      return;
    }
    await showPublicHome();
  } catch {
    showOnly(storyScreen);
    storiesList.replaceChildren(emptyCatalogMessage(t("catalogLoadFailed")));
    storyPagination.classList.add("hidden");
  }
}

function normalizePath(path) {
  if (!path || path === "/") {
    return "/";
  }
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

async function renderHistoryRoute() {
  stopSound({ resetPreference: true });
  await ensureCatalogStories();
  catalogPage = 1;
  renderStoryPage();
}

async function renderStoryDetailRoute(rawSlug) {
  stopSound({ resetPreference: true });
  const slug = decodeURIComponent(rawSlug || "");
  const stories = await ensureCatalogStories();
  const catalogStory = stories.find((item) => [item.slug, item.key, item.storyId].includes(slug));
  let story;
  try {
    story = await loadPublicStoryDetail(catalogStory?.slug || slug);
    if (catalogStory) Object.assign(catalogStory, story);
  } catch (error) {
    if (![401, 403, 404].includes(error.status)) throw error;
    await navigateTo(storage.email ? "/history" : "/", { replace: true });
    if (!storage.email) openAuthModal();
    return;
  }
  if (loginScreen.classList.contains("hidden") && storyScreen.classList.contains("hidden")) {
    if (storage.email) await renderHistoryRoute();
    else { showOnly(loginScreen); renderHomeCarousel(); }
  }
  renderStoryDetail(story);
  try {
    await request(`/api/catalog/engagement/${encodeURIComponent(story.slug)}/view`, { method: "POST" });
    await refreshStoryMetrics(story);
    if (window.location.pathname === storyRoute(story)) renderStoryDetail(story);
  } catch { /* Keep the story readable when statistics are temporarily unavailable. */ }
}

async function loadPublicStoryDetail(slug) {
  // Direct links can refer to unlisted publications. Never insert them into the catalogue.
  const story = await request(`/api/catalog/stories/${encodeURIComponent(slug)}`);
  const [metrics, saves] = await Promise.all([
    request(`/api/catalog/engagement/${encodeURIComponent(story.slug)}`),
    storage.email ? request(`/api/stories/${encodeURIComponent(story.key)}/sessions`) : Promise.resolve([]),
  ]);
  const latest = saves[0];
  return { ...story, ...metrics,
    lastSessionId: latest?.sessionId || null, lastSessionStatus: latest?.status || null,
    lastSaveName: latest?.saveName || null, lastSceneTitle: latest?.sceneTitle || null,
    lastPlayedAt: latest?.updatedAt || null, completionRate: latest?.completionRate || 0,
  };
}

async function refreshStoryMetrics(story) {
  const metrics = await request(`/api/catalog/engagement/${encodeURIComponent(story.slug)}`);
  Object.assign(story, metrics);
  const listed = catalogStories.find(entry => entry.slug === story.slug);
  if (listed) Object.assign(listed, metrics);
}

function renderStoryDetail(story) {
  document.querySelector("#story-interaction-status").textContent = "";
  const opening = storyDetailScreen.classList.contains("hidden");
  if (opening) storyDetailReturnFocus = document.activeElement;
  storyDetailScreen.classList.remove("hidden");
  document.body.classList.add("modal-open");
  if (opening) storyDetailBack.focus();
  storyDetailCover.style.backgroundImage = `url("${storyCoverAsset(story)}")`;
  storyDetailTitle.textContent = story.title;
  storyDetailDescription.textContent = story.description || story.key;
  const completionLabels = currentLanguage === "en"
    ? { completed: "Completed", in_development: "In development", abandoned: "On hold" }
    : { completed: "Завершена", in_development: "В разработке", abandoned: "Приостановлено" };
  const completionBadge = document.querySelector("#story-detail-status");
  completionBadge.textContent = completionLabels[story.completionStatus] || "";
  completionBadge.classList.toggle("hidden", !completionBadge.textContent);
  const discovered = Math.min(story.endingCount ?? 0, story.discoveredEndings ?? 0);
  const completed = discovered > 0 || story.lastSessionStatus === "finished";
  const progress = completed ? 100 : Math.min(99, Math.max(0, Math.round(story.completionRate || 0)));
  document.querySelector("#story-reader-progress").classList.toggle("hidden", story.completionStatus !== "completed");
  document.querySelector("#story-reader-progress-bar").value = progress;
  document.querySelector("#story-reader-progress-label").textContent = currentLanguage === "en"
    ? `Your progress: ${progress > 0 && progress < 100 ? "≈ " : ""}${progress}%`
    : `Ваш прогресс: ${progress > 0 && progress < 100 ? "≈ " : ""}${progress}%`;
  document.querySelector("#story-detail-favorite").replaceChildren(favoriteButton(story));
  storyDetailMeta.replaceChildren(
    metric(t("viewsLabel"), story.views ?? 0),
    metric(t("ratingLabel"), story.rating == null ? "—" : story.rating.toFixed(1)),
    metric(currentLanguage === "en" ? "Endings discovered" : "Пройдено концовок", `${discovered} ${currentLanguage === "en" ? "of" : "из"} ${story.endingCount ?? "—"}`),
    metric(t("publishedDate", { date: "" }).replace(":", "").trim(), formatDate(story.publishedAt)),
  );
  const interactions = document.querySelector("#story-interactions");
  interactions.replaceChildren();
  const ratingLabel = document.createElement("span");
  ratingLabel.textContent = t("rateStory");
  interactions.append(ratingLabel);
  for (let score = 1; score <= 5; score++) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = score <= (story.myRating || 0) ? "★" : "☆";
    button.setAttribute("aria-label", `${t("ratingLabel")}: ${score} / 5`);
    button.setAttribute("aria-pressed", String(story.myRating === score));
    button.onclick = async () => {
      if (!storage.email) return openEngagementLogin("ratingGuest");
      interactions.querySelectorAll("button").forEach((item) => item.disabled = true);
      try {
        await request(`/api/catalog/engagement/${encodeURIComponent(story.slug)}/rating`, { method: "PUT", body: { score } });
        await refreshStoryMetrics(story);
        if (window.location.pathname === storyRoute(story)) renderStoryDetail(story);
      } catch (error) {
        if (error.status === 401) openEngagementLogin("ratingGuest");
        else document.querySelector("#story-interaction-status").textContent = t("engagementFailed");
      } finally { interactions.querySelectorAll("button").forEach((item) => item.disabled = false); }
    };
    interactions.append(button);
  }
  const canContinue = story.lastSessionId && story.lastSessionStatus !== "finished";
  const restartLabel = currentLanguage === "en" ? "Start again" : "Начать сначала";
  storyDetailAction.textContent = canContinue ? t("continueButton") : completed ? restartLabel : t("startButton");
  storyDetailAction.onclick = () => {
    if (!storage.email) {
      openAuthModal();
      return;
    }
    const action = canContinue ? continueStory(story.lastSessionId) : startStoryRun(story.key);
    action.catch((error) => setStatus(t("errorPrefix", { message: error.message })));
  };
  const restartButton = document.querySelector("#story-detail-restart");
  restartButton.textContent = restartLabel;
  restartButton.classList.toggle("hidden", !canContinue);
  restartButton.onclick = () => {
    if (!storage.email) return openAuthModal();
    startStoryRun(story.key).catch((error) => setStatus(t("errorPrefix", { message: error.message })));
  };
  if (opening && !storage.email) {
    openModal(document.querySelector("#demo-welcome-modal"));
    storyDetailScreen.inert = true;
  }
}

async function startStory(storyKey) {
  return startStoryRun(storyKey, { confirmNewRun: true });
}

async function startStoryRun(storyKey, { confirmNewRun = false } = {}) {
  if (confirmNewRun && !confirm(t("newRunConfirm"))) {
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
  const returnFocus = document.activeElement;
  closeModals();
  modalReturnFocus = returnFocus;
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  modal.querySelector("button:not([disabled]), a[href], input:not([disabled])")?.focus();
}

function closeModals() {
  document.querySelector("#demo-welcome-modal").classList.add("hidden");
  storyDetailScreen.inert = false;
  document.querySelector("#author-request-modal").classList.add("hidden");
  document.querySelector("#engagement-modal").classList.add("hidden");
  authModal.classList.add("hidden");
  settingsModal.classList.add("hidden");
  profileModal.classList.add("hidden");
  document.body.classList.toggle("modal-open", !storyDetailScreen.classList.contains("hidden"));
  if (modalReturnFocus?.isConnected) modalReturnFocus.focus();
  modalReturnFocus = null;
}

function openAuthModal() {
  openModal(authModal);
}

function openSettingsModal() {
  modalNotificationsToggle.setAttribute("aria-checked", String(localStorage.getItem("fraerapp.notifications") === "true"));
  modalSettingsStatus.textContent = "";
  openModal(settingsModal);
}

function openProfileModal() {
  if (!storage.email) {
    openAuthModal();
    return;
  }
  profileModalEmail.textContent = storage.email;
  accountUI.refresh(true);
  document.querySelector("#profile-builder").classList.toggle("hidden", !hasAnyRole(storage.roles, ["author", "admin"]));
  document.querySelector("#profile-moderation").classList.toggle("hidden", !hasAnyRole(storage.roles, ["moderator", "admin"]));
  document.querySelector("#profile-admin").classList.toggle("hidden", !hasRole(storage.roles, "admin"));
  openModal(profileModal);
}

function createHomeStory() {
  if (!storage.email) {
    openAuthModal();
    return;
  }
  if (hasAnyRole(storage.roles, ["author", "admin"])) {
    return openBuilder();
  }
  openAuthorRequestModal();
}

async function openBuilder() {
  try {
    const result = await request("/auth/refresh", { method: "POST" });
    storage.setUser(result.user);
    if (hasAnyRole(storage.roles, ["author", "admin"])) window.location.href = "/builder/";
    else await openAuthorRequestModal();
  } catch {
    openAuthModal();
    setLoginStatus(t("authorSessionRefreshFailed"), "error");
  }
}

async function openAuthorRequestModal() {
  const modal = document.querySelector("#author-request-modal");
  const button = document.querySelector("#author-request-submit");
  const status = document.querySelector("#author-request-status");
  openModal(modal);
  button.disabled = true;
  button.textContent = t("becomeAuthor");
  status.textContent = "";
  try {
    const result = await request("/auth/author-request");
    if (result.status === "granted") {
      await openBuilder();
      return;
    }
    button.disabled = result.status === "pending";
    if (result.status === "pending") { button.textContent = t("authorRequestSent"); status.textContent = t("authorRequestPending"); }
  } catch { button.disabled = false; status.textContent = t("authorRequestFailed"); }
}

async function showPublicHome() {
  stopSound({ resetPreference: true });
  currentState = null;
  try {
    const stories = await api.stories();
    catalogStories = Array.isArray(stories) ? stories : [];
  } catch (error) {
    catalogStories = [];
    setStatus(t("errorPrefix", { message: t("catalogLoadFailed") }));
  }
  homeCarouselIndex = catalogStories.length > 2 ? 1 : 0;
  catalogSelect.refresh();
  showOnly(loginScreen);
  renderHomeCarousel();
}

function getHomeStories() {
  const query = homeSearchInput.value.trim().toLowerCase();
  const demoKeys = ["kak_shodit_v_tualet_pravilno", "kak_pogladit_kota_ne_ubiv", "night_train"];
  const stories = catalogStories.filter((story) => storyMatchesQuery(story, query)
    && (storage.email || demoKeys.includes(story.key)));
  if (storage.email) stories.sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)));
  else stories.sort((a, b) => demoKeys.indexOf(a.key) - demoKeys.indexOf(b.key));
  return stories;
}

function renderHomeCarousel() {
  if (!homeStories) return;
  homeStories.replaceChildren();
  const stories = getHomeStories();
  homeSearchStatus.textContent = homeSearchInput.value.trim()
    ? t("homeFound", { count: stories.length }) : "";
  if (stories.length === 0) {
    const empty = document.createElement("article");
    empty.className = "home-story-card home-story-empty";
    empty.textContent = t(catalogStories.length ? "homeNoMatches" : "noStories");
    homeStories.append(empty);
    homePrevButton.disabled = true;
    homeNextButton.disabled = true;
    return;
  }

  homeCarouselIndex = Math.min(Math.max(homeCarouselIndex, 0), stories.length - 1);
  stories.forEach((story, index) => {
    let offset = (index - homeCarouselIndex + stories.length) % stories.length;
    if (offset > stories.length / 2) offset -= stories.length;
    const card = document.createElement("article");
    card.className = "home-story-card";
    card.dataset.offset = String(offset);
    card.classList.toggle("is-active", offset === 0);
    card.classList.toggle("is-outside-view", Math.abs(offset) > 2);
    card.setAttribute("aria-hidden", String(Math.abs(offset) > 2));
    card.style.setProperty("--story-offset", String(offset));
    fillStoryCard(card, story, "home-story-cover");
    card.querySelectorAll("a, button").forEach((control) => control.tabIndex = offset === 0 ? 0 : -1);
    homeStories.append(card);
  });
  homePrevButton.disabled = stories.length <= 1;
  homeNextButton.disabled = stories.length <= 1;
}

function moveHomeCarousel(direction) {
  const stories = getHomeStories();
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

function favoriteEmptyMessage() {
  return storage.email && catalogStories.some((story) => story.favorite) ? "noFavoriteMatches" : "noFavorites";
}

function renderStoryPage() {
  showOnly(storyScreen);
  storiesList.replaceChildren();
  const query = storySearch.value.trim().toLowerCase();
  const filtered = sortStories(catalogStories.filter((story) => storyMatchesQuery(story, query)
    && (storySort.value !== "favorites" || (storage.email && story.favorite))));
  if (catalogStories.length === 0) {
    storiesList.append(emptyCatalogMessage(t(storySort.value === "favorites" ? favoriteEmptyMessage() : "noStories")));
    storyPagination.classList.add("hidden");
    return;
  }
  if (filtered.length === 0) {
    storiesList.append(emptyCatalogMessage(t(storySort.value === "favorites" ? favoriteEmptyMessage() : "noSearchResults")));
    storyPagination.classList.add("hidden");
    return;
  }

  for (const story of filtered) {
    const card = document.createElement("article");
    card.className = "story-card";
    fillStoryCard(card, story, "story-cover");
    storiesList.append(card);
  }
  storyPagination.classList.add("hidden");
}

function fillStoryCard(card, story, coverClass) {
  card.classList.add("engagement-card");
  const link = document.createElement("a");
  link.href = storyRoute(story);
  link.className = "story-card-link";
  link.setAttribute("aria-label", story.title);
  link.onclick = (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigateTo(storyRoute(story));
  };
  const cover = document.createElement("div");
  cover.className = coverClass;
  cover.style.backgroundImage = `url("${storyCoverAsset(story)}")`;
  const genre = document.createElement("span");
  genre.className = "story-genre";
  genre.textContent = story.genre || t("genreUnknown");
  cover.append(genre);
  const info = document.createElement("div");
  info.className = "story-card-info";
  const title = document.createElement("strong");
  title.textContent = story.title;
  const stats = document.createElement("div");
  stats.className = "story-card-stats";
  const views = document.createElement("span");
  views.textContent = `◉ ${new Intl.NumberFormat(currentLanguage, { notation: "compact", maximumFractionDigits: 1 }).format(story.views ?? 0)}`;
  views.setAttribute("aria-label", `${t("viewsLabel")}: ${story.views ?? 0}`);
  const rating = document.createElement("span");
  rating.textContent = `☆ ${story.rating == null ? "—" : story.rating.toFixed(1)}`;
  rating.setAttribute("aria-label", `${t("ratingLabel")}: ${story.rating == null ? t("noRatings") : story.rating.toFixed(1)}, ${story.ratingCount || 0}`);
  stats.append(views, rating); info.append(title, stats); link.append(cover, info);
  card.append(link, favoriteButton(story));
}

function openEngagementLogin(message) {
  document.querySelector("#engagement-message").textContent = t(message);
  document.querySelector("#engagement-login").hidden = message === "engagementFailed";
  openModal(document.querySelector("#engagement-modal"));
}

let favoriteGradientId = 0;
function favoriteButton(story) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "story-favorite";
  button.dataset.storySlug = story.slug;
  button.setAttribute("aria-label", t(story.favorite ? "removeFavorite" : "addFavorite"));
  button.setAttribute("aria-pressed", String(Boolean(story.favorite)));
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "22"); icon.setAttribute("height", "22");
  icon.setAttribute("aria-hidden", "true");
  const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
  const gradientId = `favorite-gradient-${++favoriteGradientId}`;
  gradient.setAttribute("id", gradientId);
  gradient.setAttribute("x1", "0%"); gradient.setAttribute("y1", "36%");
  gradient.setAttribute("x2", "100%"); gradient.setAttribute("y2", "64%");
  ["#f5a279b8", "#9c6285b8"].forEach((color, index) => {
    const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop.setAttribute("offset", `${index * 100}%`);
    stop.setAttribute("stop-color", color);
    gradient.append(stop);
  });
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.append(gradient);
  icon.append(defs);
  icon.style.setProperty("--favorite-fill", `url(#${gradientId})`);
  const heart = document.createElementNS("http://www.w3.org/2000/svg", "path");
  heart.setAttribute("d", "M12 21 3.4 12.5C-2 7.2 5.1-.8 12 6.2 18.9-.8 26 7.2 20.6 12.5Z");
  icon.append(heart);
  button.append(icon);
  button.onclick = async (event) => {
    event.stopPropagation();
    if (!storage.email) return openEngagementLogin("favoriteGuest");
    button.disabled = true;
    try {
      const result = await request(`/api/catalog/engagement/${encodeURIComponent(story.slug)}/favorite`, { method: "PUT", body: { selected: !story.favorite } });
      story.favorite = result.favorite;
      // Update in place: re-sorting favorites here changes the active carousel card.
      document.querySelectorAll(".story-favorite").forEach((control) => {
        if (control.dataset.storySlug !== story.slug) return;
        control.setAttribute("aria-pressed", String(Boolean(story.favorite)));
        control.setAttribute("aria-label", t(story.favorite ? "removeFavorite" : "addFavorite"));
      });
    } catch (error) {
      openEngagementLogin(error.status === 401 ? "favoriteGuest" : "engagementFailed");
    } finally { button.disabled = false; }
  };
  return button;
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

function actionButton(label, action, variant = "", stopCardClick = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (variant) {
    button.className = variant;
  }
  button.addEventListener("click", (event) => {
    if (stopCardClick) {
      event.stopPropagation();
    }
    Promise.resolve(action()).catch((error) => setStatus(t("errorPrefix", { message: error.message })));
  });
  return button;
}

function sortStories(stories) {
  const sortMode = storySort.value;
  if (sortMode === "default" || sortMode === "favorites") return [...stories].sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)));
  if (sortMode === "title") return [...stories].sort(compareStoryTitle);
  if (sortMode === "rating") return [...stories].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || compareStoryTitle(a, b));
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
  return [story.title, story.key, story.description, story.authorName, story.genre]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function render(state) {
  catalogStories = []; // Reload personal progress and endings when returning from gameplay.
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
  modalSoundToggle.dataset.soundState = state;
  modalSoundToggle.setAttribute("aria-checked", String(soundRequested));
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

async function toggleSoundPreference() {
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
    if (currentState?.scene?.musicUrl) {
      await sound.start(currentState.scene.musicUrl);
    }
    updateSoundLabel();
  } catch (error) {
    stopSound({ resetPreference: true });
    setStatus(t("errorPrefix", { message: error.message }));
  }
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
    requestPasskeyReauthentication(error);
    passkeyStatus.textContent = passkeyRegistrationErrorMessage(error);
    passkeyStatus.dataset.tone = "error";
  } finally {
    passkeyRegisterButton.disabled = false;
  }
});

menuButton.addEventListener("click", () => {
  navigateTo("/history");
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
  await toggleSoundPreference();
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
  if (!storage.email) openAuthModal();
  else navigateTo("/history");
});

homeCreateButton.addEventListener("click", createHomeStory);

function updateHomeSearch() {
  homeCarouselIndex = 0;
  renderHomeCarousel();
}
document.querySelector("#home-search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  homeSearchInput.focus();
  updateHomeSearch();
});
homeSearchInput.addEventListener("input", updateHomeSearch);
document.querySelector("#author-request-submit").addEventListener("click", async () => {
  const button = document.querySelector("#author-request-submit");
  const status = document.querySelector("#author-request-status");
  button.disabled = true;
  try {
    const result = await request("/auth/author-request", { method: "POST" });
    if (result.status === "granted") { await openAuthorRequestModal(); return; }
    button.textContent = t("authorRequestSent");
    status.textContent = t("authorRequestPending");
  } catch { button.disabled = false; status.textContent = t("authorRequestFailed"); }
});

homeSettingsButton.addEventListener("click", openSettingsModal);
document.querySelector("#engagement-close").addEventListener("click", closeModals);
document.querySelector("#engagement-login").addEventListener("click", openAuthModal);
document.querySelector("#profile-favorites").addEventListener("click", () => {
  storySearch.value = "";
  storySort.value = "favorites";
  catalogSelect.refresh();
  closeModals();
  navigateTo("/history");
});
document.querySelector("#library-settings").addEventListener("click", openSettingsModal);
document.querySelector("#library-profile").addEventListener("click", openProfileModal);
homeProfileButton.addEventListener("click", openProfileModal);
document.querySelector("#profile-builder").addEventListener("click", () => {
  if (storage.email && hasAnyRole(storage.roles, ["author", "admin"])) openBuilder();
});
document.querySelector("#profile-my-stories").addEventListener("click", () => {
  if (storage.email) window.location.href = "/my-stories/";
});
document.querySelector("#profile-moderation").addEventListener("click", () => {
  if (storage.email && hasAnyRole(storage.roles, ["moderator", "admin"])) window.location.href = "/moderation/";
});
document.querySelector("#profile-admin").addEventListener("click", () => {
  if (storage.email && hasRole(storage.roles, "admin")) window.location.href = "/auth/admin";
});
homePrevButton.addEventListener("click", () => moveHomeCarousel(-1));
homeNextButton.addEventListener("click", () => moveHomeCarousel(1));
let storyDetailReturnFocus = null;
function closeStoryDetail() {
  const destination = !storage.email || window.history.state?.detailFrom === "/" ? "/" : "/history";
  storyDetailScreen.classList.add("hidden");
  document.body.classList.remove("modal-open");
  window.history.replaceState({}, document.title, destination);
  if (storyDetailReturnFocus?.isConnected) storyDetailReturnFocus.focus();
  storyDetailReturnFocus = null;
}
storyDetailBack.addEventListener("click", closeStoryDetail);
document.querySelector("#story-detail-backdrop").addEventListener("click", closeStoryDetail);
authModalClose.addEventListener("click", closeModals);
settingsModalClose.addEventListener("click", closeModals);
profileModalClose.addEventListener("click", closeModals);
document.querySelectorAll("[data-modal-close]").forEach((node) => {
  node.addEventListener("click", closeModals);
});
document.querySelector("#demo-welcome-register").addEventListener("click", openAuthModal);
function toggleModalLanguage() {
  setLanguage(currentLanguage === "ru" ? "en" : "ru");
}
modalLangRuButton.addEventListener("click", toggleModalLanguage);
modalLangEnButton.addEventListener("click", toggleModalLanguage);
modalSoundToggle.addEventListener("click", () => {
  toggleSoundPreference();
});
modalNotificationsToggle.addEventListener("click", () => {
  const enabled = modalNotificationsToggle.getAttribute("aria-checked") !== "true";
  localStorage.setItem("fraerapp.notifications", String(enabled));
  modalNotificationsToggle.setAttribute("aria-checked", String(enabled));
});
document.querySelector("#modal-support").addEventListener("click", () => {
  modalSettingsStatus.textContent = t("supportSoon");
});
modalPasskeyButton.addEventListener("click", async () => {
  if (!storage.email) {
    openAuthModal();
    setLoginStatus(t("passkeyLoginFirst"));
    return;
  }
  modalPasskeyButton.disabled = true;
  modalSettingsStatus.textContent = t("loading");
  try {
    await registerPasskey();
    modalSettingsStatus.textContent = t("passkeyRegistered");
  } catch (error) {
    if (!requestPasskeyReauthentication(error)) {
      modalSettingsStatus.textContent = passkeyRegistrationErrorMessage(error);
    }
  } finally {
    modalPasskeyButton.disabled = false;
  }
});
profileLogoutButton.addEventListener("click", async () => {
  try {
    await api.logout();
  } catch (error) {
    setStatus(t("errorPrefix", { message: error.message }));
  }
  storage.clear();
  closeModals();
  passkeyNudge.classList.add("hidden");
  navigateTo("/", { replace: true });
});

window.addEventListener("popstate", () => {
  handleRoute().catch((error) => setStatus(t("errorPrefix", { message: error.message })));
});

document.querySelector("#app-notice-close").addEventListener("click", () => appNotice.classList.add("hidden"));
document.addEventListener("keydown", (event) => {
  const modal = document.querySelector(".modal-layer:not(#story-detail-screen):not(.hidden)")
    || document.querySelector("#story-detail-screen:not(.hidden)");
  if (!modal) return;
  if (event.key === "Escape") {
    event.preventDefault();
    if (modal === storyDetailScreen) closeStoryDetail();
    else closeModals();
  } else if (event.key === "Tab") {
    const controls = [...modal.querySelectorAll("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex='0']")]
      .filter(node => node.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
      event.preventDefault();
      first?.focus();
    }
  }
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
const accountUI = createAccountUI({ request, email: () => storage.email, language: () => storage.language });
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
      closeModals();
      return handleRoute();
    })
    .catch(() => {
      storage.clear();
      currentState = null;
      return handleRoute();
    });
}
