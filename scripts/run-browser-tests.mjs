import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Playwright and its Chromium must be installed or exposed through NODE_PATH.
// The obsolete check-chapters-ui.mjs targets a retired editor and is excluded.
const checks = [
  'unified-catalog', 'frontend-audit', 'legal-pages', 'builder-editing', 'site-controls',
  'admin-panel', 'subscriptions', 'reader-ads', 'notifications',
  'reader-layout', 'review-limit', 'serial-stories', 'story-contents', 'builder-help', 'chapter-tabs',
  'author-workspace', 'reader-recovery', 'standalone-recovery',
];
for (const name of checks) {
  console.log(`Browser check: ${name}`);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(`check-${name}.cjs`, import.meta.url))], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
for (const name of ['authoring-prompts', 'builder-cas']) {
  console.log(`Browser check: ${name}`);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(`../story-builder/check-${name}.cjs`, import.meta.url))], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`All ${checks.length + 2} browser suites passed.`);
