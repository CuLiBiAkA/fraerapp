// Local fixture only: all browser requests are intercepted; no real auth, bot or API traffic.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const output = process.env.CHECK_LEGAL_OUTPUT || '/tmp/fraer-legal-audit';
const origin = 'https://fraerapp.ru';
const documents = ['privacy-policy', 'terms', 'personal-data-consent'];
const version = fs.readFileSync(path.join(root, 'frontend/legal-config.js'), 'utf8').match(/policyVersion:\s*"([^"]+)"/)[1];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const javaScriptEnabled of [true, false]) {
      for (const width of [1440, 768, 390, 320]) {
        for (const language of ['ru', 'en']) {
          const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled });
          try {
            await context.addInitScript(lang => localStorage.setItem('fraerapp.language', lang), language);
            await context.route('**/*', route => {
              const url = new URL(route.request().url());
              if (url.origin !== origin) return route.abort();
              if (url.pathname.startsWith('/auth/')) return route.fulfill({ status: 401, json: {} });
              if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { notifications: [], unreadCount: 0 } });
              const file = path.resolve(root, 'frontend', `.${url.pathname}`);
              if (!file.startsWith(path.join(root, 'frontend') + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
                return route.fulfill({ status: 404, body: '' });
              }
              return route.fulfill({ path: file });
            });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            for (const name of documents) {
              const label = `${name} ${width}px ${language} JS=${javaScriptEnabled}`;
              await page.goto(`${origin}/${name}.html`);
              if (javaScriptEnabled) await page.locator('#site-controls').waitFor();
              await page.evaluate(() => document.fonts.ready);
              assert.equal(await page.locator('main').count(), 1, `${label}: main`);
              assert.equal(await page.locator('h1').count(), 1, `${label}: H1`);
              assert.equal(await page.locator('main').getAttribute('aria-labelledby'), 'legal-title');
              assert.equal(await page.locator('[data-legal="policyVersion"]').textContent(), version, `${label}: document version`);
              assert.equal(await page.locator('.legal-nav').getAttribute('aria-label'), 'Юридические документы');
              assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: overflow`);
              for (const href of await page.locator('main a').evaluateAll(links => links.map(link => link.getAttribute('href')))) {
                if (href.startsWith('mailto:')) assert.match(href, /^mailto:[^\s@]+@[^\s@]+$/);
                else assert.ok(href.startsWith('/') && !href.startsWith('//'), `${label}: internal document link`);
              }
              if (name === 'terms') {
                assert.equal(await page.locator('#contacts').count(), 1, `${label}: Support anchor`);
                assert.ok(await page.locator('#contacts + p a[href^="mailto:"]').count(), `${label}: operator contact`);
              }
              if (language === 'ru' && [320, 1440].includes(width)) {
                await page.screenshot({ path: path.join(output, `${name}-${width}-js-${javaScriptEnabled}.png`), fullPage: true });
              }
              await page.locator('.legal-skip').focus();
              await page.keyboard.press('Enter');
              assert.equal(await page.evaluate(() => document.activeElement.id), 'legal-content', `${label}: skip-link focus`);
              await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; document.activeElement.blur(); });
              assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: 200% text overflow`);
              results.push({ document: name, width, language, javaScriptEnabled, textZoom: '100% and 200%', passed: true });
            }
            assert.deepEqual(errors, [], 'page errors');
            console.log(`PASS: 3 legal pages, ${width}px, ${language}, JavaScript ${javaScriptEnabled ? 'on' : 'off'}, 100%/200% text`);
          } finally { await context.close(); }
        }
      }
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ version, network: 'isolated local fixtures', results }, null, 2));
    console.log(`Legal audit passed: ${results.length} page configurations. Evidence: ${output}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
