import { mountStandaloneDialogs } from './standalone-dialogs.js?v=3';

const ru = () => localStorage.getItem('fraerapp.language') !== 'en';
const words = (a, b) => ru() ? a : b;
function node(tag, text, className) {
  const n = document.createElement(tag);
  if (text) n.textContent = text;
  if (className) n.className = className;
  return n;
}

export function updateSiteControlsLanguage() {
  const nav = document.querySelector('#site-controls');
  if (!nav) return;
  nav.lang = ru() ? 'ru' : 'en';
  nav.setAttribute('aria-label', words('Настройки и аккаунт', 'Settings and account'));
  const settings = nav.querySelector('[data-site-settings]');
  const label = words('Настройки', 'Settings');
  settings.setAttribute('aria-label', label);
  settings.title = label;
  const home = nav.querySelector('.site-home span');
  if (home) home.textContent = words('На главную', 'Home');
}

export function mountSiteControls({openSettings, openAccount} = {}) {
  if (document.querySelector('#site-controls')) return;
  const nav = node('nav'); nav.id = 'site-controls'; nav.setAttribute('aria-label', words('Настройки и аккаунт', 'Settings and account'));
  function icon(label, source, action, account = false) {
    const b = node('button'); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label;
    const img = node('img'); img.src = source; img.alt = ''; img.width = 48; img.height = 48; img.decoding = 'async'; b.append(img);
    if (account) { b.dataset.siteAccount = ''; b.className = 'account-icon'; }
    b.onclick = action; nav.append(b); return b;
  }
  icon(words('Настройки', 'Settings'), '/assets/home/settings-neon.webp', () => openSettings()).dataset.siteSettings = '';
  icon(words('Личный кабинет', 'Account'), '/assets/home/account-neon.webp', () => openAccount(), true);
  const builderNavigation = document.querySelector('.builder-navigation');
  if (builderNavigation) builderNavigation.append(nav);
  else {
    const home = node('a', null, 'site-home');
    const arrow = node('img'); arrow.src = '/builder/assets/figma/back.svg'; arrow.alt = '';
    home.append(arrow, node('span', words('На главную', 'Home')));
    home.href = '/';
    nav.prepend(home);
    const skip = document.body.querySelector(':scope > a[href^="#"]');
    if (skip) skip.after(nav);
    else document.body.prepend(nav);
  }
  updateSiteControlsLanguage();
  new ResizeObserver(() => document.documentElement.style.setProperty('--site-controls-height', `${nav.getBoundingClientRect().height}px`)).observe(nav);
  if (openSettings && openAccount) return;

  mountStandaloneDialogs({setActions: (settings, account) => { openSettings = settings; openAccount = account; }});
}

if (!document.querySelector('#home-settings')) mountSiteControls();
