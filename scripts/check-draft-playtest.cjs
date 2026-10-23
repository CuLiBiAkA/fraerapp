const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..'), origin = 'https://draft-playtest.test';
const url = origin + '/?previewStory=private-draft&revision=7';
function state(choices = []) {
  const finished = choices.length > 0;
  return { sessionId: 'preview', status: finished ? 'finished' : 'active',
    story: { key: 'private', title: 'Private draft' }, statsVariables: { trust: finished ? 2 : 0 },
    scene: { id: finished ? 'end' : 'start', title: 'Scene', backgroundUrl: '/assets/platform.svg',
      text: finished ? 'You opened the door. Trust: 2.' : 'The door is closed. Trust: 0.',
      ending: finished ? { title: 'The open door' } : null,
      choices: finished ? [] : [{ id: 'open', label: 'Open the door' }] },
    advertisement: { deliveryId: 'must-never-be-used' },
  };
}
async function checkSerial(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  const requests = [], replays = [], errors = [];
  const endpoint = '/api/author/collections/private-serial/playtest';
  const manifest = { collectionId: 'private-serial', revision: 12, title: 'The private journey', chapters: [
    { id: 'chapter-one', revision: 4, title: 'The first door' },
    { id: 'chapter-two', revision: 9, title: 'The second door' },
  ] };
  let manifests = 0, fail = false, manifestError, gate, release;
  const first = { id: 'chapter-one', revision: 4, choices: [] };
  const firstFinished = { ...first, choices: ['open'] };
  const second = { id: 'chapter-two', revision: 9, choices: [] };
  await context.addInitScript(() => {
    localStorage.setItem('fraerapp.cookieConsent', 'accepted');
    localStorage.setItem('fraerapp.sessionId', 'existing-reader-save');
    localStorage.setItem('fraerapp.storyKey', 'existing-public-story');
  });
  await context.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url()), p = u.pathname;
    if (u.origin !== origin) return route.abort();
    requests.push({ path: p, method: req.method() });
    const send = (json, status = 200) => route.fulfill({ json, status });
    if (p === '/auth/me') return send({ email: 'author@example.test', roles: ['author'] });
    if (p === '/api/account') return send({ unreadCount: 0, notifications: [] });
    if (p === endpoint && req.method() === 'GET') {
      assert.equal(u.searchParams.get('revision'), 'draft');
      manifests++;
      if (manifestError) return send({ code: manifestError }, 400);
      return send(manifest);
    }
    if (p === endpoint) {
      const body = req.postDataJSON(); replays.push(body);
      if (gate) await gate;
      if (fail) return send({}, 503);
      const chapterIndex = body.steps.length - 1;
      const session = state(body.steps.at(-1).choices);
      session.story.title = chapterIndex === 0 ? 'The first door' : 'The second door';
      if (chapterIndex === 1) {
        session.scene.text = session.status === 'finished' ? 'The journey is complete. Trust: 5.' : 'Your trust crossed chapters: 2.';
        session.statsVariables.trust = session.status === 'finished' ? 5 : 2;
      }
      return send({ session, chapterIndex });
    }
    if (p === '/api/catalog/stories') return send([{ key: 'public', slug: 'public', title: 'Public story' }]);
    if (p.startsWith('/api/') || p.startsWith('/auth/')) return send([]);
    let file = path.join(root, 'frontend', p.slice(1));
    if (p === '/' || p === '/history') file = path.join(root, 'frontend/index.html');
    return fs.existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404, body: '' });
  });
  try {
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/?previewCollection=private-serial&revision=draft');
    await page.locator('#choices button').waitFor();
    assert.deepEqual(replays, [{ revision: 12, steps: [first] }]);
    assert.equal(await page.locator('.draft-playtest-banner a').getAttribute('href'), '/my-stories/?collection=private-serial');
    assert.match(await page.locator('#draft-playtest-chapter').textContent(), /The private journey · Глава 1 из 2: The first door/);
    assert.ok(await page.locator('#draft-playtest-next').isHidden());
    await page.locator('#choices button').click();
    await page.locator('#draft-playtest-next').waitFor();
    assert.equal(await page.locator('#status').textContent(), 'Глава завершена.');
    assert.deepEqual(replays.at(-1), { revision: 12, steps: [firstFinished] });
    fail = true;
    await page.locator('#draft-playtest-next').click();
    await page.locator('#status').filter({ hasText: /Не удалось/ }).waitFor();
    assert.match(await page.locator('#draft-playtest-chapter').textContent(), /Глава 1 из 2/);
    assert.equal(await page.locator('#scene-text').textContent(), 'You opened the door. Trust: 2.');
    assert.ok(await page.locator('#draft-playtest-next').isEnabled());
    fail = false;
    // Editing the source manifest must not change the revisions selected for this playthrough.
    manifest.revision = 99; manifest.chapters[1].revision = 99;
    await page.locator('#draft-playtest-next').click();
    await page.locator('#scene-text').filter({ hasText: 'Your trust crossed chapters: 2.' }).waitFor();
    assert.deepEqual(replays.at(-1), { revision: 12, steps: [firstFinished, second] });
    assert.deepEqual(replays.at(-2), replays.at(-1), 'A failed next chapter must preserve the same history for retry');
    assert.match(await page.locator('#draft-playtest-chapter').textContent(), /Глава 2 из 2: The second door/);
    assert.equal(await page.locator('#scene-node').textContent(), 'The second door');
    assert.ok(await page.locator('#draft-playtest-next').isHidden());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `/tmp/fraerapp-serial-playtest-${width}.png`, fullPage: true });
    fail = true;
    await page.locator('#choices button').click();
    await page.locator('#status').filter({ hasText: /Не удалось/ }).waitFor();
    fail = false;
    await page.locator('#choices button').click();
    await page.locator('#scene-text').filter({ hasText: 'The journey is complete. Trust: 5.' }).waitFor();
    assert.deepEqual(replays.at(-1), { revision: 12, steps: [firstFinished, { ...second, choices: ['open'] }] });
    assert.deepEqual(replays.at(-2), replays.at(-1), 'A failed choice must not advance chapter history');
    assert.equal(await page.locator('#status').textContent(), 'История пройдена.');
    assert.ok(await page.locator('#draft-playtest-next').isHidden());
    await page.locator('#draft-playtest-restart').click();
    await page.locator('#choices button').waitFor();
    assert.deepEqual(replays.at(-1), { revision: 12, steps: [first] });
    assert.equal(manifests, 1, 'Restart uses the same frozen story and chapter revisions');
    assert.match(await page.locator('#draft-playtest-chapter').textContent(), /Глава 1 из 2/);
    const replayCount = replays.length;
    await page.locator('[data-site-settings]').click();
    await page.locator('#modal-lang-en').click(); await page.keyboard.press('Escape');
    assert.match(await page.locator('#draft-playtest-chapter').textContent(), /Chapter 1 of 2/);
    assert.equal(replays.length, replayCount);
    assert.deepEqual(await page.evaluate(() => [localStorage.getItem('fraerapp.sessionId'), localStorage.getItem('fraerapp.storyKey')]), ['existing-reader-save', 'existing-public-story']);
    assert.ok(!requests.some(r => r.path.startsWith('/api/') && r.path !== endpoint && r.path !== '/api/account' && r.path !== '/api/catalog/stories'), 'Serial preview must never call reader saves, collection runs, advertisements or public activity');
    await page.locator('#choices button').click();
    await page.locator('#draft-playtest-next').waitFor();
    gate = new Promise(resolve => { release = resolve; });
    const pending = page.waitForRequest(r => r.url().endsWith('/playtest'));
    await page.locator('#draft-playtest-next').click(); await pending;
    await page.evaluate(() => { history.pushState({}, '', '/'); dispatchEvent(new PopStateEvent('popstate')); });
    await page.locator('#login-screen:not(.hidden)').waitFor();
    const lateResponse = page.waitForResponse(r => r.url().endsWith('/playtest'));
    release(); gate = null; await lateResponse;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    assert.ok(await page.locator('#scene-screen').isHidden(), 'Late next chapter must not replace a later route');
    const completedReplays = replays.length;
    manifestError = 'NO_CHAPTERS';
    await page.goto(origin + '/?previewCollection=private-serial&revision=draft');
    await page.locator('#status').filter({ hasText: 'Add a chapter' }).waitFor();
    assert.equal(await page.locator('#choices button').count(), 0);
    assert.ok(await page.locator('#draft-playtest-next').isHidden());
    manifestError = 'UNSUPPORTED_PREVIEW';
    await page.locator('#draft-playtest-restart').click();
    await page.locator('#status').filter({ hasText: 'single sequence' }).waitFor();
    await page.locator('[data-site-settings]').click();
    await page.locator('#modal-lang-ru').click(); await page.keyboard.press('Escape');
    assert.match(await page.locator('#status').textContent(), /Проверьте её структуру/);
    assert.equal(replays.length, completedReplays, 'Unavailable manifests must not start a playthrough');
    assert.deepEqual(errors, []);
    console.log(`${width}px: serial preview, chapter transfer request, next/retry, ending/restart, frozen revisions, no reader activity, stale route and unavailable manifests passed`);
  } finally { await context.close(); }
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const requests = [], errors = [], replays = [];
      let fail = false, denied = false, gate, release;
      await context.addInitScript(() => {
        localStorage.setItem('fraerapp.cookieConsent', 'accepted');
        localStorage.setItem('fraerapp.sessionId', 'existing-reader-save');
        localStorage.setItem('fraerapp.storyKey', 'existing-public-story');
      });
      await context.route('**/*', async route => {
        const req = route.request(), u = new URL(req.url()), p = u.pathname;
        if (u.origin !== origin) return route.abort();
        requests.push({ path: p, method: req.method() });
        const send = (json, status = 200) => route.fulfill({ json, status });
        if (p === '/auth/me') return send({ email: 'author@example.test', roles: ['author'] });
        if (p === '/api/account') return send({ unreadCount: 0, notifications: [] });
        if (p === '/api/author/stories/private-draft/playtest') {
          const body = req.postDataJSON(); replays.push(body);
          if (gate) await gate;
          if (denied) return send({}, 403);
          if (fail) return send({}, 503);
          return send(state(body.choices));
        }
        if (p === '/api/catalog/stories') return send([{ key: 'public', slug: 'public', title: 'Public story' }]);
        if (p.startsWith('/api/') || p.startsWith('/auth/')) return send([]);
        let file = path.join(root, 'frontend', p.slice(1));
        if (p === '/' || p === '/history') file = path.join(root, 'frontend/index.html');
        return fs.existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404, body: '' });
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      await page.locator('#choices button').waitFor();
      assert.deepEqual(replays, [{ revision: 7, choices: [] }]);
      assert.match(await page.locator('.draft-playtest-banner').textContent(), /Предпросмотр черновика/);
      assert.equal(await page.locator('.draft-playtest-banner a').getAttribute('href'), '/my-stories/');
      assert.equal(await page.locator('#scene-text').textContent(), 'The door is closed. Trust: 0.');
      assert.ok(await page.locator('#scene-image').evaluate(img => img.complete && img.naturalWidth > 0));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `/tmp/fraerapp-draft-playtest-${width}.png`, fullPage: true });
      fail = true;
      await page.locator('#choices button').click();
      await page.locator('#status').filter({ hasText: /Не удалось/ }).waitFor();
      assert.equal(await page.locator('#scene-text').textContent(), 'The door is closed. Trust: 0.');
      assert.ok(await page.locator('#choices button').isEnabled());
      fail = false;
      await page.locator('#choices button').click();
      await page.locator('#scene-text').filter({ hasText: 'Trust: 2.' }).waitFor();
      assert.deepEqual(replays.at(-1), { revision: 7, choices: ['open'] }, 'A failed choice must not advance replay history');
      assert.equal(await page.locator('#choices button').count(), 0);
      await page.locator('#draft-playtest-restart').click();
      await page.locator('#choices button').waitFor();
      assert.deepEqual(replays.at(-1), { revision: 7, choices: [] });
      await page.locator('[data-site-settings]').click();
      await page.locator('#modal-lang-en').click();
      await page.keyboard.press('Escape');
      assert.match(await page.locator('.draft-playtest-banner').textContent(), /Draft preview/);
      assert.equal(replays.length, 4, 'Language changes only repaint the same preview state');
      assert.deepEqual(await page.evaluate(() => [localStorage.getItem('fraerapp.sessionId'), localStorage.getItem('fraerapp.storyKey')]), ['existing-reader-save', 'existing-public-story']);
      assert.ok(!requests.some(r => r.path.startsWith('/api/sessions') || /advertis|engagement.*\/(view|rating)/.test(r.path)), 'Preview must not call reader saves, advertisements or public activity');
      gate = new Promise(resolve => { release = resolve; });
      const pending = page.waitForRequest(r => r.url().endsWith('/playtest'));
      await page.locator('#choices button').click(); await pending;
      await page.evaluate(() => { history.pushState({}, '', '/'); dispatchEvent(new PopStateEvent('popstate')); });
      await page.locator('#login-screen:not(.hidden)').waitFor();
      const lateResponse = page.waitForResponse(r => r.url().endsWith('/playtest'));
      release(); gate = null;
      await lateResponse;
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      assert.ok(await page.locator('#scene-screen').isHidden(), 'Late preview response must not replace a later route');
      denied = true;
      await page.goto(url);
      await page.locator('#status').filter({ hasText: /unavailable/ }).waitFor();
      assert.equal(await page.locator('#choices button').count(), 0);
      assert.ok(await page.locator('.draft-playtest-banner a').isVisible());
      await page.locator('[data-site-settings]').click();
      await page.locator('#modal-lang-ru').click();
      await page.keyboard.press('Escape');
      assert.match(await page.locator('#status').textContent(), /Черновик недоступен/);
      denied=false;await page.goto(url+'&moderationPreview=1');await page.locator('#choices button').waitFor();
      assert.match(await page.locator('.draft-playtest-banner').textContent(),/Глава на проверке/);
      assert.equal(await page.locator('.draft-playtest-banner a').getAttribute('href'),'/moderation/');
      assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('fraerapp.sessionId'),localStorage.getItem('fraerapp.storyKey')]),['existing-reader-save','existing-public-story']);
      assert.deepEqual(errors, []);
      console.log(`${width}px: private preview, choice/retry, ending/restart, language, no reader activity, stale route and denial passed`);
      await context.close();
      await checkSerial(browser, width);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
