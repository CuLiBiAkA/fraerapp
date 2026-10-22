import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const script = readFileSync(new URL('./visits.js', import.meta.url), 'utf8').replace('export function', 'function');
function browser(storage, requests, fetchFailure = false) {
  return vm.createContext({ location: { protocol: 'https:', hostname: 'example.test' }, crypto: { randomUUID },
    AbortSignal, localStorage: storage, fetch: (url, options) => {
      requests.push({ url, options }); return fetchFailure ? Promise.reject(new Error('offline')) : Promise.resolve({ ok: true });
    } });
}
test('reload preserves the anonymous browser id; another browser is distinct; no account cookies', () => {
  const values = new Map(), requests = [];
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  for (let i = 0; i < 2; i++) vm.runInContext(script + '\nrecordVisit();', browser(storage, requests));
  const ids = requests.map(r => JSON.parse(r.options.body).visitorId);
  assert.equal(ids[0], ids[1]); assert.equal(requests.length, 2);
  assert.equal(requests[0].options.credentials, 'omit');
  vm.runInContext(script + '\nrecordVisit();', browser({ getItem: () => null, setItem() {} }, requests));
  assert.notEqual(JSON.parse(requests[2].options.body).visitorId, ids[0]);
});
test('disabled storage, invalid saved id and offline collection never throw', async () => {
  const requests = [], disabled = { getItem() { throw new Error('disabled'); }, setItem() { throw new Error('disabled'); } };
  assert.doesNotThrow(() => vm.runInContext(script + '\nrecordVisit();', browser(disabled, requests, true)));
  assert.doesNotThrow(() => vm.runInContext(script + '\nrecordVisit();', browser({ getItem: () => 'invalid', setItem() {} }, requests, true)));
  assert.equal(requests.length, 2);
  assert.match(JSON.parse(requests[1].options.body).visitorId, /^[0-9a-f-]{36}$/);
  await new Promise(resolve => setImmediate(resolve));
});
