import { mountAccountDialogs } from './account-dialogs.js?v=1';
import { createAccountUI } from './account-ui.js?v=6';
import { credentialToJson, parseCreationOptions, passkeysSupported } from './passkeys.js';

export function mountStandaloneDialogs({setActions}) {
  mountAccountDialogs();
  const $ = s => document.querySelector(s);
  const en = localStorage.getItem('fraerapp.language') === 'en';
  const words = (ru, english) => en ? english : ru;
  const profile = $('#profile-modal'), settings = $('#settings-modal');
  let user = null, previousFocus;
  const translations = {settingsModalTitle:'Settings', profileModalTitle:'Account', settingsSound:'Sound', settingsLanguage:'Language', settingsNotifications:'Notifications', notificationsHint:'Notifications are available in your account. Push notifications are coming later.', settingsSupport:'Support', settingsPasskey:'Add passkey', privacyLink:'Privacy', consentLink:'Consent', termsLink:'Terms of use', favoritesOnly:'Favorites', myStories:'My stories', builderButton:'Builder', moderationButton:'Moderation', profileAdmin:'Administrator', logoutButton:'Sign out'};
  if (en) for (const n of document.querySelectorAll('#settings-modal [data-i18n], #profile-modal [data-i18n]')) n.textContent = translations[n.dataset.i18n] || n.textContent;
  if (en) $('#modal-volume').previousElementSibling.textContent = 'Volume';
  // Page-specific dictionaries must not replace shared dialog labels with keys.
  document.querySelectorAll('#settings-modal [data-i18n], #profile-modal [data-i18n]').forEach(n=>n.removeAttribute('data-i18n'));
  if (en) { $('#profile-notification-title').textContent = 'Notifications'; document.querySelectorAll('.modal-close').forEach(n => n.setAttribute('aria-label','Close')); }
  async function request(url, options = {}) {
    const response = await fetch(url, {credentials:'same-origin', ...options});
    if (!response.ok) throw new Error(String(response.status));
    return response.status === 204 ? null : response.json();
  }
  function close() { profile.classList.add('hidden'); settings.classList.add('hidden'); document.body.classList.remove('modal-open'); previousFocus?.focus(); }
  function open(modal) { previousFocus = document.activeElement; modal.classList.remove('hidden'); document.body.classList.add('modal-open'); modal.querySelector('.modal-close').focus(); }
  for (const n of document.querySelectorAll('.modal-close, [data-modal-close]')) n.addEventListener('click',close);
  document.addEventListener('keydown', e => {
    const modal = document.querySelector('.modal-layer:not(.hidden)'); if (!modal) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') {
      const items = [...modal.querySelectorAll('button, a[href], input, summary')].filter(n => !n.disabled && n.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  const account = createAccountUI({request, email:()=>user?.email, language:()=>en?'en':'ru'});
  async function refresh() {
    try { user = await request('/auth/me'); } catch { user = null; }
    $('#profile-modal-email').textContent = user?.email || '';
    const roles = user?.roles || [];
    for (const [id, allowed] of [['builder',['author','admin']],['moderation',['moderator','admin']],['admin',['admin']]]) $('#profile-'+id).classList.toggle('hidden', !roles.some(r=>allowed.includes(r)));
    await account.refresh(true);
  }
  const ready = refresh();
  $('#modal-volume').value = localStorage.getItem('fraerapp.volume') || '45';
  $('#modal-volume').oninput = e => localStorage.setItem('fraerapp.volume',e.target.value);
  setActions(() => { $('#modal-settings-status').textContent = ''; open(settings); }, async () => { await ready; if (!user) { location.assign('/?panel=account'); return; } open(profile); refresh(); });
  for (const [id, url] of Object.entries({favorites:'/?panel=favorites', 'my-stories':'/my-stories/', builder:'/builder/', moderation:'/moderation/', admin:'/auth/admin'})) $('#profile-'+id).onclick=()=>location.assign(url);
  $('#profile-logout').onclick = async () => {
    const b=$('#profile-logout');b.disabled=true;
    try { await request('/auth/logout',{method:'POST'}); localStorage.removeItem('fraerapp.email'); localStorage.removeItem('fraerapp.roles'); location.assign('/'); }
    catch { $('#profile-account-status').textContent=words('Не удалось выйти. Попробуйте ещё раз.','Could not sign out. Try again.'); b.disabled=false; }
  };
  for (const lang of ['ru','en']) {
    const b=$('#modal-lang-'+lang);b.classList.toggle('is-active',lang===(en?'en':'ru'));
    b.onclick=()=>{localStorage.setItem('fraerapp.language',lang);localStorage.setItem('fraerapp.storyBuilderLanguage',lang);location.reload();};
  }
  for (const [id,key] of [['sound','fraerapp.sound'],['notifications','fraerapp.notifications']]) {
    const b=$('#modal-'+id+'-toggle');b.setAttribute('aria-checked',String(localStorage.getItem(key)==='true'));
    b.onclick=()=>{const enabled=b.getAttribute('aria-checked')!=='true';localStorage.setItem(key,String(enabled));b.setAttribute('aria-checked',String(enabled));};
  }
  $('#modal-support').onclick=()=>{$('#modal-settings-status').textContent=words('Контакт поддержки скоро появится здесь.','Support contact details will appear here soon.');};
  $('#modal-passkey').onclick=async()=>{
    const b=$('#modal-passkey'), status=$('#modal-settings-status');
    if (!user) { location.assign('/?panel=account'); return; }
    if (!passkeysSupported()) { status.textContent=words('Этот браузер не поддерживает passkey.','This browser does not support passkeys.');return; }
    b.disabled=true;
    try {
      const options=await request('/auth/passkeys/registration/options',{method:'POST'});
      const credential=await navigator.credentials.create({publicKey:parseCreationOptions(options.publicKey)});
      if(!credential)throw new Error('cancelled');
      await request('/auth/passkeys/registration/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challengeId:options.challengeId,displayName:'',credential:credentialToJson(credential)})});
      status.textContent=words('Passkey добавлен.','Passkey added.');
    } catch { status.textContent=words('Не удалось добавить passkey. Повторно войдите в аккаунт и попробуйте ещё раз.','Could not add passkey. Sign in again and retry.'); }
    finally { b.disabled=false; }
  };
  window.addEventListener('focus',refresh);
}
