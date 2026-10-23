import test from 'node:test';
import assert from 'node:assert/strict';
import { splitReadingText, READING_PAGE_CHARACTERS } from './reading-pagination.js';

test('pages preserve every character of long prose, paragraphs and interpolated values', () => {
  const original = ('Долг: 1200 ₽. Ты держишь слово.\n\nДруг протягивает ладонь. ' + '🙂'.repeat(7) + '\n').repeat(50);
  const pages = splitReadingText(original);
  assert.ok(pages.length > 1);
  assert.equal(pages.map(page => page.text).join(''), original);
  for (const page of pages) {
    assert.ok(Array.from(page.text).length <= READING_PAGE_CHARACTERS);
    assert.equal(original.slice(page.start, page.end), page.text);
    assert.ok(!/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(page.text));
  }
});

test('available height can create smaller pages without dropping text', () => {
  const text = 'Мы читаем, затем выбираем действие. '.repeat(40);
  const pages = splitReadingText(text, { fits: value => value.length <= 87 });
  assert.equal(pages.map(page => page.text).join(''), text);
  assert.ok(pages.every(page => page.text.trim().length <= 87));
});

test('short, empty and unbroken content terminates safely', () => {
  assert.equal(splitReadingText('Коротко.').length, 1);
  assert.equal(splitReadingText('')[0].text, '');
  const text = '🙂'.repeat(1100);
  assert.equal(splitReadingText(text).map(page => page.text).join(''), text);
  const impossible = splitReadingText(text, { fits: () => false });
  assert.equal(impossible.length, 3);
  assert.equal(impossible.map(page => page.text).join(''), text);
});
