import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const indexHtml = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const indexText = visibleText(indexHtml);
const engineJs = fs.readFileSync(new URL("./engine.js", import.meta.url), "utf8");
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
  assert.match(indexHtml, /id="modal-sound-toggle"/);
  assert.match(engineJs, /async function afterLogin\(\)[\s\S]*await showPublicHome\(\);/);
  assert.match(engineJs, /homeProfileButton\.classList\.toggle\("is-guest", !loggedIn\)/);
  assert.match(engineJs, /homeSearchButton\.classList\.toggle\("hidden", !loggedIn\)/);
  assert.match(engineJs, /homeCreateButton\.classList\.toggle\("hidden", !hasAnyRole\(roles, \["author", "admin"\]\)\)/);
  assert.match(engineJs, /homeReadButton\.addEventListener\("click", \(\) => \{[\s\S]*openStoryMenu\(\)/);
  assert.match(engineJs, /const action = story\.lastSessionId \? continueStory\(story\.lastSessionId\) : startStoryRun\(story\.key\)/);
});

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
