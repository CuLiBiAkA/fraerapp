import { mountStandaloneDialogs } from './standalone-dialogs.js?v=1';

const ru = () => localStorage.getItem('fraerapp.language') !== 'en';
const words = (a, b) => ru() ? a : b;
function node(tag, text, className) {
  const n = document.createElement(tag);
  if (text) n.textContent = text;
  if (className) n.className = className;
  return n;
}

export function mountSiteControls({openSettings, openAccount} = {}) {
  if (document.querySelector('#site-controls')) return;
  const nav = node('nav'); nav.id = 'site-controls'; nav.setAttribute('aria-label', words('Настройки и аккаунт', 'Settings and account'));
  function icon(label, source, action, account = false) {
    const b = node('button'); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label;
    const img = node('img'); img.src = source; img.alt = ''; b.append(img);
    if (account) { b.dataset.siteAccount = ''; b.className = 'account-icon'; }
    b.onclick = action; nav.append(b); return b;
  }
  icon(words('Настройки', 'Settings'), '/assets/home/settings-neon.png', () => openSettings());
  icon(words('Личный кабинет', 'Account'), '/assets/home/account-neon.png', () => openAccount(), true);
  const builderNavigation = document.querySelector('.builder-navigation');
  if (builderNavigation) builderNavigation.append(nav);
  else {
    const home = node('a', null, 'site-home');
    const arrow = node('img'); arrow.src = '/builder/assets/figma/back.svg'; arrow.alt = '';
    home.append(arrow, node('span', words('На главную', 'Home')));
    home.href = '/';
    nav.prepend(home);
    document.body.prepend(nav);
  }
  if (openSettings && openAccount) return;

  mountStandaloneDialogs({setActions: (settings, account) => { openSettings = settings; openAccount = account; }});
}

if (!document.querySelector('#home-settings')) mountSiteControls();
