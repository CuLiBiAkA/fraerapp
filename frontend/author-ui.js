import {el, button, words} from './collection-ui.js?v=5';

export function coverImage(url, title = '') {
  const frame = el('div', null, 'author-cover');
  if (typeof url === 'string' && /^\/(assets|uploads)\/[\w./-]+$/.test(url) && !url.includes('..')) {
    const image = el('img'); image.src = url; image.alt = ''; image.loading = 'lazy';
    image.onerror = () => { image.remove(); frame.classList.add('author-cover-empty'); frame.textContent = '◇'; };
    frame.append(image);
  } else { frame.classList.add('author-cover-empty'); frame.textContent = '◇'; }
  frame.setAttribute('aria-hidden', 'true'); return frame;
}

export function authorCard({title, coverUrl, status, description, action, caption}) {
  const card = el('article', null, 'author-story-card');
  const text = el('div', null, 'author-card-copy');
  text.append(el('h2', title), el('p', status, 'author-card-status'));
  if (description) text.append(el('p', description, 'author-card-description'));
  if (caption) text.append(el('small', caption));
  const actions = el('div', null, 'author-card-actions'); actions.append(action);
  card.append(coverImage(coverUrl, title), text, actions); return card;
}

let nextTabs = 0;
export function editorTabs(entries, selected, onSelect = () => {}) {
  const id = `author-tabs-${++nextTabs}`, nav = el('div', null, 'author-tabs'); nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', words('Разделы истории', 'Story sections'));
  const controls = entries.map(([key, title, panel], index) => {
    panel.id = `${id}-panel-${key}`; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', `${id}-${key}`);
    const tab = button(title, () => selectTab(key)); tab.id = `${id}-${key}`; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', panel.id);
    tab.onkeydown = event => {
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % entries.length;
      else if (event.key === 'ArrowLeft') next = (index + entries.length - 1) % entries.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = entries.length - 1;
      else return;
      event.preventDefault(); selectTab(entries[next][0]); controls[next].focus();
    };
    nav.append(tab); return tab;
  });
  function selectTab(key) { entries.forEach(([entry, , panel], index) => { const active = entry === key; panel.hidden = !active; controls[index].setAttribute('aria-selected', String(active)); controls[index].tabIndex = active ? 0 : -1; }); onSelect(key); }
  selectTab(selected || entries[0][0]); return nav;
}

export async function showAuthoringPrompts(options = {}) {
  const {openAuthoringPrompts} = await import('/builder/authoring-prompts.js?v=1');
  return openAuthoringPrompts({language:document.documentElement.lang, ...options});
}
