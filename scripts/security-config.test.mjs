import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('nginx access logs exclude credential-bearing query strings and Referer', () => {
  for (const path of ['nginx/nginx.conf', 'nginx/nginx.prod.conf', 'nginx/nginx.local.conf']) {
    const config = fs.readFileSync(path, 'utf8');
    const log = config.match(/log_format main[\s\S]*?;/)?.[0];
    assert.ok(log, path);
    assert.doesNotMatch(log, /\$(?:request|request_uri|args|query_string|http_referer)\b/, path);
    assert.match(log, /\$request_method \$uri \$server_protocol/, path);
  }
});

test('login landing documents prevent credential-bearing subresource referrers', () => {
  for (const path of ['frontend/index.html', 'story-builder/index.html', 'auth-service/src/main/resources/admin.html']) {
    const html = fs.readFileSync(path, 'utf8');
    const policy = html.indexOf('<meta name="referrer" content="no-referrer">');
    assert.ok(policy > 0 && policy < html.indexOf('<link'), path);
  }
});
