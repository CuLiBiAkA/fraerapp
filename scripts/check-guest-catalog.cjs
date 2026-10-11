// Local-only guest navigation, role geometry and readable mobile catalogue checks.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const origin = 'https://guest-catalog.test';
const demoKeys = ['kak_shodit_v_tualet_pravilno', 'kak_pogladit_kota_ne_ubiv', 'night_train'];
const stories = demoKeys.map((key, i) => ({ key, slug: key,
  title: ['Как сходить в туалет правильно', 'Как погладить кота не убив', 'Ночной поезд: история с очень длинным названием'][i],
  coverUrl: '/assets/platform.svg', completionStatus: 'completed', description: 'Демонстрационная история',
}));

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 390, 768, 1440]) {
      const geometry = [];
      for (const role of ['guest', 'player', 'author', 'moderator']) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        const errors = [], requests = [];
        await context.addInitScript(() => localStorage.setItem('fraerapp.cookieConsent', 'accepted'));
        await context.route('**/*', async route => {
          const req = route.request(), url = new URL(req.url()), p = url.pathname;
          requests.push(p);
          const send = (json, status = 200) => route.fulfill({ json, status });
          if (url.origin !== origin) return route.abort();
          if (p === '/auth/me') return role === 'guest' ? send({}, 401) : send({ email: 'fixture@example.test', roles: [role] });
          if (p === '/auth/refresh') return send({}, 401);
          if (p === '/api/account') return send({ unreadCount: 0, notifications: [] });
          if (p === '/api/catalog/stories') return send(stories);
          if (p.startsWith('/api/catalog/stories/')) return send(stories.find(s => p.endsWith(s.slug)) || stories[0]);
          if (p.startsWith('/api/catalog/engagement/')) return send({});
          if (p.startsWith('/api/') || p.startsWith('/auth/')) return send([]);
          let file = path.join(root, 'frontend', p.slice(1));
          if (p === '/' || p.startsWith('/history')) file = path.join(root, 'frontend/index.html');
          return fs.existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404, body: '' });
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(origin);
        await page.locator('#home-stories .is-active').waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        geometry.push(await page.evaluate(() => ['.home-copy', '.home-actions', '#home-stories .is-active'].map(selector => {
          const rect = document.querySelector(selector).getBoundingClientRect();
          return [rect.x, rect.y, rect.width, rect.height];
        })));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (role === 'guest') {
          await page.locator('#home-stories .is-active .story-card-link').click();
          await page.locator('#demo-welcome-modal:not(.hidden)').waitFor();
          await page.locator('#demo-welcome-continue').click();
          await page.locator('#story-screen:not(.hidden)').waitFor();
          assert.equal(new URL(page.url()).pathname, '/history');
          assert.ok(await page.locator('#story-detail-screen').isHidden());
          assert.ok(await page.locator('#auth-modal').isHidden());
          assert.equal(await page.locator('#stories .story-card').count(), 3);
          await page.locator('#stories .story-card-link').first().click();
          await page.locator('#story-detail-screen:not(.hidden)').waitFor();
          assert.ok(await page.locator('#demo-welcome-modal').isHidden(), 'Continue must not trap guests in the welcome dialog again');
          await page.locator('#story-detail-action').click();
          await page.locator('#auth-modal:not(.hidden)').waitFor();
          assert.ok(!requests.some(p => p.startsWith('/api/sessions')), 'Reading permissions remain enforced');
          await page.goto(origin);
          await page.locator('#home-read').click();
          await page.locator('#demo-welcome-modal:not(.hidden)').waitFor();
          await page.locator('#demo-welcome-register').click();
          await page.locator('#auth-modal:not(.hidden)').waitFor();
          assert.ok(!requests.includes('/api/catalog/collections'), 'Guests never load private collections');
        }
        await page.goto(origin + '/history');
        await page.locator('#story-screen:not(.hidden)').waitFor();
        assert.equal(await page.locator('#stories .story-card').count(), 3);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (width <= 390) {
          const labels = await page.locator('#stories .story-card-info strong').evaluateAll(nodes => nodes.map(node => {
            const style = getComputedStyle(node);
            return { size: parseFloat(style.fontSize), clamp: style.webkitLineClamp, clipped: node.scrollHeight > node.clientHeight + 1 };
          }));
          assert.ok(labels.every(label => label.size >= 18 && label.clamp === 'none' && !label.clipped), 'Mobile story titles must be large and complete');
        }
        if (role === 'guest') await page.screenshot({ path: `/tmp/fraerapp-guest-catalog-${width}.png`, fullPage: true });
        assert.deepEqual(errors, []);
        await context.close();
      }
      for (const roleGeometry of geometry.slice(1)) for (let i = 0; i < geometry[0].length; i++) {
        assert.ok(roleGeometry[i].every((value, j) => Math.abs(value - geometry[0][i][j]) <= 1), `Homepage geometry differs by role at ${width}px`);
      }
      console.log(`${width}px: guest three-demo journey, register, roles and mobile title checks passed`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
