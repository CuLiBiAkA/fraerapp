// Local files and synthetic API only; exercises real published prose without reader writes.
const {chromium} = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), origin = 'https://fraerapp.ru';
const district = JSON.parse(fs.readFileSync(path.join(root, 'story-builder/scenarios/kto-ty-po-zhizni.json')));
const mira = [1, 2, 3].flatMap(n => JSON.parse(fs.readFileSync(path.join(root, `story-builder/scenarios/koshka-i-otkrytye-dveri-${n}.json`))).scenes);
const longest = scenes => [...scenes].sort((a, b) => b.text.length - a.text.length)[0];
const crowded = [...district.scenes].sort((a, b) => b.choices.length - a.choices.length)[0];
const representative = [district.scenes[0], longest(district.scenes), crowded, district.scenes.find(s => s.ending), longest(mira), mira.find(s => s.ending)];
const normalized = value => value.replace(/\s/g, '');
let currentPage;

async function install(context, fixture) {
  await context.addInitScript(() => localStorage.setItem('fraerapp.cookieConsent', 'accepted'));
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname;
    if (url.origin !== origin) return route.abort();
    const send = (json, status = 200) => route.fulfill({json, status});
    if (p === '/auth/me') return send({email: 'reader@example.test', roles: ['player', 'author']});
    if (p === '/api/account') return send({unreadCount: 0, notifications: []});
    if (p === '/api/author/home') return send({stories: [{storyId: 'chapter', key: fixture.doc?.key, title: fixture.doc?.title, generation: 1, draftRevision: 1, reviewState: 'draft', visibility: 'private'}]});
    if (p === '/api/sessions/fixture/state') return send(fixture.state());
    if (p === '/api/sessions/fixture/choice') {
      fixture.writes.push(req.postDataJSON());
      return fixture.fail ? send({message: 'Retry this choice'}, 503) : send(fixture.state(true));
    }
    if (p === '/api/author/stories/chapter') return send({storyId: 'chapter', key: fixture.doc.key, title: fixture.doc.title,
      generation: 1, draftRevision: 1, reviewState: 'draft', visibility: 'private', draftDocument: fixture.doc});
    if (p.startsWith('/api/') || p.startsWith('/auth/')) return send([]);
    let file = path.join(root, p.startsWith('/builder/') ? 'story-builder' : 'frontend', p.startsWith('/builder/') ? p.slice(9) : p.slice(1));
    if (p === '/' || p.startsWith('/read/')) file = path.join(root, 'frontend/index.html');
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    return fs.existsSync(file) ? route.fulfill({path: file}) : route.fulfill({status: 404});
  });
}
function fixtureFor(scene) {
  return {scene, writes: [], fail: false, state(finished = false) {
    return {sessionId: 'fixture', status: finished || this.scene.ending ? 'finished' : 'active',
      story: {key: district.key, title: district.title}, statsVariables: {money: 500, respect: finished ? 11 : 10},
      scene: finished ? {id: 'completed', title: 'Готово', text: 'Поступок сделан один раз.', choices: [], ending: {title: 'Конец'}}
        : {...this.scene, backgroundUrl: district.assets.find(a => a.id === this.scene.background)?.url || '/assets/platform.svg'}};
  }};
}
async function geometry(page, label) {
  const dimensions = await page.evaluate(() => {
    const panel = document.querySelector('.story-panel'), box = panel.getBoundingClientRect();
    const buttons = [...document.querySelectorAll('#choices button, #reader-pages button')].filter(n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden');
    return {width: innerWidth, height: innerHeight, scroll: document.documentElement.scrollHeight,
      horizontal: document.documentElement.scrollWidth, bottom: box.bottom, top: box.top,
      panelClient: panel.clientHeight, panelScroll: panel.scrollHeight,
      obscured: buttons.some(n => {const r = n.getBoundingClientRect(); return r.top < box.top - 1 || r.bottom > box.bottom + 1 || r.right > innerWidth + 1;})};
  });
  assert.ok(dimensions.scroll <= dimensions.height + 2, `${label}: document ${JSON.stringify(dimensions)}`);
  assert.ok(dimensions.horizontal <= dimensions.width + 1, `${label}: horizontal overflow`);
  assert.ok(dimensions.panelScroll <= dimensions.panelClient + 2, `${label}: panel ${JSON.stringify(dimensions)}`);
  assert.ok(!dimensions.obscured && dimensions.bottom <= dimensions.height + 1, `${label}: controls clipped`);
}
async function traverse(page, fixture, label) {
  await page.goto(origin + '/read/fixture', {waitUntil: 'load'});
  await page.waitForFunction(() => document.querySelector('#scene-screen').dataset.readerReady === 'true');
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
  const text = [], labels = [], writes = fixture.writes.length;
  let count = 0;
  do {
    await geometry(page, `${label}/${count}`);
    text.push(await page.locator('#scene-text').textContent());
    labels.push(...await page.locator('#choices button:visible').allTextContents());
    count++;
    assert.ok(count < 80, 'Pagination must converge');
    if (!await page.locator('#reader-page-next').isVisible() || !await page.locator('#reader-page-next').isEnabled()) break;
    await page.locator('#reader-page-next').click();
  } while (true);
  assert.equal(normalized(text.join('')), normalized(fixture.scene.text), `${label}: full prose preserved`);
  assert.deepEqual(labels, fixture.scene.choices.map(c => c.label), `${label}: every choice once`);
  assert.equal(fixture.writes.length, writes, 'Presentation navigation must not make game requests');
  return count;
}

async function reader(browser, width, height) {
  const context = await browser.newContext({viewport: {width, height}, reducedMotion: 'reduce'});
  const fixture = fixtureFor(district.scenes[0]), errors = [];
  await install(context, fixture);
  const page = await context.newPage(); currentPage = page; page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  const scenes = width === 390 ? [...district.scenes, ...mira] : representative;
  let pages = 0;
  for (const scene of scenes) { fixture.scene = scene; pages += await traverse(page, fixture, `${width}x${height}/${scene.id}`); }
  fixture.scene = crowded;
  await traverse(page, fixture, 'retry');
  const retryLabel = await page.locator('#choices button:visible').first().textContent();
  fixture.fail = true;
  await page.locator('#choices').getByRole('button', {name: retryLabel, exact: true}).click();
  await page.locator('#status').filter({hasText: /Не удалось|Ошибка|Retry/}).waitFor();
  assert.equal(fixture.writes.length, 1);
  assert.equal(await page.locator('#scene-title').textContent(), crowded.title);
  fixture.fail = false;
  await page.locator('#choices').getByRole('button', {name: retryLabel, exact: true}).click();
  await page.waitForFunction(() => document.querySelector('#scene-title').textContent === 'Готово');
  assert.equal(fixture.writes.length, 2);
  assert.deepEqual(fixture.writes[0], fixture.writes[1]);
  assert.equal(await page.locator('#scene-screen').getAttribute('data-reader-page'), '1');
  fixture.scene = district.scenes.find(s => s.id === 'tracksuit');
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto(origin + '/read/fixture', {waitUntil: 'load'});
  await page.setViewportSize({width: 320, height: 568});
  await page.waitForFunction(() => document.querySelector('#scene-screen').dataset.readerPages !== '1');
  assert.equal(await page.locator('#scene-screen').getAttribute('data-reader-page'), '1', 'Splitting a combined text/choices page must not skip unread prose');
  assert.ok((await page.locator('#scene-text').textContent()).startsWith(fixture.scene.text.slice(0, 30)));
  await page.setViewportSize({width, height});
  fixture.scene = {...longest(mira), text: longest(mira).text.repeat(4)};
  await page.goto(origin + '/read/fixture', {waitUntil: 'load'});
  await page.locator('#reader-page-next').click();
  const before = await page.locator('#scene-text').textContent();
  await page.setViewportSize({width: width === 390 ? 844 : 390, height: width === 390 ? 390 : 844});
  await page.waitForFunction(() => document.querySelector('.story-panel').scrollHeight <= document.querySelector('.story-panel').clientHeight + 2);
  assert.ok(normalized(await page.locator('#scene-text').textContent()).includes(normalized(before).slice(0, 10)), 'Resize preserves the current text anchor');
  await geometry(page, 'resize');
  assert.deepEqual(errors, []);
  await page.setViewportSize({width, height});
  await page.waitForFunction(() => Math.abs(document.querySelector('#scene-screen').getBoundingClientRect().height - innerHeight) < 2);
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); });
  await page.screenshot({path: `/tmp/fraerapp-reading-${width}.png`, fullPage: true});
  console.log(JSON.stringify({width, height, scenes: scenes.length, pages, localNavigationOnly: true, retry: true, resize: true}));
  await context.close();
}

