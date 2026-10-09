const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const origin = 'https://catalog.test';
const packageStory = JSON.parse(fs.readFileSync(path.join(root, 'story-builder/scenarios/koshka-i-otkrytye-dveri.package.json'))).collections[0];

async function check(browserType, language, width) {
  const browser = await browserType.launch();
  try {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(language => {
      localStorage.setItem('fraerapp.language', language);
      localStorage.setItem('fraerapp.cookieConsent', 'accepted');
    }, language);
    const cat = { ...packageStory, id: 'cat', collectionId: 'cat', kind: 'collection', favorite: false, views: 27, rating: 4.8, ratingCount: 5, myRating: null, authorName: 'Автор Миры', publishedAt: '2026-10-08T12:00:00Z', endingCount: 3, discoveredEndings: 0 };
    const sameKey = { id: 'collision', collectionId: 'collision', kind: 'collection', key: 'shared', slug: 'shared', title: 'Цикл', favorite: false, completionStatus: 'in_development' };
    const ordinary = [
      { key: 'ordinary', slug: 'ordinary', title: 'Обычная история', genre: 'Приключения', coverUrl: '/assets/platform.svg' },
      { key: 'shared', slug: 'shared', title: 'Самостоятельная история', coverUrl: '/assets/door.svg' },
    ];
    const writes = [], errors = [];
    let favoriteFails = true, ratingFails = true, startFails = false, deferView = false, releaseView, viewSeen, favoriteGate = null;
    const deferredViewSeen = new Promise(resolve => { viewSeen = resolve; });
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url()), p = url.pathname;
      const send = (json, status = 200) => route.fulfill({ json, status });
      if (url.origin !== origin) return route.abort();
      if (req.method() !== 'GET') writes.push({ path: p, body: req.postDataJSON() });
      if (p === '/auth/me') return send({ email: 'reader@example.test', roles: ['player'] });
      if (p === '/api/account') return send({ unreadCount: 0, notifications: [] });
      if (p === '/api/catalog/stories') return send(ordinary);
      if (p === '/api/catalog/engagement') return send(ordinary.map(s => ({ slug: s.slug, favorite: false, views: 12, rating: 4.5, ratingCount: 2 })));
      if (p === '/api/catalog/collections') return send([cat, sameKey]);
      if (p === '/api/catalog/collections/cat/favorite') {
        if (favoriteFails) return send({}, 503);
        if (favoriteGate) await favoriteGate;
        cat.favorite = req.postDataJSON().favorite; return send({ favorite: cat.favorite });
      }
      if (p === '/api/catalog/collections/collision/favorite') { sameKey.favorite = req.postDataJSON().favorite; return send({ favorite: sameKey.favorite }); }
      if (p === '/api/catalog/collections/cat/rating') {
        if (ratingFails) return send({}, 503);
        cat.myRating = req.postDataJSON().score; cat.rating = 5; cat.ratingCount = 6; return send({ saved: true });
      }
      if (p === '/api/catalog/collections/cat/view') {
        if (deferView) { viewSeen(); await new Promise(resolve => { releaseView = resolve; }); }
        return send({ recorded: true });
      }
      if (p === '/api/catalog/collections/' + cat.key || p === '/api/catalog/collections/cat') return send({ ...cat, items: [{ id: 'chapter-1', key: 'cat-1', kind: 'scenario', title: 'Глава 1', allowIndependentStart: true }] });
      if (p === '/api/collections/cat/runs') return send(req.method() === 'GET' ? [] : { id: 'run', items: [{ id: 'chapter-1', allowIndependentStart: true }] });
      if (p === '/api/collection-runs/run/start') {
        if (startFails) return send({}, 503);
        return send({ runId: 'run', session: { sessionId: 'reading', status: 'active', story: { key: 'cat-1', title: 'Глава 1' }, scene: { id: 'start', title: 'Дверь', text: 'Кошка увидела открытую дверь.', choices: [] }, statsVariables: {} } });
      }
      if (p.startsWith('/api/') || p.startsWith('/auth/')) return send([]);
      let file = path.join(root, 'frontend', p.slice(1));
      if (['/', '/history'].includes(p) || p.startsWith('/collections/')) file = path.join(root, 'frontend/index.html');
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      return fs.existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404, body: '' });
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    async function chooseSort(value) {
      const label = await page.locator(`#story-sort option[value="${value}"]`).textContent();
      await page.locator('#story-sort-trigger').click();
      await page.getByRole('option', { name: label, exact: true }).click();
    }
    await page.goto(origin + '/history');
    await page.locator('#stories .story-card').first().waitFor();
    assert.equal(await page.locator('#stories .story-card').count(), 4, 'standalone and chaptered stories must share one grid');
    assert.equal(await page.locator('#collection-catalog').count(), 0, 'separate collection catalogue must be retired');
    const card = page.locator('#stories .story-card').filter({ has: page.locator(`a[href="/collections/${cat.key}"]`) });
    assert.match(await card.locator('.story-cover').getAttribute('style'), /cat-sofa-background-v2\.png/);
    assert.equal(await card.locator('.story-genre').textContent(), 'Повседневность');
    assert.equal(await card.locator('.story-favorite').count(), 1);
    assert.match(await card.locator('.story-card-stats').textContent(), /27.*4\.8/, 'chaptered card carries the same rating/view statistics');
    const sizes = await page.locator('#stories .story-card').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return [r.width, r.height]; }));
    assert.ok(sizes.every(([w, h]) => Math.abs(w - sizes[0][0]) < 1 && Math.abs(h - sizes[0][1]) < 1), 'all card types use the same size');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'catalogue overflow');
    await page.screenshot({ path: `/tmp/unified-catalog-${browserType.name()}-${language}-${width}.png`, fullPage: true });

    await page.locator('#story-search').fill('любила');
    assert.equal(await page.locator('#stories .story-card-link').count(), 1, 'search includes collection description');
    await card.locator('.story-favorite').click();
    await page.locator('#engagement-modal:not(.hidden)').waitFor();
    assert.equal(await card.locator('.story-favorite').getAttribute('aria-pressed'), 'false');
    await page.keyboard.press('Escape'); favoriteFails = false;
    await card.locator('.story-favorite').click();
    await page.waitForFunction(() => document.querySelector('#stories .story-favorite').getAttribute('aria-pressed') === 'true');
    assert.deepEqual(writes.at(-1), { path: '/api/catalog/collections/cat/favorite', body: { favorite: true } });
    await page.locator('#story-search').fill('');
    await chooseSort('favorites');
    assert.equal(await page.locator('#stories .story-card-link').count(), 1);
    await card.locator('.story-card-link').click();
    await page.locator('#collection-screen:not(.hidden)').waitFor();
    assert.equal(await page.locator('#story-detail-title').textContent(), cat.title);
    assert.match(await page.locator('#story-detail-byline').textContent(), /Автор Миры/);
    assert.match(await page.locator('#story-detail-meta').textContent(), /27/);
    assert.equal(await page.locator('#story-interactions button').count(), 5);
    await page.locator('#story-interactions button').nth(4).click();
    await page.locator('#story-interaction-status').filter({ hasText: /.+/ }).waitFor();
    assert.equal(cat.myRating, null, 'failed vote must not be shown as saved');
    ratingFails = false;
    await page.locator('#story-interactions button').nth(4).click();
    await page.waitForFunction(() => document.querySelectorAll('#story-interactions button')[4].getAttribute('aria-pressed') === 'true');
    assert.ok(writes.some(w => w.path === '/api/catalog/collections/cat/rating' && w.body.score === 5));
    await page.locator('#story-detail-favorite button').click();
    await page.waitForFunction(() => document.querySelector('#story-detail-favorite button').getAttribute('aria-pressed') === 'false');
    await page.locator('#story-detail-back').click();
    await page.locator('#story-screen:not(.hidden)').waitFor();
    assert.equal(await page.locator('#stories .story-card-link').count(), 0, 'contents favorite changes must refresh the common catalogue');
    await chooseSort('default');
    // Reopening the same work while a favorite is pending must keep both its
    // data and all replacement buttons synchronized with the completed write.
    let releaseFavorite;
    favoriteGate = new Promise(resolve => { releaseFavorite = resolve; });
    await page.locator(`#stories a[href="/collections/${cat.key}"]`).click();
    const favoriteRequest = page.waitForRequest(request => request.url().endsWith('/api/catalog/collections/cat/favorite'));
    await page.locator('#story-detail-favorite button').click(); await favoriteRequest;
    await page.locator('#story-detail-back').click();
    await page.locator(`#stories a[href="/collections/${cat.key}"]`).click();
    await page.locator('#story-detail-screen:not(.hidden)').waitFor();
    assert.equal(await page.locator('#story-detail-favorite button').isDisabled(), true);
    releaseFavorite(); favoriteGate = null;
    await page.waitForFunction(() => document.querySelector('#story-detail-favorite button').getAttribute('aria-pressed') === 'true');
    await page.locator('#story-detail-favorite button').click();
    await page.waitForFunction(() => document.querySelector('#story-detail-favorite button').getAttribute('aria-pressed') === 'false');
    assert.deepEqual(writes.at(-1), { path: '/api/catalog/collections/cat/favorite', body: { favorite: false } });
    await page.locator('#story-detail-back').click();
    const collision = page.locator('#stories .story-card').filter({ has: page.locator('a[href="/collections/shared"]') });
    await collision.locator('.story-favorite').click();
    await page.waitForFunction(() => document.querySelector('a[href="/collections/shared"]').closest('article').querySelector('.story-favorite').getAttribute('aria-pressed') === 'true');
    assert.equal(await page.locator('#stories .story-card').filter({ has: page.locator('a[href="/history/shared"]') }).locator('.story-favorite').getAttribute('aria-pressed'), 'false', 'equal slugs in two domains are different favorites');
    await chooseSort('title');
    const titles = await page.locator('#stories .story-card-info strong').allTextContents();
    assert.deepEqual(titles, [...titles].sort((a, b) => a.localeCompare(b, language)));
    await page.goto(origin + '/'); await page.locator('#home-stories .story-card-link').first().waitFor();
    assert.equal(await page.locator('#home-stories a[href^="/collections/"]').count(), 2, 'signed-in home uses the same complete catalogue');
    assert.match(await page.locator('#home-stories .engagement-card').filter({ has: page.locator(`a[href="/collections/${cat.key}"]`) }).locator('.story-card-stats').textContent(), /27.*5\.0/);
    deferView = true; startFails = true;
    await page.goto(origin + '/collections/' + cat.key);
    await deferredViewSeen;
    await page.getByRole('button', { name: language === 'en' ? 'Start' : 'Начать', exact: true }).click();
    await page.locator('#story-reading-status').filter({ hasText: /Ошибка|failed/ }).waitFor();
    assert.ok(await page.locator('#story-detail-screen').isVisible(), 'failed start keeps the story and shows retry feedback');
    startFails = false;
    await page.getByRole('button', { name: language === 'en' ? 'Start' : 'Начать', exact: true }).click();
    await page.locator('#scene-screen:not(.hidden)').waitFor();
    assert.ok(writes.some(w => w.path === '/api/collection-runs/run/start' && w.body.targetId === 'chapter-1'));
    assert.equal(writes.filter(w => w.path === '/api/collections/cat/runs').length, 1, 'retry after first-chapter failure reuses the created run');
    const attempts = writes.filter(w => w.path === '/api/collection-runs/run/start');
    assert.equal(attempts[0].body.requestId, attempts[1].body.requestId, 'uncertain chapter start retains idempotency identity');
    const viewResponse = page.waitForResponse(response => response.url().endsWith('/api/catalog/collections/cat/view'));
    releaseView(); await viewResponse;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('#story-detail-screen').isVisible(), false, 'late view response cannot reopen a story after reading starts');
    assert.deepEqual(errors, []);
    console.log(`${browserType.name()} ${language} ${width}: unified cards, covers, search/sort/favorites, failure recovery, route and chapter start passed`);
  } finally { await browser.close(); }
}
(async () => {
  for (const language of ['ru', 'en']) for (const width of [320, 390, 768, 1440]) await check(chromium, language, width);
  if (fs.existsSync(webkit.executablePath())) await check(webkit, 'ru', 390);
})().catch(error => { console.error(error); process.exit(1); });
