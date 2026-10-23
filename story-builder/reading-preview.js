import { splitReadingText, READING_PAGE_CHARACTERS, READING_PAGE_CHOICES, CHOICE_LABEL_GUIDANCE } from '../reading-pagination.js?v=1';

export function readingPreview(control, language) {
  const wrap = document.createElement('details');
  wrap.className = 'reading-page-preview';
  const summary = document.createElement('summary'), hint = document.createElement('p');
  const text = document.createElement('p'), controls = document.createElement('div');
  text.className = 'reading-page-prose'; controls.className = 'reading-preview-controls';
  const previous = document.createElement('button'), next = document.createElement('button'), counter = document.createElement('span');
  previous.type = next.type = 'button'; counter.setAttribute('aria-live', 'polite');
  controls.append(previous, counter, next); wrap.append(summary, hint, text, controls);
  let pages = [], index = 0;
  function show() {
    const en = language() === 'en';
    summary.textContent = en ? `Reading pages: ${pages.length} · up to ${READING_PAGE_CHARACTERS} characters`
      : `Страницы чтения: ${pages.length} · до ${READING_PAGE_CHARACTERS} символов`;
    hint.textContent = en ? `Long text is split automatically. Small screens may have more pages. After the text, up to ${READING_PAGE_CHOICES} choices appear per page. Page navigation does not change the game.`
      : `Длинный текст разделяется автоматически. На маленьком экране страниц может быть больше. После текста — до ${READING_PAGE_CHOICES} вариантов ответа на странице. Перелистывание не меняет ход игры.`;
    text.textContent = pages[index].text.trim() || (en ? 'Scene text will appear here.' : 'Здесь появится текст сцены.');
    counter.textContent = `${index + 1} / ${pages.length}`;
    previous.textContent = en ? 'Back' : 'Назад'; next.textContent = en ? 'Continue' : 'Продолжить';
    previous.disabled = index === 0; next.disabled = index === pages.length - 1;
  }
  function update() { pages = splitReadingText(control.value); index = Math.min(index, pages.length - 1); show(); }
  previous.onclick = () => { if (index > 0) { index--; show(); } };
  next.onclick = () => { if (index + 1 < pages.length) { index++; show(); } };
  control.addEventListener('input', update);
  wrap.addEventListener('toggle', update);
  update();
  return wrap;
}

export function addChoiceReadingHint(field, control, language) {
  const hint = document.createElement('small');
  hint.className = 'choice-reading-hint';
  hint.id = `choice-reading-${crypto.randomUUID()}`;
  control.setAttribute('aria-describedby', hint.id);
  function update() {
    const count = Array.from(control.value).length, en = language() === 'en';
    hint.textContent = count > CHOICE_LABEL_GUIDANCE
      ? (en ? `${count} characters. A shorter label will be easier to read on a phone; the full text is preserved.`
        : `${count} символов. Сократите подпись для удобства на телефоне; полный текст сохраняется.`)
      : (en ? `${count} characters · recommended up to ${CHOICE_LABEL_GUIDANCE}` : `${count} символов · рекомендуем до ${CHOICE_LABEL_GUIDANCE}`);
    hint.classList.toggle('reading-guidance-warning', count > CHOICE_LABEL_GUIDANCE);
  }
  control.addEventListener('input', update); update(); field.append(hint);
  return field;
}
