const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const origin = 'https://fraerapp.ru';
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'story-builder/scenarios/koshka-i-otkrytye-dveri.package.json')));
const live = process.env.CHECK_LIVE_CONTENTS === '1';
const snapshot = live ? JSON.parse(fs.readFileSync('/private/tmp/fraer-cat-contents-data.json')) : null;
const cat = snapshot?.catDetail || { ...pkg.collections[0], id: 'cat', collectionId: 'cat', items: pkg.collections[0].items.map((item, i) => ({ ...item, id: `chapter-${i}`, kind: 'scenario', title: item.label, allowIndependentStart: i === 0 })) };
const runId = '45c049f5-27ee-4f90-9a6f-512754ea5c09';
const completed = { id: runId, completionStatus: 'completed', completedCount: 3, availableCount: 3, items: cat.items.map((item, i) => ({ ...item, sessionId: `saved-${i}`, status: 'finished' })) };

(async () => {
  const browser = await chromium.launch();
  try {
    for (const language of ['ru', 'en']) for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await context.addInitScript(language => { localStorage.setItem('fraerapp.language', language); localStorage.setItem('fraerapp.cookieConsent', 'accepted'); }, language);
      let hasRun = false;
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url()), p = url.pathname;
        const send = json => route.fulfill({ json });
        if (url.origin !== origin || req.method() !== 'GET') return route.abort();
        if (p === '/auth/me') return send({ email: 'reader@example.test', roles: ['player'] });
        if (p === '/api/account') return send({ unreadCount: 0, notifications: [] });
        if (p === `/api/catalog/collections/${cat.key}`) return send(cat);
        if (p === `/api/collections/${cat.collectionId}/runs`) return send(hasRun ? snapshot?.runs || [completed] : []);
        if (p.startsWith('/api/collection-runs/')) return send(snapshot?.runDetails.find(run => run.id === p.split('/').at(-1)) || completed);
        if (p.startsWith('/api/') || p.startsWith('/auth/')) return send([]);
        if (live) return route.continue();
        let file = path.join(root, p.startsWith('/builder/') ? 'story-builder' : 'frontend', p.startsWith('/builder/') ? p.slice(9) : p.slice(1));
        if (p.startsWith('/collections/')) file = path.join(root, 'frontend/index.html');
        if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
        return fs.existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404 });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${origin}/collections/${cat.key}`);
      const screen = page.locator('#collection-screen');
      await screen.getByRole('button', { name: language === 'en' ? 'Start' : 'Начать', exact: true }).waitFor();
      assert.equal(await page.locator('.top-actions').isVisible(), false, 'the old menu must not overlap shared navigation');
      assert.match(await page.locator('body').evaluate(node => getComputedStyle(node).backgroundImage), /cosmos/, 'contents share the library background');
      for (const chapter of cat.items) assert.equal(await screen.getByText(chapter.label, { exact: true }).count(), 1);
      hasRun = true;
      await page.reload();
      await screen.getByText(language === 'en' ? 'Story completed.' : 'История пройдена.', { exact: true }).waitFor();
      await page.screenshot({ path: `/private/tmp/story-contents-${live ? 'published' : 'local'}-${language}-${width}.png`, fullPage: true });
      for (const chapter of cat.items) assert.equal(await screen.getByText(chapter.label, { exact: true }).count(), 1, 'each chapter appears once after a run exists');
      assert.doesNotMatch(await screen.locator('select').textContent(), /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9-]{23}/i, 'internal run IDs must not appear in labels');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      console.log(`${live ? 'published files + real snapshot' : 'local'} ${language} ${width}: fresh/returning reader, one chapter list, readable run labels, no overflow/errors`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
