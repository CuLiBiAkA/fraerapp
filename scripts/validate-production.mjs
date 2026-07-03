import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const indexHtml = read("frontend/index.html");
const indexText = visibleText(indexHtml);
const legalConfigJs = read("frontend/legal-config.js");
const nginxProd = read("nginx/nginx.prod.conf");
const nginxLocal = read("nginx/nginx.local.conf");
const legalPages = [
  "frontend/privacy-policy.html",
  "frontend/personal-data-consent.html",
  "frontend/terms.html",
].map((path) => [path, read(path)]);

const context = { window: {} };
vm.runInNewContext(legalConfigJs, context, { filename: "frontend/legal-config.js" });
const legal = context.window.FRAERAPP_LEGAL || {};

for (const key of [
  "operatorName",
  "operatorAddress",
  "operatorRegistration",
  "privacyEmail",
  "consentWithdrawalEmail",
  "serviceOwner",
]) {
  const value = String(legal[key] || "").trim();
  assert.ok(value, `Production legal config is missing ${key}`);
  assert.equal(value.startsWith("УКАЖИТЕ"), false, `Production legal config has placeholder ${key}`);
}

for (const [path, html] of legalPages) {
  assert.equal(html.includes("Документ не готов к публикации"), false, `${path} contains unpublished warning`);
  assert.equal(html.includes("оператор , адрес: ,"), false, `${path} contains empty operator template`);
  assert.equal(/data-legal="(?:operatorName|operatorAddress|operatorRegistration|serviceOwner)"[^>]*><\/(?:strong|span)>/.test(html), false, `${path} contains empty legal fallback`);
  assert.equal(/Контакт:\s*<a[^>]*><\/a>/.test(html), false, `${path} contains empty contact`);
}

for (const forbidden of ["Builder", "Admin", "Story JSON", "Import", "Publish last import", "Stats"]) {
  assert.equal(indexText.includes(forbidden), false, `Homepage exposes ${forbidden}`);
}

assert.match(indexHtml, /<meta name="description" content="FraerApp — сервис интерактивных историй/);
assert.match(indexHtml, /<meta property="og:title" content="FraerApp/);
assert.match(indexHtml, /<meta property="og:description" content="FraerApp — сервис интерактивных историй/);
assert.match(indexHtml, /<meta property="og:type" content="website">/);
assert.match(indexHtml, /<meta property="og:url" content="https:\/\/fraerapp\.ru\/">/);

assert.match(nginxProd, /location \^~ \/auth\/admin[\s\S]+X-Robots-Tag "noindex, nofollow"/);
assert.match(nginxProd, /location \/builder\/[\s\S]+X-Robots-Tag "noindex, nofollow"/);
assert.match(nginxLocal, /location \^~ \/auth\/admin[\s\S]+X-Robots-Tag "noindex, nofollow"/);
assert.match(nginxLocal, /location \/builder\/[\s\S]+X-Robots-Tag "noindex, nofollow"/);

console.log("Production validation passed.");

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