async function builder(browser, width) {
  const context = await browser.newContext({viewport: {width, height: 900}, acceptDownloads: true});
  const fixture = fixtureFor(district.scenes[0]);
  const original = 'Ты читаешь историю и сам выбираешь свой путь.\n\n'.repeat(30);
  fixture.doc = {key: 'pages-test', title: 'Страницы', version: 1, startSceneId: 'start', assets: [], variables: {},
    scenes: [{id: 'start', title: 'Начало', text: original, choices: [{id: 'go', label: 'Пойти дальше', target: 'start', conditions: [], effects: []}]}]};
  await install(context, fixture);
  const page = await context.newPage(); currentPage = page;
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/builder/?story=chapter');
  await page.waitForFunction(() => document.querySelector('#scene-text-0')?.value.length > 500);
  const preview = page.locator('.reading-page-preview').first();
  await preview.evaluate(node => { for (let p = node.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true; });
  await preview.locator('summary').click();
  assert.match(await preview.locator('summary').textContent(), /до 500 символов/);
  const pieces = [];
  do {
    pieces.push(await preview.locator('.reading-page-prose').textContent());
    const next = preview.getByRole('button', {name: 'Продолжить', exact: true});
    if (!await next.isEnabled()) break;
    await next.click();
  } while (true);
  assert.equal(normalized(pieces.join('')), normalized(original));
  await page.locator('#scene-text-0').fill(original + 'Новый абзац.');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download-json').click();
  const download = await downloadPromise;
  const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  assert.equal(exported.scenes.length, 1);
  assert.equal(exported.scenes[0].text, original + 'Новый абзац.');
  assert.equal(exported.scenes[0].choices[0].label, 'Пойти дальше');
  assert.deepEqual(errors, []);
  assert.equal(fixture.writes.length, 0);
  console.log(JSON.stringify({builderWidth: width, automaticPages: pieces.length, unchangedGraph: true, fullExport: true}));
  await context.close();
}
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h] of [[320,568], [390,844], [430,932], [768,1024], [1440,900], [844,390]]) await reader(browser, w, h);
    for (const w of [390, 1440]) await builder(browser, w);
  } catch (error) {
    if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({path: '/tmp/fraerapp-reading-failure.png', fullPage: true});
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exit(1); });
