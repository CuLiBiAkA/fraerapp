// Isolated browser regression checks. All requests use local files or synthetic data.
// Text enlargement doubles computed font sizes; this is not a browser/OS zoom emulation.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const origin = 'https://ui-audit.test';
const output = process.env.FRONTEND_AUDIT_OUTPUT || '/tmp/fraerapp-frontend-audit';
const widths = [320, 390, 768, 1440];
const cases = [
  { name: 'home', url: '/', ready: '#login-screen:not(.hidden)' },
  { name: 'library', url: '/history', ready: '#story-screen:not(.hidden)' },
  { name: 'reader', url: '/read/fixture', ready: '#scene-screen:not(.hidden)' },
  { name: 'subscription', url: '/subscription/', ready: '#subscribe:enabled' },
  { name: 'admin', url: '/auth/admin', ready: '.admin-user' },
];

async function fixture(context) {
  const user = { id: 'audit-user', email: 'reader.with.a.long.name@example.test', roles: ['player', 'author', 'admin'] };
  const stories = Array.from({ length: 6 }, (_, i) => ({
    key: 'audit-story-' + i, slug: 'audit-story-' + i,
    title: i ? 'История ' + i : 'История с длинным названием, которое важно прочитать полностью',
    description: 'История для проверки интерфейса', coverUrl: '/assets/platform.svg', authorName: 'Автор',
  }));
  const state = {
    sessionId: 'fixture', story: { key: 'audit-story', title: 'История' },
    scene: { id: 'start', title: 'Начало', backgroundUrl: '/assets/platform.svg',
      text: 'Дверь приоткрылась, и в комнату заглянула кошка. В коридоре послышались шаги. Ты решил подождать и посмотреть, что произойдёт дальше.',
      choices: [{ id: 'a', label: 'Медленно протянуть руку и тихо позвать кошку к себе' },
        { id: 'b', label: 'Подождать и посмотреть, что будет дальше' },
        { id: 'c', label: 'Приоткрыть дверь и заглянуть в коридор' }] },
    statsVariables: { trust: 6, cat_mood: 2, noise: 0, scratches: 0, treats: 2, distance: 3 }, status: 'active',
  };
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), pathname = url.pathname;
    const send = (json, status = 200) => route.fulfill({ json, status });
    if (url.origin !== origin) return route.abort();
    if (pathname === '/auth/me') return send(user);
    if (pathname === '/auth/refresh') return send({}, 401);
    if (pathname === '/api/account') return send({ avatar: 'fairy', unreadCount: 1, notifications: [
      { id: 'notice', kind: 'message', message: 'Новая глава уже доступна для чтения.', unread: true, createdAt: '2026-10-01T12:00:00Z' },
    ] });
    if (pathname === '/api/catalog/stories') return send(stories);
    if (pathname === '/api/catalog/engagement') return send([]);
    if (pathname === '/api/sessions/fixture/state') return send(state);
    if (pathname === '/auth/subscription') return send({
      plan: { id: 'author-monthly', months: 1, mode: 'test', checkoutEnabled: true, priceMinor: 13900, chargeMinor: 0, currency: 'RUB' },
      subscription: null, manualAuthor: false, authorAccess: false, orders: [], events: [],
    });
    if (pathname === '/auth/admin/users') return send({ page: 0, size: 20, totalElements: 1, totalPages: 1, items: [
      { ...user, blocked: false, sessions: 4, activeSessions: 2, passkeys: 1, auditEvents: 5,
        createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z' },
    ] });
    if (pathname === '/auth/admin') return route.fulfill({ path: path.join(root, 'auth-service/src/main/resources/admin.html') });
    if (pathname.startsWith('/auth/') || pathname.startsWith('/api/')) return send([]);
    let file = path.join(root, pathname.startsWith('/builder/') ? 'story-builder' : 'frontend',
      pathname.startsWith('/builder/') ? pathname.slice(9) : pathname.slice(1));
    if (['/', '/history', '/read/fixture'].includes(pathname)) file = path.join(root, 'frontend/index.html');
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ path: file });
  });
}

