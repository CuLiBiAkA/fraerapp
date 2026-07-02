import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const indexHtml = await readFile(new URL("./index.html", import.meta.url), "utf8");
const appJs = await readFile(new URL("./app.js", import.meta.url), "utf8");

test("builder uses the shared FraerApp session without a separate consent form", () => {
  assert.doesNotMatch(indexHtml, /author-consent/);
  assert.doesNotMatch(appJs, /\/auth\/login-link/);
  assert.match(appJs, /\/auth\/me/);
  assert.match(appJs, /\/auth\/refresh/);
});

test("builder verifies a login token opened directly on the builder route", () => {
  assert.match(appJs, /params\.get\("auth_token"\)/);
  assert.match(appJs, /authorFetch\("\/auth\/verify"/);
  assert.match(appJs, /params\.delete\("auth_token"\)/);
});
