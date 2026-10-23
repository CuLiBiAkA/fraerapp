import { splitReadingText, READING_PAGE_CHOICES, READING_PAGE_CHARACTERS } from './reading-pagination.js?v=1';

// Local presentation only: this controller has no API, effects or save access.
export function createReadingPager({ screen, panel, text, choices, language }) {
  const nav = document.createElement('nav');
  nav.id = 'reader-pages';
  nav.className = 'reader-pages';
  nav.hidden = true;
  const previous = document.createElement('button'), next = document.createElement('button');
  const counter = document.createElement('span');
  previous.type = next.type = 'button';
  previous.id = 'reader-page-previous'; next.id = 'reader-page-next';
  counter.id = 'reader-page-count';
  counter.setAttribute('aria-live', 'polite');
  counter.setAttribute('aria-atomic', 'true');
  nav.append(previous, counter, next);
  choices.after(nav);
  text.tabIndex = -1;
  let source = null, nodes = [], pages = [], index = 0, busy = false, frame = 0, size = '';
  const related = () => panel.querySelector('.chapter-navigation');
  const words = (ru, en) => language() === 'en' ? en : ru;

  function display(page, final = false) {
    text.textContent = page.text.trim();
    text.hidden = !text.textContent;
    nodes.forEach(node => { node.hidden = !page.items.includes(node); });
    choices.hidden = !page.items.length;
    const links = related();
    if (links) links.hidden = !final;
  }
  function fits(prose, items = [], final = false) {
    display({ text: prose, items }, final);
    return panel.scrollHeight <= panel.clientHeight + 1;
  }
  function show({ focus = false } = {}) {
    if (!pages.length) return;
    const page = pages[index];
    display(page, index === pages.length - 1);
    nav.hidden = pages.length === 1;
    nav.setAttribute('aria-label', words('Страницы сцены', 'Scene pages'));
    previous.textContent = words('Назад', 'Back');
    previous.setAttribute('aria-label', words('Предыдущая страница сцены', 'Previous scene page'));
    next.textContent = page.kind === 'choices' ? words('Ещё варианты', 'More choices')
      : pages[index + 1]?.kind === 'choices' ? words('К выбору', 'Choices') : words('Далее', 'Continue');
    next.setAttribute('aria-label', words('Следующая страница сцены', 'Next scene page'));
    counter.textContent = `${index + 1} / ${pages.length}`;
    counter.setAttribute('aria-label', words(`Страница ${index + 1} из ${pages.length}`, `Page ${index + 1} of ${pages.length}`));
    previous.disabled = busy || index === 0;
    next.disabled = busy || index === pages.length - 1;
    next.style.visibility = index === pages.length - 1 ? 'hidden' : '';
    screen.dataset.readerPage = String(index + 1);
    screen.dataset.readerPages = String(pages.length);
    screen.dataset.readerReady = 'true';
    panel.scrollTop = 0;
    if (focus) {
      if (!text.hidden) text.focus({ preventScroll: true });
      else { panel.tabIndex = -1; panel.focus({ preventScroll: true }); }
    }
  }
  function layout(preserve = true) {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (source === null || screen.classList.contains('hidden')) return;
    const anchor = preserve ? pages[index] : null;
    nav.hidden = false;
    previous.textContent = words('Назад', 'Back');
    next.textContent = words('Далее', 'Continue');
    counter.textContent = '1 / 1';
    // Short scenes stay a single page and pay no pagination-space overhead.
    nav.hidden = true;
    if (Array.from(source).length <= READING_PAGE_CHARACTERS && nodes.length <= READING_PAGE_CHOICES && fits(source, nodes, true)) {
      pages = [{ text: source, start: 0, end: source.length, items: nodes, choiceStart: 0, kind: 'text' }];
    } else {
      nav.hidden = false;
      pages = splitReadingText(source, { fits: prose => fits(prose) }).map(page => ({ ...page, items: [], kind: 'text' }));
      const last = pages.at(-1);
      if (nodes.length <= READING_PAGE_CHOICES && fits(last.text, nodes, true)) {
        last.items = nodes; last.choiceStart = 0;
      } else if (nodes.length) {
        let at = 0;
        while (at < nodes.length) {
          const items = [nodes[at]];
          while (at + items.length < nodes.length && items.length < READING_PAGE_CHOICES) {
            const candidate = [...items, nodes[at + items.length]];
            if (!fits('', candidate, at + candidate.length === nodes.length)) break;
            items.push(nodes[at + items.length]);
          }
          pages.push({ text: '', items, choiceStart: at, kind: 'choices' });
          at += items.length;
        }
      }
      // A long chapter footer gets its own presentation page, never clipping prose.
      const final = pages.at(-1);
      if (!fits(final.text, final.items, true) && related()?.childElementCount && !related().classList.contains('hidden')) {
        pages.push({ text: '', items: [], kind: 'continuation' });
      }
    }
    index = 0;
    if (anchor?.kind === 'text') {
      const found = pages.findIndex(page => page.start <= anchor.start && page.end > anchor.start);
      if (found >= 0) index = found;
    } else if (anchor?.items.length) {
      const found = pages.findIndex(page => page.items.includes(anchor.items[0]));
      if (found >= 0) index = found;
    } else if (anchor?.kind === 'continuation') index = pages.length - 1;
    show();
  }
  function schedule() {
    if (source !== null && !frame) frame = requestAnimationFrame(() => layout());
  }
  function resize() {
    const height = window.visualViewport?.height || window.innerHeight;
    screen.style.setProperty('--reader-viewport-height', `${height}px`);
    const updated = `${screen.clientWidth}:${height}:${panel.clientWidth}:${getComputedStyle(text).font}`;
    if (size !== updated) { size = updated; schedule(); }
  }
  previous.onclick = () => { if (!busy && index > 0) { index--; show({ focus: true }); } };
  next.onclick = () => { if (!busy && index + 1 < pages.length) { index++; show({ focus: true }); } };
  new ResizeObserver(resize).observe(screen);
  new ResizeObserver(resize).observe(panel);
  window.visualViewport?.addEventListener('resize', resize);
  window.addEventListener('resize', resize);
  document.fonts?.ready.then(schedule);
  document.fonts?.addEventListener('loadingdone', schedule);
  // Async chapter links, preview controls and request errors may change space.
  const observer = new MutationObserver(schedule);
  for (const node of panel.querySelectorAll('#status, .chapter-navigation, .draft-playtest-banner')) {
    observer.observe(node, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
  return {
    set(value) {
      source = String(value ?? '');
      nodes = [...choices.children];
      pages = []; index = 0;
      delete screen.dataset.readerReady;
      resize();
      layout(false);
    },
    busy(value) { busy = value; if (pages.length) show(); },
    clear() {
      source = null; nodes = []; pages = []; index = 0;
      if (frame) cancelAnimationFrame(frame);
      frame = 0; nav.hidden = true; choices.hidden = false; text.hidden = false;
      if (related()) related().hidden = false;
      delete screen.dataset.readerReady;
    },
  };
}
