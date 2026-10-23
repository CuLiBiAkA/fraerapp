const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createAnalytics() {
  let visitorId;
  try {
    try { visitorId = localStorage.getItem('fraerapp.cat-merge.visitor'); } catch { /* Storage is optional. */ }
    if (!UUID.test(visitorId || '')) {
      visitorId = crypto.randomUUID();
      try { localStorage.setItem('fraerapp.cat-merge.visitor', visitorId); } catch { /* This visit only. */ }
    }
  } catch { return { visit() {}, start() {}, finish() {} }; }
  const send = async (path, value) => {
    try {
      const response = await fetch('/api/experiments/cat-merge/' + path, {
        method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId, ...value }), keepalive: true, signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch { return false; }
  };
  let gameId, started, finished = false;
  return {
    visit() { void send('visit', {}); },
    start() {
      try { gameId = crypto.randomUUID(); finished = false; started = send('games', { gameId }); }
      catch { gameId = null; }
    },
    finish(game, outcome) {
      if (!gameId || finished) return;
      finished = true;
      const id = gameId, pending = started;
      const value = { outcome, score: game.score, drops: game.drops, merges: game.merges,
        highestLevel: game.highest, durationSeconds: Math.min(86400, Math.floor(game.time)) };
      // Preserve start/finish ordering even for a very fast restart; never block play.
      void pending.then(ok => ok && send('games/' + id + '/finish', value));
    },
  };
}
