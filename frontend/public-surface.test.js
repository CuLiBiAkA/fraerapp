import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const indexHtml = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const indexText = visibleText(indexHtml);
const engineJs = fs.readFileSync(new URL("./engine.js", import.meta.url), "utf8");
const accountDialogsJs = fs.readFileSync(new URL("./account-dialogs.js", import.meta.url), "utf8");
const legalConfigJs = fs.readFileSync(new URL("./legal-config.js", import.meta.url), "utf8");

const legalPages = [
  "privacy-policy.html",
  "personal-data-consent.html",
  "terms.html",
].map((file) => [file, fs.readFileSync(new URL(`./${file}`, import.meta.url), "utf8")]);

test("public homepage source does not expose service/admin controls", () => {
  for (const forbidden of [
    "Builder",
    "Admin",
    "Story JSON",
    "Import",
    "Publish last import",
    "Stats",
  ]) {
    assert.equal(indexText.includes(forbidden), false, forbidden);
  }
});

test("legal pages are publication-ready and have no empty реквизиты", () => {
  for (const [file, html] of legalPages) {
    assert.equal(html.includes("Документ не готов к публикации"), false, file);
    assert.equal(html.includes("оператор , адрес: ,"), false, file);
    assert.equal(/data-legal="(?:operatorName|operatorAddress|operatorRegistration|serviceOwner)"[^>]*><\/(?:strong|span)>/.test(html), false, file);
    assert.equal(/Контакт:\s*<\/footer>/.test(html), false, file);
    assert.equal(/Контакт:\s*<a[^>]*><\/a>/.test(html), false, file);
  }
});

test("legal config has every production-required value", () => {
  const context = { window: {} };
  vm.runInNewContext(legalConfigJs, context, { filename: "legal-config.js" });
  const config = context.window.FRAERAPP_LEGAL;
  for (const key of [
    "operatorName",
    "operatorAddress",
    "operatorRegistration",
    "privacyEmail",
    "consentWithdrawalEmail",
    "serviceOwner",
  ]) {
    assert.ok(String(config[key] || "").trim(), key);
    assert.equal(String(config[key]).startsWith("УКАЖИТЕ"), false, key);
  }
});

test("ru locale does not contain the listed English user strings", () => {
  const ruBlock = engineJs.slice(engineJs.indexOf("  ru: {"), engineJs.indexOf("  en: {"));
  for (const forbidden of [
    "Choose a story",
    "Interactive stories with saved progress, endings and personal routes",
    "Search stories",
    "Sort",
    "Recent progress",
    "Completion",
    "Published",
    "Updated",
    "Prev",
    "Next",
    "Volume",
  ]) {
    assert.equal(indexText.includes(forbidden), false, forbidden);
    assert.equal(ruBlock.includes(`"${forbidden}"`), false, forbidden);
  }
});

