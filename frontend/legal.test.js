import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('published consent documents and auth agree on the recorded version', () => {
  const context = { window: {} };
  vm.runInNewContext(read('./legal-config.js'), context);
  const version = context.window.FRAERAPP_LEGAL.policyVersion;
  assert.match(version, /^\d{4}-\d{2}-\d{2}$/);
  for (const page of ['privacy-policy', 'personal-data-consent', 'terms']) {
    const html = read(`./${page}.html`);
    assert.ok(html.includes(`data-legal="policyVersion">${version}</span>`), `${page} no-script fallback version`);
    assert.ok(html.includes(`/legal-config.js?v=${version}`), `${page} current config cache key`);
    assert.ok(html.includes('href="#legal-content"'));
    assert.ok(html.includes('id="legal-content" tabindex="-1" aria-labelledby="legal-title"'));
    const contacts = [...html.matchAll(/<a data-legal-(?:email|withdrawal-email)\b[^>]*>.*?<\/a>/g)];
    assert.ok(contacts.length > 0);
    for (const [contact] of contacts) assert.ok(html.includes(`<!--email_off-->${contact}<!--/email_off-->`), 'public contacts must survive CDN delivery with JavaScript disabled');
  }
  assert.ok(read('../auth-service/src/main/resources/application.properties').includes(`AUTH_PRIVACY_POLICY_VERSION:${version}`));
  assert.ok(read('../auth-service/src/main/java/com/fraergod/fraerapp/auth/AuthServiceApplication.java').includes(`auth.privacy-policy-version:${version}`));
  assert.ok(read('../compose.yaml').includes(`AUTH_PRIVACY_POLICY_VERSION:-${version}`));
  assert.ok(read('../.env.example').includes(`AUTH_PRIVACY_POLICY_VERSION=${version}`));
  assert.ok(read('./terms.html').includes('id="contacts"'), 'shared Support destination exists');
});

test('operator configuration is rendered as text and contact links remain actionable', () => {
  const name = { dataset: { legal: 'operatorName' }, textContent: '' };
  const privacy = { textContent: '', href: '' };
  const withdrawal = { textContent: '', href: '' };
  let warningHidden;
  vm.runInNewContext(read('./legal.js'), {
    window: { FRAERAPP_LEGAL: { operatorName: '<img src=x>', privacyEmail: 'privacy@example.test', consentWithdrawalEmail: 'withdraw@example.test' } },
    document: {
      querySelectorAll: selector => ({ '[data-legal]': [name], '[data-legal-email]': [privacy], '[data-legal-withdrawal-email]': [withdrawal] })[selector],
      querySelector: () => ({ classList: { toggle: (name, hidden) => { assert.equal(name, 'hidden'); warningHidden = hidden; } } })
    }
  });
  assert.equal(name.textContent, '<img src=x>');
  assert.equal(privacy.href, 'mailto:privacy@example.test');
  assert.equal(withdrawal.href, 'mailto:withdraw@example.test');
  assert.equal(warningHidden, true);
});
