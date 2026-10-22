const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve('frontend');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = process.env.MEOW_BASE_URL || `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true });
    await context.addInitScript(() => {
      const Native = window.AudioContext;
      window.__audio = { contexts: [], active: 0 };
      window.AudioContext = class extends Native {
        constructor(...args) {
          super(...args); window.__audio.contexts.push(this);
          const create = this.createOscillator.bind(this);
          this.createOscillator = () => {
            const osc = create(), start = osc.start.bind(osc);
            osc.start = (...args) => { window.__audio.active++; start(...args); };
            osc.addEventListener('ended', () => window.__audio.active--);
            return osc;
          };
        }
      };
    });
    const page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => requests.push(r.url()));
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.goto(`${origin}/meow/`);
    await page.locator('.piano-key').first().waitFor();
    assert.equal(await page.locator('.white').count(), 8);
    assert.equal(await page.locator('.black').count(), 5);
    await page.screenshot({ path: '/tmp/meow-desktop.png', fullPage: true });
    const clear = async () => {
      await page.waitForFunction(() => document.querySelectorAll('.cat').length === 0 && window.__audio.active === 0);
      assert.equal(await page.locator('.pressed').count(), 0);
    };
    // First, very short gesture must unlock audio and remain visible/audible.
    const initialRequests = requests.length;
    await page.keyboard.down('a'); await page.keyboard.up('a');
    await page.waitForFunction(() => document.querySelector('.cat.singing'));
    assert.ok(await page.evaluate(() => window.__audio.active > 0));
    await clear();
    await page.keyboard.down('a');
    await page.waitForTimeout(700); assert.equal(await page.locator('.cat.singing').count(), 1);
    await page.keyboard.down('a'); assert.equal(await page.locator('.cat').count(), 1);
    // Pointer and keyboard share the same note, release is independently owned.
    const key = page.locator('[data-note="0"].piano-key'), box = await key.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 20); await page.mouse.down();
    await page.keyboard.up('a'); await page.waitForTimeout(350);
    assert.equal(await page.locator('.cat.singing').count(), 1);
    await page.mouse.up(); await clear();
    await key.focus();
    await page.keyboard.down('Enter'); await page.keyboard.down('Enter');
    await page.waitForTimeout(60);
    assert.equal(await page.evaluate(() => window.__audio.active), 2, 'Enter repeat must not create extra voices');
    await page.keyboard.up('Enter'); await clear();
    // A Russian character with KeyA must still play C4.
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'ф' })));
    await page.waitForFunction(() => document.querySelector('.cat[data-note="0"]'));
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', key: 'ф' })));
    await clear();
    for (let i = 0; i < 18; i++) await page.keyboard.press(['a', 's', 'd', 'f'][i % 4]);
    await clear();
    const keys = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k'];
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForFunction(() => document.querySelectorAll('.cat').length === 13);
    assert.equal(await page.locator('.pressed').count(), 13);
    assert.equal(await page.locator('.cat svg title').evaluateAll(els => new Set(els.map(e => e.textContent)).size), 13);
    await page.screenshot({ path: '/tmp/meow-chord.png', fullPage: true });
    await page.locator('#mute').click(); assert.equal(await page.locator('#mute').getAttribute('aria-pressed'), 'true');
    await page.locator('#mute').click();
    for (const k of keys) await page.keyboard.up(k);
    await clear();
    await page.keyboard.down('g');
    await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await clear(); await page.keyboard.up('g');
    await page.keyboard.down('h');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
    });
    await clear(); await page.keyboard.up('h');
    // Browser-generated multi-touch Pointer Events, followed by touch cancellation.
    const cdp = await context.newCDPSession(page);
    const points = [];
    for (const id of [0, 4, 7, 12]) {
      const b = await page.locator(`.piano-key[data-note="${id}"]`).boundingBox();
      points.push({ x: b.x + b.width / 2, y: b.y + b.height - 20, id });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
    await page.waitForFunction(() => document.querySelectorAll('.pressed').length === 4);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await clear();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 20); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height - 20);
    await page.evaluate(() => document.querySelector('.piano-key').releasePointerCapture(1));
    await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height - 20);
    await clear(); await page.mouse.up();
    // Real audio suspension clears the UI and resumes on the next gesture.
    await page.keyboard.down('j'); await page.waitForTimeout(80);
    await page.evaluate(() => window.__audio.contexts[0].suspend());
    assert.equal(await page.locator('.pressed').count(), 0); await page.keyboard.up('j');
    await page.keyboard.press('k'); await clear();
    assert.equal(requests.length, initialRequests, 'playing must not fetch resources');
    console.log('Input: short taps, sustain, repeat, 13-note chord, RU layout, shared ownership, rapid replay, mute, blur, hidden page, four-touch cancel, lost capture, audio interruption passed.');

    // Render the production synth in a real browser OfflineAudioContext.
    const audioResults = await page.evaluate(async () => {
      const { MeowAudio } = await import('./audio.js?v=3');
      const { NOTES } = await import('./config.js');
      async function render(notes, release = true, muted = false) {
        const c = new OfflineAudioContext(1, 44100, 44100), a = new MeowAudio();
        a.setVolume(.65, muted); a.attach(c);
        for (const note of notes) { const v = a.start(note); if (release) v.release(); }
        const data = (await c.startRendering()).getChannelData(0);
        const rms = (start, end) => Math.sqrt(data.slice(start * 44100, end * 44100).reduce((s, n) => s + n * n, 0) / ((end - start) * 44100));
        return { data, peak: data.reduce((m, x) => Math.max(m, Math.abs(x)), 0), attack: rms(.03, .15), tail: rms(.7, .99), sustain: rms(.7, .9) };
      }
      const notes = [];
      for (const note of NOTES) {
        const r = await render([note], false);
        let best = -Infinity, bestLag = 0;
        for (let lag = Math.floor(44100 / note.frequency * .94); lag <= Math.ceil(44100 / note.frequency * 1.06); lag++) {
          let correlation = 0;
          for (let i = 18000; i < 24000; i++) correlation += r.data[i] * r.data[i + lag];
          if (correlation > best) { best = correlation; bestLag = lag; }
        }
        notes.push({ expected: note.frequency, measured: 44100 / bestLag, sustain: r.sustain });
      }
      const tap = await render([NOTES[0]]), chord = await render(NOTES), silent = await render(NOTES, false, true);
      const stressContext = new OfflineAudioContext(1, 44100, 44100), stress = new MeowAudio();
      stress.attach(stressContext); stress.start(NOTES[0]);
      for (let i = 0; i < 60; i++) stress.start(NOTES[4]).release();
      const stressData = (await stressContext.startRendering()).getChannelData(0);
      const heldAfterStress = stressData.slice(33075).some(x => Math.abs(x) > .001);
      return { notes, tap: { attack: tap.attack, tail: tap.tail }, chord: { peak: chord.peak, tail: chord.tail }, silent: silent.sustain, heldAfterStress };
    });
    for (const n of audioResults.notes) {
      assert.ok(Math.abs(n.measured / n.expected - 1) < .015, JSON.stringify(n));
      assert.ok(n.sustain > .001);
    }
    assert.ok(audioResults.tap.attack > .001);
    assert.ok(audioResults.tap.tail < 1e-6);
    assert.ok(audioResults.chord.peak < .95); assert.ok(audioResults.chord.tail < 1e-6);
    assert.ok(audioResults.silent < 1e-6);
    assert.ok(audioResults.heldAfterStress, 'release-tail pruning must preserve held notes');
    console.log('Audio: all 13 measured pitches within 1.5%, sustained signal, audible short note, silent release tail and mute, no 13-note clipping.', JSON.stringify(audioResults));
    for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024], [390, 844], [320, 667], [844, 390]]) {
      await page.setViewportSize({ width, height });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const pianoBox = await page.locator('#piano').boundingBox();
      if (height >= 667) assert.ok(pianoBox.y + pianoBox.height <= height, `piano below fold ${width}`);
      await page.screenshot({ path: `/tmp/meow-${width}.png`, fullPage: true });
      for (const k of keys) await page.keyboard.down(k);
      await page.waitForTimeout(350);
      const stageBox = await page.locator('.stage').boundingBox();
      const boxes = await page.locator('.cat').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
      for (const box of boxes) assert.ok(box.y >= stageBox.y - 1 && box.y + box.h <= stageBox.y + stageBox.height - 20, `cat outside stage ${width}`);
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        assert.ok(a.x + a.w <= b.x + 1 || b.x + b.w <= a.x + 1 || a.y + a.h <= b.y + 1 || b.y + b.h <= a.y + 1, `cats overlap ${width}`);
      }
      if (width === 390) await page.screenshot({ path: '/tmp/meow-mobile-chord.png', fullPage: true });
      for (const k of keys) await page.keyboard.up(k); await clear();
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.keyboard.down('a');
    assert.equal(await page.locator('.cat-body').last().evaluate(e => getComputedStyle(e).animationName), 'none');
    await page.keyboard.up('a'); await clear();
    assert.deepEqual(errors, []);
    // Explicit unsupported-audio recovery is visible.
    const unsupported = await context.newPage();
    await unsupported.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
    await unsupported.goto(`${origin}/meow/`); await unsupported.keyboard.press('a');
    assert.match(await unsupported.locator('#audio-status').innerText(), /нет Web Audio/);
    assert.ok(await unsupported.locator('#enable-audio').isVisible());
    console.log('Responsive: six sizes, no horizontal overflow, piano above fold in portrait/desktop, distinct non-overlapping cats, reduced motion and unsupported-audio message passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
