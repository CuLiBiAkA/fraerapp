import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const files = ['index.html', 'style.css', 'favicon.svg', 'app.js', 'audio.js', 'input.js', 'config.js', 'cats.js', 'scene.js', 'piano.js', 'settings.js', 'visits.js'];
for (const file of files.filter(f => f.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(`frontend/meow/${file}`, root))], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
for (const file of files) {
  const content = await readFile(new URL(`frontend/meow/${file}`, root), 'utf8');
  if (/https?:\/\//.test(content) && !file.endsWith('.svg')) throw new Error(`External dependency in ${file}`);
}
const destination = new URL('dist/meow/', root);
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const file of files) await cp(new URL(`frontend/meow/${file}`, root), new URL(file, destination));
console.log(`Meow production build: dist/meow/ (${files.length} self-contained static files).`);
