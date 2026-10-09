import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const engine = fs.readFileSync(new URL('./engine.js', import.meta.url), 'utf8');
function catalogue(request, signedIn = true) {
  const context = vm.createContext({ request, storage: { email: signedIn ? 'reader@example.test' : null } });
  vm.runInContext(engine.slice(engine.indexOf('const api = {'), engine.indexOf('function t(')), context);
  return () => vm.runInContext('api.stories()', context);
}

test('one catalogue includes every collection page and keeps equal slugs in different domains independent', async () => {
  const requests = [];
  const collections = Array.from({ length: 101 }, (_, i) => ({ collectionId: `c-${i}`, key: i ? `collection-${i}` : 'shared', title: `Story ${i}`, favorite: i === 100, views: 9, rating: 4.5, ratingCount: 2 }));
  const load = catalogue(async path => {
    requests.push(path);
    if (path === '/api/catalog/stories') return [{ slug: 'shared', key: 'shared', title: 'Standalone' }];
    if (path === '/api/catalog/engagement') return [{ slug: 'shared', views: 20, rating: 4, favorite: true }];
    const page = Number(new URL(path, 'https://catalog.test').searchParams.get('page'));
    return collections.slice(page * 100, (page + 1) * 100);
  });
  const items = await load();
  assert.equal(items.length, 102);
  assert.equal(items[0].rating, 4);
  assert.equal(items[1].kind, 'collection');
  assert.equal(items[1].favorite, false);
  assert.equal(items[1].rating, 4.5, 'a chaptered story carries its own work rating without adopting a same-key scenario rating');
  assert.equal(items[1].ratingCount, 2);
  assert.equal(items[1].views, 9);
  assert.equal(items.at(-1).favorite, true);
  assert.ok(requests.includes('/api/catalog/collections?size=100&page=1'));
});

test('guest catalogue keeps the existing public demo contract without requesting private collections', async () => {
  const requests = [];
  const load = catalogue(async path => {
    requests.push(path);
    if (path === '/api/catalog/stories') return [{ slug: 'demo', key: 'demo' }];
    if (path === '/api/catalog/engagement') return [];
    throw new Error('A guest must not request collections');
  }, false);
  assert.equal((await load()).length, 1);
  assert.equal(requests.length, 2);
});

test('a failed collection page rejects the load instead of silently hiding stories', async () => {
  const load = catalogue(async path => {
    if (path.startsWith('/api/catalog/collections')) throw new Error('catalogue unavailable');
    return [];
  });
  await assert.rejects(load, /catalogue unavailable/);
});

test('card routes retain their domain even when a standalone and collection share a key', () => {
  const context = vm.createContext({});
  vm.runInContext(engine.slice(engine.indexOf('function storyRoute('), engine.indexOf('function navigateTo(')), context);
  assert.equal(context.storyRoute({ kind: 'collection', key: 'shared' }), '/collections/shared');
  assert.equal(context.storyRoute({ slug: 'shared' }), '/history/shared');
  assert.equal(context.storyRoute({ kind: 'collection', key: 'Кошка и дверь' }), '/collections/' + encodeURIComponent('Кошка и дверь'));
});
