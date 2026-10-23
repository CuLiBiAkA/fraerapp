import { cp, mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const files = ['index.html', 'style.css', 'app.js', 'model.js', 'analytics.js'];
for (const file of files.filter(f => f.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL('frontend/cat-merge/' + file, root))], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
const dest = new URL('dist/cat-merge/', root);
await rm(dest, { recursive: true, force: true }); await mkdir(dest, { recursive: true });
for (const file of files) await cp(new URL('frontend/cat-merge/' + file, root), new URL(file, dest));
await mkdir(new URL('dist/meow/', root), { recursive: true });
for (const file of ['cats.js', 'config.js', 'audio.js', 'favicon.svg'])
  await cp(new URL('frontend/meow/' + file, root), new URL('dist/meow/' + file, root));
await mkdir(new URL('dist/assets/home/', root), { recursive: true });
await cp(new URL('frontend/assets/home/inter-regular.ttf', root), new URL('dist/assets/home/inter-regular.ttf', root));
console.log('Cat drop build: dist/cat-merge/ with shared meow art/audio and local font.');
