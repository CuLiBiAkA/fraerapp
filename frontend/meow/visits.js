// One best-effort page view; the instrument never waits for analytics.
export function recordVisit() {
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  try {
    const key = 'fraerapp.meow.visitor';
    let visitorId;
    try { visitorId = localStorage.getItem(key); } catch { /* Private browsing may disable storage. */ }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId || '')) {
      visitorId = crypto.randomUUID();
      try { localStorage.setItem(key, visitorId); } catch { /* Count only this opening. */ }
    }
    void fetch('/api/experiments/meow/visit', {
      method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId }), keepalive: true, signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  } catch { /* Unsupported storage/crypto/network must not affect music. */ }
}
