import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { fetchWithSession, refreshSession } from "../frontend/auth-session.js?v=1";
import { request as collectionRequest } from "../frontend/collection-ui.js";
import { uploadImage } from "../frontend/author-cover.js";

const indexHtml = await readFile(new URL("./index.html", import.meta.url), "utf8");
const sources = Object.fromEntries(await Promise.all(Object.entries({
  reader: "../frontend/engine.js", builder: "./app.js", upload: "./app.js",
  workspace: "../frontend/story-workspace.js", subscription: "../frontend/subscription.js",
  standalone: "../frontend/standalone-dialogs.js", admin: "../frontend/admin-panel.js",
  recovery: "../frontend/workspace-access.js",
}).map(async ([kind, path]) => [kind, await readFile(new URL(path, import.meta.url), "utf8")])));
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function sessionHarness(kind, fetch, base = "") {
  globalThis.fetch = fetch;
  if (kind === "collection") return collectionRequest;
  const context = vm.createContext({
    fetchWithSession, refreshSession, URL,
    els: { runtimeUrl: { value: base } }, currentLanguage: "en", reviewLimitMessage: () => "Wait",
    window: { location: { href: "https://app.test/builder/" } },
  });
  const names = {
    reader: ["request", "requestAttempt"], builder: ["authorHeaders", "authorFetch", "authorFetchAttempt"],
    upload: ["fetchJson", "fetchJsonAttempt"], workspace: ["request"], subscription: ["api"],
    standalone: ["request"], admin: ["api"], recovery: ["readCurrentSession"],
  }[kind];
  for (const name of names) {
    const match = sources[kind].match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n${kind === "standalone" ? "  " : ""}\\}`));
    assert.ok(match, `missing ${kind} ${name}`);
    vm.runInContext(match[0], context);
  }
  if (kind === "upload") return (url, options) => context.fetchJson(new URL(url, "https://app.test").href, options);
  return context[names[0] === "authorHeaders" ? "authorFetch" : names[0]];
}

const response = (status, payload = {}) => ({
  status, ok: status >= 200 && status < 300,
  text: async () => JSON.stringify({ message: `HTTP ${status}`, ...payload }), json: async () => payload,
});
const endpoint = url => new URL(url, "https://app.test").pathname;

for (const kind of ["reader", "builder", "collection", "workspace", "subscription", "standalone", "admin", "recovery", "upload"]) {
  test(`${kind} shares one refresh across simultaneous expired-session requests`, async () => {
    let refreshes = 0, releaseRefresh, authenticated = false;
    const pendingRefresh = new Promise(resolve => { releaseRefresh = resolve; });
    const request = sessionHarness(kind, async url => {
      if (endpoint(url) === "/auth/refresh") { refreshes++; await pendingRefresh; authenticated = true; return response(200); }
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
    const request = sessionHarness(kind, async url => {
      const path = endpoint(url);
      if (path === "/auth/refresh") { refreshes++; return response(401); }
      if (path === "/auth/me") {
        sessionChecks++;
        if (sessionChecks > (kind === "recovery" ? 2 : 1)) authenticated = true;
        return response(authenticated ? 200 : 401, { ok: authenticated });
      }
      return response(authenticated ? 200 : 401, { ok: authenticated });
    });
    assert.equal((await request("/api/private")).ok, true);
    assert.equal(refreshes, 1);
    assert.equal(sessionChecks, kind === "recovery" ? 4 : 2);
  });

  test(`${kind} rejects a revoked session without retrying indefinitely`, async () => {
    let refreshes = 0, sessionChecks = 0;
    const request = sessionHarness(kind, async url => {
      const path = endpoint(url);
      if (path === "/auth/refresh") refreshes++;
      if (path === "/auth/me") sessionChecks++;
      return response(401);
    });
    await assert.rejects(() => request("/api/private"), error => error.status === 401 || /401/.test(error.message));
    assert.equal(refreshes, 1);
    assert.equal(sessionChecks, kind === "recovery" ? 4 : 3);
  });
}

test("different page clients share the same pending refresh", async () => {
  let authenticated = false, refreshes = 0, release;
  const pending = new Promise(resolve => { release = resolve; });
  const fetch = async url => {
    if (endpoint(url) === "/auth/refresh") { refreshes++; await pending; authenticated = true; return response(200); }
    return response(authenticated ? 200 : 401, { ok: authenticated });
  };
  const callers = ["reader", "collection", "workspace", "standalone", "subscription", "admin", "builder"].map(kind => sessionHarness(kind, fetch, kind === "builder" ? "http://localhost" : ""));
  const results = callers.map(request => request("/api/private"));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(refreshes, 1);
  release();
  assert.ok((await Promise.all(results)).every(value => value.ok));
});

test("cover upload retries the same multipart body after shared renewal", async () => {
  const calls = []; let authenticated = false;
  globalThis.fetch = async (url, options) => {
    calls.push({url, options});
    if (url === "/auth/refresh") { authenticated = true; return response(200); }
    return response(authenticated ? 200 : 401, { url: "/uploads/work/cover.png" });
  };
  assert.equal(await uploadImage("/api/author/collections/work/cover", new Blob(["image"]), { scope: "local" }), "/uploads/work/cover.png");
  const uploads = calls.filter(call => call.url.includes("/api/"));
  assert.equal(uploads.length, 2);
  assert.equal(uploads[0].options.body, uploads[1].options.body);
  assert.equal(uploads[1].options.body.get("scope"), "local");
});

test("Builder uses the initiating upload runtime for refresh and retry", async () => {
  const calls = []; let authenticated = false;
  const request = sessionHarness("upload", async (url, options) => {
    calls.push({url, options});
    if (url === "https://runtime.test/auth/refresh") { authenticated = true; return response(200); }
    return response(authenticated ? 200 : 401, { ok: authenticated });
  }, "https://other-runtime.test");
  const body = new FormData(); body.append("file", new Blob(["asset"]));
  await request("https://runtime.test/api/author/stories/work/assets", {method:"POST", body});
  assert.deepEqual(calls.map(call => call.url), ["https://runtime.test/api/author/stories/work/assets", "https://runtime.test/auth/refresh", "https://runtime.test/api/author/stories/work/assets"]);
  assert.equal(calls[0].options.body, calls[2].options.body);
});

test("forbidden requests and login failures never rotate a session", async () => {
  for (const [url, status] of [["/api/private", 403], ["/auth/verify", 401], ["/auth/login-link", 401], ["/auth/passkeys/authentication/verify", 401], ["/auth/refresh", 401]]) {
    const calls = []; globalThis.fetch = async path => { calls.push(path); return response(status); };
    assert.equal((await fetchWithSession(url)).status, status);
    assert.deepEqual(calls, [url]);
  }
});

test("failed replay returns without another renewal", async () => {
  const calls = []; globalThis.fetch = async url => { calls.push(url); return response(url === "/auth/refresh" ? 200 : 401); };
  assert.equal((await fetchWithSession("/api/private")).status, 401);
  assert.deepEqual(calls, ["/api/private", "/auth/refresh", "/api/private"]);
});

test("different runtimes renew independently and cannot refresh an unrelated origin", async () => {
  const calls = []; let release;
  const pending = new Promise(resolve => { release = resolve; });
  globalThis.fetch = async url => { calls.push(url); await pending; return response(200); };
  const attempts = [refreshSession("https://first.test"), refreshSession("https://second.test"), refreshSession("https://first.test/")];
  assert.deepEqual(calls, ["https://first.test/auth/refresh", "https://second.test/auth/refresh"]);
  release(); await Promise.all(attempts);
  calls.length = 0;
  globalThis.fetch = async url => { calls.push(url); return response(401); };
  assert.equal((await fetchWithSession("https://first.test/api/private", {}, {base:"https://second.test"})).status, 401);
  assert.deepEqual(calls, ["https://first.test/api/private"]);
});

test("builder uses the shared FraerApp session without a separate consent form", () => {
  assert.doesNotMatch(indexHtml, /author-consent/);
  assert.doesNotMatch(sources.builder, /\/auth\/login-link/);
  assert.match(sources.builder, /\/auth\/me/);
  assert.match(sources.builder, /fetchWithSession/);
});

test("builder verifies a login token opened directly on the builder route", () => {
  assert.match(sources.builder, /params\.get\("auth_token"\)/);
  assert.match(sources.builder, /authorFetch\("\/auth\/verify"/);
  assert.match(sources.builder, /params\.delete\("auth_token"\)/);
});
