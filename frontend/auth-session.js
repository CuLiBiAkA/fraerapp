// Cookie renewal is shared by every client on the page, including Builder's
// configurable API runtime. Callers keep ownership of their response formats.
const refreshes = new Map();

export function refreshSession(base = "") {
  base = base.replace(/\/+$/, "");
  const key = new URL(`${base}/`, globalThis.location?.href || "http://localhost/").href;
  if (!refreshes.has(key)) {
    refreshes.set(key, renew(base).finally(() => refreshes.delete(key)));
  }
  return refreshes.get(key);
}

async function renew(base) {
  const response = await fetch(`${base}/auth/refresh`, {
    method: "POST", credentials: "include", cache: "no-store",
    headers: { Accept: "application/json", "X-Fraer-Request": "same-origin" },
  });
  if (response.status === 401) {
    // Another tab may have consumed the one-time cookie. Wait only for its new
    // live session; never rotate the rejected cookie again in this attempt.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await new Promise(resolve => setTimeout(resolve, attempt * 150));
      const session = await fetch(`${base}/auth/me`, {
        credentials: "include", cache: "no-store", headers: { Accept: "application/json" },
      });
      if (session.ok) return session;
      if (session.status !== 401) break;
    }
  }
  return response;
}

export async function fetchWithSession(url, options = {}, { base = "", refresh = true } = {}) {
  const response = await fetch(url, options);
  const page = globalThis.location?.href || "http://localhost/";
  const target = new URL(url, page), runtime = new URL(`${base.replace(/\/+$/, "")}/`, page);
  const canRefresh = target.origin === runtime.origin
    && !/^\/auth\/(login-link|verify|refresh|passkeys\/authentication)(?:\/|$)/.test(target.pathname);
  if (response.status === 401 && refresh && canRefresh && (await refreshSession(base)).ok) {
    return fetch(url, options);
  }
  return response;
}
