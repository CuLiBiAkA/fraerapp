import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const indexHtml = await readFile(new URL("./index.html", import.meta.url), "utf8");
const appJs = await readFile(new URL("./app.js", import.meta.url), "utf8");
const engineJs = await readFile(new URL("../frontend/engine.js", import.meta.url), "utf8");

function sessionHarness(kind, fetch) {
  const context = vm.createContext({
    fetch, setTimeout: callback => { queueMicrotask(callback); },
    authRefreshPromise: null, authorRefreshPromises: new Map(),
    els: { runtimeUrl: { value: "" } }, currentLanguage: "en", reviewLimitMessage: () => "Wait",
  });
  const source = kind === "reader" ? engineJs : appJs;
  const names = kind === "reader"
    ? ["request", "requestAttempt", "shouldRefreshAuth", "refreshAuthSession", "refreshAuthSessionAttempt"]
    : ["authorHeaders", "authorFetch", "authorFetchAttempt", "shouldRefreshAuth", "refreshAuth", "performAuthRefresh"];
  for (const name of names) {
    const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));
    if (match) vm.runInContext(match[0], context);
  }
  return kind === "reader" ? context.request : context.authorFetch;
}

const response = (status, payload = {}) => ({ status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(payload) });

for (const kind of ["reader", "builder"]) {
  test(`${kind} shares one refresh across simultaneous expired-session requests`, async () => {
    let refreshes = 0, releaseRefresh, authenticated = false;
    const pendingRefresh = new Promise(resolve => { releaseRefresh = resolve; });
    const request = sessionHarness(kind, async path => {
      if (path === "/auth/refresh") { refreshes++; await pendingRefresh; authenticated = true; return response(200); }
      return response(authenticated ? 200 : 401, { ok: authenticated });
    });
    const first = request("/api/first"), second = request("/api/second");
    await new Promise(resolve => setImmediate(resolve));
    const observed = refreshes;
    releaseRefresh();
    const results = await Promise.all([first, second]);
    assert.equal(observed, 1);
    assert.ok(results.every(result => result.ok));
  });

  test(`${kind} recovers when another tab wins refresh rotation`, async () => {
    let authenticated = false, sessionChecks = 0, refreshes = 0;
    const request = sessionHarness(kind, async path => {
      if (path === "/auth/refresh") { refreshes++; return response(401); }
      if (path === "/auth/me") {
        sessionChecks++;
        if (sessionChecks > 1) authenticated = true;
        return response(authenticated ? 200 : 401);
      }
      return response(authenticated ? 200 : 401, { ok: authenticated });
    });
    assert.equal((await request("/api/private")).ok, true);
    assert.equal(refreshes, 1);
    assert.equal(sessionChecks, 2);
  });

  test(`${kind} rejects a revoked session without retrying indefinitely`, async () => {
    let refreshes = 0, sessionChecks = 0;
    const request = sessionHarness(kind, async path => {
      if (path === "/auth/refresh") refreshes++;
      if (path === "/auth/me") sessionChecks++;
      return response(401);
    });
    await assert.rejects(() => request("/api/private"), /401/);
    assert.equal(refreshes, 1);
    assert.ok(sessionChecks <= 3);
  });
}

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
