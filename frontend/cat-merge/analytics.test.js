import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalytics } from './analytics.js';
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup(t, fetcher, blocked = false) {
  const storage = new Map();
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), oldFetch = globalThis.fetch;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem(key) { if (blocked) throw Error('Disabled'); return storage.get(key); },
    setItem(key, value) { if (blocked) throw Error('Disabled'); storage.set(key, value); },
  } });
  globalThis.fetch = fetcher;
  t.after(() => { globalThis.fetch = oldFetch; if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else delete globalThis.localStorage; });
  return storage;
}
test('page visits retain browser identity, omit credentials and use a bounded request', async t => {
  const calls = []; setup(t, async (path, options) => { calls.push({ path, ...options, data: JSON.parse(options.body) }); return { ok: true }; });
  createAnalytics().visit(); createAnalytics().visit(); await flush();
  assert.equal(calls.length, 2); assert.equal(calls[0].data.visitorId, calls[1].data.visitorId);
  assert.equal(calls[0].credentials, 'omit'); assert.equal(calls[0].keepalive, true); assert.ok(calls[0].signal);
});
test('finish waits for its own start, snapshots result and sends only once across a restart', async t => {
  const calls = []; let resolveStart;
  setup(t, (path, options) => {
    calls.push({ path, data: JSON.parse(options.body) });
    if (calls.length === 1) return new Promise(resolve => { resolveStart = resolve; });
    return Promise.resolve({ ok: true });
  });
  const a = createAnalytics(), game = { score: 20, drops: 2, merges: 1, highest: 1, time: 4.8 };
  a.start(); a.finish(game, 'restarted'); a.finish(game, 'lost'); game.score = 999;
  a.start(); a.finish({ ...game, score: 0, drops: 1, merges: 0 }, 'lost'); await flush();
  resolveStart({ ok: true }); await flush();
  const starts = calls.filter(c => c.path.endsWith('/games')), ends = calls.filter(c => c.path.endsWith('/finish'));
  assert.equal(starts.length, 2); assert.equal(ends.length, 2);
  const old = ends.find(c => c.path.includes(starts[0].data.gameId));
  assert.equal(old.data.score, 20); assert.equal(old.data.durationSeconds, 4); assert.equal(old.data.outcome, 'restarted');
});
test('disabled storage and failed network never throw or emit an orphan finish', async t => {
  const calls = []; setup(t, async path => { calls.push(path); throw Error('Offline'); }, true);
  const a = createAnalytics(); assert.doesNotThrow(() => { a.visit(); a.start(); a.finish({ score: 0, drops: 1, merges: 0, highest: 0, time: 0 }, 'lost'); });
  await flush(); assert.equal(calls.length, 2); assert.ok(calls.every(c => !c.endsWith('/finish')));
});