async function enlargeText(page, selector = 'body *') {
  await page.evaluate(selector => {
    const sizes = [...document.querySelectorAll(selector)].map(node => [node, parseFloat(getComputedStyle(node).fontSize)]);
    for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
  }, selector);
  // Let ResizeObserver-driven header offsets settle before measuring geometry.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function inspectLayout(page) {
  return page.evaluate(() => {
    const visible = node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden';
    const describe = node => node.id || node.className || node.tagName;
    const controls = [...document.querySelectorAll('#site-controls > a, #site-controls > button, #site-controls > form')].filter(visible);
    const collisions = [];
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i].getBoundingClientRect(), b = controls[j].getBoundingClientRect();
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1)
        collisions.push([describe(controls[i]), describe(controls[j])]);
    }
    const crampedText = [...document.querySelectorAll('h1, h2, .story-card-info strong, .story-genre, .story-card-stats')]
      .filter(visible).filter(node => {
        const style = getComputedStyle(node), height = parseFloat(style.lineHeight), size = parseFloat(style.fontSize);
        return Number.isFinite(height) && height + 1 < size;
      }).map(node => ({ element: describe(node), text: node.textContent.trim().slice(0, 60) }));
    const brokenImages = [...document.images].filter(visible).filter(node => !node.complete || !node.naturalWidth).map(node => node.getAttribute('src'));
    const header = document.querySelector('#site-controls')?.getBoundingClientRect();
    const stats = document.body.classList.contains('is-reading') ? document.querySelector('#scene-stats')?.getBoundingClientRect() : null;
    return { overflow: document.documentElement.scrollWidth - innerWidth, collisions, crampedText, brokenImages,
      statsOverlap: Boolean(header && stats && stats.top + 1 < header.bottom) };
  });
}

async function checkProfileKeyboard(page, item) {
  await page.goto(origin + item.url);
  await page.locator(item.ready).waitFor();
  await page.locator('[data-site-account].account-unread').waitFor();
  const opener = page.locator('[data-site-account]');
  await opener.click();
  await page.locator('#profile-modal:not(.hidden)').waitFor();
  const visited = [];
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => ({ id: document.activeElement.id,
      inside: Boolean(document.activeElement.closest('#profile-modal')) }));
    assert.ok(focus.inside, `Profile Tab focus escaped the dialog after ${visited.join(', ')}; now ${focus.id || '(unnamed element)'}`);
    visited.push(focus.id);
  }
  assert.ok(visited.includes('profile-notification-title'), 'Notifications disclosure must be reachable in the profile Tab loop');
  await page.locator('#profile-notification-title').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#profile-notification-panel').evaluate(node => node.open), true);
  await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => Boolean(document.activeElement.closest('#profile-notifications'))), 'Notification actions must be keyboard reachable');
  await enlargeText(page, '#profile-modal *');
  assert.ok(await page.locator('#profile-modal .modal-card').evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'Profile dialog overflows with enlarged text');
  await page.keyboard.press('Escape');
  assert.ok(await opener.evaluate(node => node === document.activeElement), 'Escape must restore profile opener focus');
}