test("homepage has SEO basics and OpenGraph metadata", () => {
  assert.match(indexHtml, /<title>FraerApp .+<\/title>/);
  assert.match(indexHtml, /<meta name="description" content="FraerApp — сервис интерактивных историй/);
  assert.match(indexHtml, /<meta property="og:title" content="FraerApp/);
  assert.match(indexHtml, /<meta property="og:description" content="FraerApp — сервис интерактивных историй/);
  assert.match(indexHtml, /<meta property="og:type" content="website">/);
  assert.match(indexHtml, /<meta property="og:url" content="https:\/\/fraerapp\.ru\/">/);
  assert.match(indexHtml, /<h1[^>]*data-i18n="loginTitle"/);
});

test("passkey unavailable state hides the active login button", () => {
  assert.match(indexHtml, /id="passkey-unavailable"[^>]*>Вход по passkey недоступен в этом браузере<\/small>/);
  assert.match(engineJs, /passkeyLoginButton\.classList\.toggle\("hidden", !supported\)/);
  assert.match(engineJs, /passkeyUnavailable\.classList\.toggle\("hidden", supported\)/);
});

test("passkey WebAuthn browser errors are converted to readable messages", () => {
  assert.match(engineJs, /function passkeyErrorMessage/);
  assert.match(engineJs, /function isPasskeyNotAllowedError/);
  assert.match(engineJs, /passkeyNotAllowed: "Браузер отменил или запретил операцию passkey/);
  assert.match(engineJs, /passkeyStatus\.textContent = passkeyRegistrationErrorMessage\(error\)/);
  assert.match(engineJs, /setLoginStatus\(passkeyLoginErrorMessage\(error\), "error"\)/);
  assert.doesNotMatch(engineJs, /passkeyRegistrationFailed", \{ message: error\.message \}/);
});

test("signed-in homepage keeps the public shell but enables user actions", () => {
  assert.match(accountDialogsJs, /id="modal-sound-toggle"/);
  assert.match(engineJs, /mountAccountDialogs\(\)/);
  assert.match(engineJs, /async function afterLogin\(\)[\s\S]*await handleRoute\(\);/);
  assert.match(engineJs, /homeProfileButton\.classList\.toggle\("is-guest", !loggedIn\)/);
  assert.doesNotMatch(engineJs, /homeSearchButton\.classList\.toggle\("hidden", !loggedIn\)/);
  assert.match(engineJs, /homeProfileButton\.setAttribute\("aria-label", loggedIn \? t\("homeProfileAccountLabel"\) : t\("homeProfileGuestLabel"\)\)/);
  assert.match(engineJs, /homeReadButton\.addEventListener\("click", \(\) => \{[\s\S]*navigateTo\("\/history"\)/);
  assert.match(engineJs, /storyDetailAction\.onclick = \(\) => \{[\s\S]*if \(!storage\.email\)[\s\S]*openAuthModal\(\)/);
  assert.match(engineJs, /const canContinue = story\.lastSessionId && story\.lastSessionStatus !== "finished"/);
  assert.match(engineJs, /const action = canContinue \? continueStory\(story\.lastSessionId\) : startStoryRun\(story\.key\)/);
});

test("create stays visible and refreshes author access before opening the builder", async () => {
  const source = engineJs.slice(engineJs.indexOf("function updateTopActions("), engineJs.indexOf("function syncRoleActionButtons("));
  const createSource = engineJs.slice(engineJs.indexOf("function createHomeStory("), engineJs.indexOf("async function showPublicHome("));
  for (const roles of [null, ["player"], ["author"], ["admin"]]) {
    const classes = new Set(["hidden"]);
    const element = { classList: { toggle() {}, remove: (name) => classes.delete(name) }, setAttribute() {} };
    let authOpened = false;
    let profileOpened = false;
    let guidanceVisible = false;
    const context = vm.createContext({
      storage: { email: roles ? "test@example.test" : "", roles: roles || [], setUser(user) { this.roles = user.roles; } },
      request: async () => ({ user: { roles } }),
      accountUI: { refresh() {} },
      document: { body: element, querySelector: () => element }, t: (key) => key, syncRoleActionButtons() {},
      ...Object.fromEntries(["sceneScreen", "storyScreen", "settingsScreen", "menuButton", "settingsButton", "homeProfileButton", "homeSearchButton", "homeSettingsButton", "homeCreateButton", "builderButton", "adminButton", "soundControl", "logoutButton"].map((key) => [key, element])),
      window: { location: { href: "" } },
      openAuthModal() { authOpened = true; },
      openAuthorRequestModal() { profileOpened = true; guidanceVisible = true; },
      profileModal: { querySelector: () => ({ classList: { remove() { guidanceVisible = true; } } }) },
    });
    vm.runInContext(source + createSource, context);
    context.updateTopActions(null);
    assert.equal(classes.has("hidden"), false);
    await context.createHomeStory();
    assert.equal(authOpened, roles === null);
    assert.equal(profileOpened, false);
    assert.equal(context.window.location.href, roles ? roles.some((role) => ["author", "admin"].includes(role)) ? "/builder/" : "/subscription/" : "");
  }
});

test("a new author subscription refreshes the session before entering the builder", async () => {
  const source = engineJs.slice(engineJs.indexOf("async function openBuilder("), engineJs.indexOf("async function showPublicHome("));
  const nodes = new Map();
  const calls = [];
  const context = vm.createContext({
    document: { querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, {}); return nodes.get(selector); } },
    storage: { roles: ["player"], setUser(user) { this.roles = user.roles; } },
    window: { location: { href: "" } },
    hasAnyRole: (roles, wanted) => roles.some(role => wanted.includes(role)),
    t: key => key, openModal() {}, openAuthModal() { throw new Error("Approved player should remain signed in"); },
    request: async (path, options) => {
      calls.push([path, options?.method || "GET"]);
      return { user: { roles: ["player", "author"] } };
    },
  });
  vm.runInContext(source, context);
  await context.openBuilder();
  assert.deepEqual(calls, [["/auth/refresh", "POST"]]);
  assert.equal(context.window.location.href, "/builder/");
});

test("sign-in resumes a recent subscription checkout only at the fixed local route", () => {
  const source=engineJs.slice(engineJs.indexOf("function resumeSubscription("),engineJs.indexOf("function resumePasskeyRegistration("));
  for(const [expires,expected] of [[Date.now()+60000,true],[Date.now()-60000,false],[0,false]]){
    const calls=[];let removed=false;
    const context=vm.createContext({localStorage:{getItem:()=>String(expires),removeItem:()=>{removed=true;}},window:{location:{assign:url=>calls.push(url)}}});
    vm.runInContext(source,context);assert.equal(context.resumeSubscription(),expected);assert.equal(removed,true);assert.deepEqual(calls,expected?["/subscription/"]:[]);
  }
});

test("passkey sign-in errors never expose server responses or browser internals", () => {
  const source = engineJs.slice(
    engineJs.indexOf("function passkeyLoginErrorMessage("),
    engineJs.indexOf("async function loadPasskeys("),
  );
  const context = vm.createContext({ t: (key) => key });
  vm.runInContext(source, context);
  for (const message of [
    '<!DOCTYPE HTML><html><body>Error 501: unsupported POST</body></html>',
    'HTTP 503',
    'Failed to fetch',
    'Database exception: private connection details',
  ]) {
    assert.equal(context.passkeyLoginErrorMessage(new Error(message)), "passkeyLoginFailed");
  }
  assert.equal(context.passkeyLoginErrorMessage({ name: "NotAllowedError", message: "Internal browser details" }), "passkeyLoginFirst");
  assert.equal(context.passkeyLoginErrorMessage(new Error("Passkey credential was not returned")), "passkeyLoginFirst");
  assert.equal(context.passkeyLoginErrorMessage({ code: "AUTH_PREVIEW", message: "server details" }), "passkeyPreview");
});

test("history catalog and story detail have stable public routes", () => {
  assert.match(indexHtml, /id="story-detail-screen"/);
  assert.match(indexHtml, /styles\.css\?v=game-\d+/);
  assert.match(indexHtml, /engine\.js\?v=engine-\d+/);
  assert.match(engineJs, /function storyRoute\(story\)[\s\S]*`\/history\/\$\{encodeURIComponent/);
  assert.match(engineJs, /if \(path === "\/history"\)[\s\S]*renderHistoryRoute\(\)/);
  assert.match(engineJs, /if \(path\.startsWith\("\/history\/"\)\)[\s\S]*renderStoryDetailRoute/);
  assert.match(engineJs, /homeReadButton\.addEventListener\("click", \(\) => \{[\s\S]*navigateTo\("\/history"\)/);
  assert.match(engineJs, /link\.href = storyRoute\(story\)/);
  assert.match(engineJs, /storyDetailBack\.addEventListener\("click", closeStoryDetail\)/);
  assert.match(indexHtml, /id="story-detail-screen"[^>]*role="dialog"/);
});

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

test("profile favorites opens the filtered library and clears an old search", () => {
  const start = engineJs.indexOf('document.querySelector("#profile-favorites").addEventListener');
  const end = engineJs.indexOf('document.querySelector("#library-settings").addEventListener', start);
  let handler, closed = false, route;
  const sort = { value: "default" };
  const context = vm.createContext({
    storySearch: { value: "old query" },
    storySort: sort, catalogSelect: { refresh() {} },
    document: { querySelector: () => ({ addEventListener(event, callback) { handler = callback; } }) },
    closeModals() { closed = true; }, navigateTo(path) { route = path; },
  });
  vm.runInContext(engineJs.slice(start, end), context);
  handler();
  assert.equal(closed, true);
  assert.equal(sort.value, "favorites");
  assert.equal(context.storySearch.value, "");
  assert.equal(route, "/history");
});

test("empty favorites distinguishes guests from searches in an existing favorite collection", () => {
  const source = engineJs.slice(engineJs.indexOf("function favoriteEmptyMessage("), engineJs.indexOf("function renderStoryPage("));
  const context = vm.createContext({ storage: { email: "" }, catalogStories: [{ favorite: true }] });
  vm.runInContext(source, context);
  assert.equal(context.favoriteEmptyMessage(), "noFavorites");
  context.storage.email = "test@example.test";
  assert.equal(context.favoriteEmptyMessage(), "noFavoriteMatches");
  context.catalogStories = [];
  assert.equal(context.favoriteEmptyMessage(), "noFavorites");
});

test("expired passkey registration returns through sign-in to settings without creating credentials automatically", () => {
  const source = engineJs.slice(engineJs.indexOf("function resumePasskeyRegistration("), engineJs.indexOf("async function signInWithPasskey("));
  const values = new Map();
  let auth = 0, settings = 0;
  const context = vm.createContext({
    Date, localStorage: { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) },
    openAuthModal() { auth++; }, openSettingsModal() { settings++; },
    setLoginStatus() {}, telegramLoginButton: { focus() {} }, modalSettingsStatus: {}, t: (key) => key,
  });
  vm.runInContext(source, context);
  assert.equal(context.requestPasskeyReauthentication({ message: "Recent authentication required" }), true);
  assert.equal(auth, 1);
  context.resumePasskeyRegistration();
  assert.equal(settings, 1);
  assert.equal(values.size, 0);
  context.resumePasskeyRegistration();
  assert.equal(settings, 1);
  assert.equal(context.requestPasskeyReauthentication({ status: 401 }), true);
  assert.equal(context.requestPasskeyReauthentication({ status: 500 }), false);
  values.set("fraerapp.passkeyRegistrationPending", String(Date.now() - 1));
  context.resumePasskeyRegistration();
  assert.equal(settings, 1);
});

test("library sorts by rating with unrated stories last and preserves default order", () => {
  const source = engineJs.slice(engineJs.indexOf("function sortStories("), engineJs.indexOf("function formatDate("));
  const context = vm.createContext({ storySort: { value: "default" }, currentLanguage: "en" });
  vm.runInContext(source, context);
  const stories = [{ title: "Z", publishedAt: "2026-01-01", updatedAt: "2026-03-01" }, { title: "A", publishedAt: "2026-02-01", updatedAt: "2026-02-01" }];
  for (const [mode, first] of [["default", "Z"], ["favorites", "Z"], ["title", "A"], ["publishedAt", "A"], ["updatedAt", "Z"]]) {
    context.storySort.value = mode;
    assert.equal(context.sortStories(stories)[0].title, first);
  }
  assert.equal(stories[0].title, "Z");
  context.storySort.value = "rating";
  const rated = [{ title: "Unrated", rating: null }, { title: "B", rating: 5 }, { title: "Lower", rating: 3 }, { title: "A", rating: 5 }];
  assert.deepEqual(Array.from(context.sortStories(rated), s => s.title), ["A", "B", "Lower", "Unrated"]);
  const select = indexHtml.match(/<select id="story-sort">([\s\S]*?)<\/select>/)[1];
  assert.deepEqual([...select.matchAll(/value="([^"]+)"/g)].map((match) => match[1]), ["default", "favorites", "rating", "title", "publishedAt", "updatedAt"]);
});

test("each modal language button selects its language and repeated selection is idempotent", () => {
  const source = engineJs.slice(engineJs.indexOf('modalLangRuButton.addEventListener("click"'), engineJs.indexOf('modalSoundToggle.addEventListener("click"'));
  const handlers = {};
  const context = vm.createContext({
    currentLanguage: "ru",
    setLanguage(language) { context.currentLanguage = language; },
    modalLangRuButton: { addEventListener(event, handler) { handlers.ru = handler; } },
    modalLangEnButton: { addEventListener(event, handler) { handlers.en = handler; } },
  });
  vm.runInContext(source, context);
  for (const button of ["ru", "en"]) {
    for (const language of ["ru", "en"]) {
      context.currentLanguage = language;
      handlers[button]();
      assert.equal(context.currentLanguage, button);
      handlers[button]();
      assert.equal(context.currentLanguage, button);
    }
  }
});

test("home search covers the signed-in catalogue and restricts guests to three demo stories", () => {
  const source = (name) => {
    const start = engineJs.indexOf(`function ${name}(`);
    const end = engineJs.indexOf("\nfunction ", start + 1);
    return engineJs.slice(start, end);
  };
  const stories = Array.from({ length: 14 }, (_, i) => ({
    key: String(i), title: `Story ${String(i).padStart(2, "0")}`, authorName: i % 2 ? "Anna" : "Boris",
    publishedAt: `2026-01-${String(i + 1).padStart(2, "0")}`,
  }));
  const context = vm.createContext({ catalogStories: stories, storage: { email: "test@example.test" }, currentLanguage: "en",
    homeSearchInput: { value: "" } });
  vm.runInContext(["getHomeStories", "storyMatchesQuery", "compareStoryTitle", "compareDate", "dateValue"].map(source).join("\n"), context);
  assert.equal(context.getHomeStories().length, 14);
  context.homeSearchInput.value = "  STORY 13  ";
  assert.equal(context.getHomeStories()[0].key, "13");
  context.homeSearchInput.value = "Anna";
  assert.equal(context.getHomeStories().length, 7);
  context.homeSearchInput.value = "";
  stories[1].favorite = true;
  assert.equal(context.getHomeStories()[0].key, "1");
  context.storage.email = "";
  assert.equal(context.getHomeStories().length, 0);
  context.catalogStories = [
    { key: "night_train", title: "Train 404" },
    { key: "other", title: "Other" },
    { key: "kak_pogladit_kota_ne_ubiv", title: "Cat" },
    { key: "kak_shodit_v_tualet_pravilno", title: "Toilet" },
  ];
  assert.deepEqual(Array.from(context.getHomeStories(), s => s.key),
    ["kak_shodit_v_tualet_pravilno", "kak_pogladit_kota_ne_ubiv", "night_train"]);
  assert.doesNotMatch(indexHtml, /id="home-filters"|id="home-author"|id="home-sort"/);
});
