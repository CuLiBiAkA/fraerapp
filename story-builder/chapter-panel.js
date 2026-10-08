// One workspace, with keyboard-accessible tabs in authoring order.
export function initChapterTabs(root) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  function select(name, focus = false) {
    root.querySelector('#api-result').textContent = '';
    for (const tab of tabs) {
      const active = tab.dataset.chapterTab === name;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      root.querySelector('#' + tab.getAttribute('aria-controls')).hidden = !active;
      if (active && focus) tab.focus();
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab.dataset.chapterTab));
    tab.addEventListener('keydown', event => {
      let next;
      if (['ArrowDown', 'ArrowRight'].includes(event.key)) next = (index + 1) % tabs.length;
      if (['ArrowUp', 'ArrowLeft'].includes(event.key)) next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); select(tabs[next].dataset.chapterTab, true); }
    });
  });
  select('chapter');
  return select;
}
