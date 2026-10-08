const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 390, 320]) {
      for (const lang of ['ru', 'en']) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        let notices = [
          { id: 'unread', kind: 'admin', message: 'New notification', unread: true },
          { id: 'read', kind: 'admin', message: 'Read notification', unread: false }
        ];
        let fail = false, hold = false, release, started;
        const snapshot = () => ({ avatar: 'fairy', unreadCount: notices.filter(n => n.unread).length, notifications: structuredClone(notices) });
        await context.route('https://notifications.test/**', async route => {
          const url = new URL(route.request().url());
          if (url.pathname === '/api/account') {
            const data = snapshot();
            if (hold) { hold = false; started(); await new Promise(resolve => { release = resolve; }); }
            return route.fulfill({ json: data });
          }
          if (url.pathname.startsWith('/api/account/notifications')) {
            if (fail) return route.fulfill({ status: 503, json: {} });
            if (url.pathname.endsWith('/read')) {
              assert.equal(route.request().method(), 'POST');
              const id = url.pathname.split('/').at(-2);
              notices = notices.map(n => n.id === id ? {...n, unread: false} : n);
              return route.fulfill({ json: {saved: true} });
            }
            assert.equal(route.request().method(), 'DELETE');
            if (url.pathname === '/api/account/notifications') notices = [];
            else notices = notices.filter(n => n.id !== decodeURIComponent(url.pathname.split('/').pop()));
            return route.fulfill({ json: snapshot() });
          }
          if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `
            <html lang="${lang}"><meta name="viewport" content="width=device-width,initial-scale=1">
            <link rel="stylesheet" href="/account-ui.css"><link rel="stylesheet" href="/account-dialogs.css">
            <style>*{box-sizing:border-box}.hidden{display:none!important}</style>
            <body style="background:#684e86;color:#fee3e2;margin:16px">
            <button id="home-profile" data-site-account><img alt=""></button>
            <script type="module">
            import {createAccountUI} from '/account-ui.js';
            import {mountAccountDialogs} from '/account-dialogs.js';
            mountAccountDialogs();
            document.querySelector('#profile-modal').classList.remove('hidden');
            document.querySelector('#profile-notification-panel').open = true;
            window.ui = createAccountUI({email:()=> 'fixture@example.test', language:()=> '${lang}', request: async (url,options) => {
              const response = await fetch(url,options); if (!response.ok) throw Error('Request failed'); return response.json();
            }}); window.ui.refresh();
            </script></body></html>` });
          const file = path.join(process.cwd(), 'frontend', url.pathname.slice(1));
          if (fs.existsSync(file)) return route.fulfill({ path: file });
          return route.fulfill({ status: 404, body: '' });
        });
        const page = await context.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.goto('https://notifications.test/');
        const rows = page.locator('.account-notice');
        await rows.first().waitFor();
        const remove = () => page.getByRole('button', { name: lang === 'ru' ? 'Удалить' : 'Delete', exact: true });
        const clear = () => page.getByRole('button', { name: lang === 'ru' ? 'Очистить все' : 'Clear all', exact: true });
        assert.equal(await remove().count(), 2, 'Both read and unread notices can be removed');
        fail = true;
        await remove().first().click();
        await page.waitForFunction(() => document.querySelector('#profile-account-status').textContent.length > 0);
        assert.equal(await rows.count(), 2, 'Failure preserves notifications');
        assert.equal(await remove().first().isEnabled(), true, 'Retry remains available');
        fail = false;
        hold = true;
        const pending = new Promise(resolve => { started = resolve; });
        await page.evaluate(() => { window.refreshPending = window.ui.refresh(true); });
        await pending;
        await remove().first().click();
        await page.waitForFunction(() => document.querySelectorAll('.account-notice').length === 1);
        release();
        await page.evaluate(() => window.refreshPending);
        assert.equal(await rows.count(), 1, 'Old polling response cannot resurrect deleted notices');
        assert.equal(await page.locator('.account-unread').count(), 0, 'Unread badge clears');
        await page.reload(); await rows.first().waitFor();
        assert.equal(await rows.count(), 1, 'Deletion persists after reload');
        fail = true;
        await clear().click();
        await page.waitForFunction(() => document.querySelector('#profile-account-status').textContent.length > 0);
        assert.equal(await rows.count(), 1, 'Failed clear preserves the list');
        fail = false;
        await clear().click();
        await page.getByText(lang === 'ru' ? 'Пока нет уведомлений' : 'No notifications yet', { exact: true }).waitFor();
        assert.equal(await clear().count(), 0, 'No clear action for an empty inbox');
        await page.reload();
        await page.getByText(lang === 'ru' ? 'Пока нет уведомлений' : 'No notifications yet', { exact: true }).waitFor();
        notices.push({ id: 'new', kind: 'admin', message: 'A later notification', unread: true });
        await page.evaluate(() => window.ui.refresh(true));
        assert.equal(await rows.count(), 1, 'New notifications remain enabled');
        await page.getByRole('button', {name: lang === 'ru' ? 'Прочитано' : 'Mark as read', exact: true}).click();
        await page.waitForFunction(() => !document.querySelector('.account-unread'));
        assert.equal(await rows.count(), 1, 'Mark as read keeps the notification');
        assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => {
          const rect = el.getBoundingClientRect(); return rect.width && (rect.right > innerWidth + 1 || rect.left < -1);
        }).map(el => el.id || el.tagName)), [], 'No horizontal overflow');
        assert.deepEqual(errors, []);
        if (lang === 'ru' && width === 390) await page.screenshot({ path: '/tmp/fraerapp-notifications.png' });
        console.log(`${width}px ${lang}: deletion, clear, retry, stale polling, persistence, new notices passed`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