async function checkLanguageSelection(page, initialLanguage) {
  await page.goto(origin + '/history');
  await page.locator('#story-screen:not(.hidden)').waitFor();
  await page.locator('[data-site-account].account-unread').waitFor();
  await page.locator('[data-site-settings]').click();
  await page.locator('#settings-modal:not(.hidden)').waitFor();
  const otherLanguage = initialLanguage === 'ru' ? 'en' : 'ru';
  // Exercise active-language clicks as well as both directions, without navigation/reload.
  for (const language of [initialLanguage, otherLanguage, otherLanguage, initialLanguage, initialLanguage]) {
    await page.locator('#modal-lang-' + language).click();
    const labels = await page.evaluate(() => {
      const nav = document.querySelector('#site-controls');
      const settings = nav.querySelector('[data-site-settings]'), account = nav.querySelector('[data-site-account]');
      return { documentLanguage: document.documentElement.lang, savedLanguage: localStorage.getItem('fraerapp.language'),
        navLanguage: nav.lang, navLabel: nav.getAttribute('aria-label'), home: nav.querySelector('.site-home span').textContent,
        settingsLabel: settings.getAttribute('aria-label'), settingsTitle: settings.title,
        accountLabel: account.getAttribute('aria-label'), accountTitle: account.title,
        settingsHeading: document.querySelector('#settings-modal-title').textContent,
        profileHeading: document.querySelector('#profile-modal-title').textContent,
        closeLabel: document.querySelector('#settings-modal-close').getAttribute('aria-label'),
        ruPressed: document.querySelector('#modal-lang-ru').getAttribute('aria-pressed'),
        enPressed: document.querySelector('#modal-lang-en').getAttribute('aria-pressed') };
    });
    const ru = language === 'ru';
    assert.deepEqual(labels, {
      documentLanguage: language, savedLanguage: language, navLanguage: language,
      navLabel: ru ? 'Настройки и аккаунт' : 'Settings and account', home: ru ? 'На главную' : 'Home',
      settingsLabel: ru ? 'Настройки' : 'Settings', settingsTitle: ru ? 'Настройки' : 'Settings',
      accountLabel: ru ? 'Аккаунт: 1 непрочитанных уведомлений' : 'Account: 1 unread notifications',
      accountTitle: ru ? 'Аккаунт: 1 непрочитанных уведомлений' : 'Account: 1 unread notifications',
      settingsHeading: ru ? 'Настройки' : 'Settings', profileHeading: ru ? 'Аккаунт' : 'Account',
      closeLabel: ru ? 'Закрыть' : 'Close', ruPressed: String(ru), enPressed: String(!ru),
    }, `Selecting ${language} must keep that language active and update visible/accessibility labels immediately`);
    assert.ok(await page.locator('#settings-modal').isVisible(), 'SPA language changes must keep the active settings dialog open');
  }
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('[data-site-settings]').evaluate(node => node === document.activeElement), 'Language dialog restores its opener');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let label = 'startup', page;
  try {
    for (const language of ['ru', 'en']) for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(language => {
        localStorage.setItem('fraerapp.language', language);
        localStorage.setItem('fraerapp.cookieConsent', 'accepted');
      }, language);
      await fixture(context);
      page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const item of cases) {
        label = `${item.name}-${language}-${width}`;
        await page.goto(origin + item.url);
        await page.locator(item.ready).waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => [...document.images].filter(node => node.getClientRects().length).every(node => node.complete));
        for (const scale of [1, 2]) {
          label = `${item.name}-${language}-${width}-text${scale}`;
          if (scale === 2) await enlargeText(page);
          const layout = await inspectLayout(page);
          assert.ok(layout.overflow <= 1, `${label}: horizontal overflow ${layout.overflow}px`);
          assert.deepEqual(layout.collisions, [], `${label}: overlapping header controls`);
          assert.deepEqual(layout.crampedText, [], `${label}: line height clips enlarged text`);
          assert.deepEqual(layout.brokenImages, [], `${label}: broken visible images`);
          assert.equal(layout.statsOverlap, false, `${label}: reader statistics overlap header`);
        }
      }
      for (const item of cases.filter(item => ['home', 'subscription'].includes(item.name))) {
        label = `profile-${item.name}-${language}-${width}`;
        await checkProfileKeyboard(page, item);
      }
      label = `language-${language}-${width}`;
      await checkLanguageSelection(page, language);
      assert.deepEqual(errors, [], `${label}: browser exceptions`);
      console.log(`${language} ${width}: five pages at normal/200% text, header geometry, images, home/subscription profile keyboard and idempotent language selection passed`);
      await context.close();
      page = null;
    }
  } catch (error) {
    if (page && !page.isClosed()) {
      fs.mkdirSync(output, { recursive: true });
      const screenshot = path.join(output, `${label}.png`);
      await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' }).catch(() => {});
      console.error('Failure screenshot:', screenshot);
    }
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
