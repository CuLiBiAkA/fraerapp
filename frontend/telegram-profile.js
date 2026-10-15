import { fetchWithSession } from './auth-session.js?v=1';

export function profileLabel(user) {
  if (!user) return '';
  const name = user.displayName || '';
  const username = user.telegramUsername ? '@' + user.telegramUsername : '';
  const email = /^telegram-\d+@telegram\.fraerapp\.local$/.test(user.email || '') ? 'Telegram' : user.email;
  return [name, username].filter((part, index, values) => part && values.indexOf(part) === index).join(' · ') || email || '';
}

export function bindTelegramNotifications({ language }) {
  const button = document.querySelector('#modal-notifications-toggle');
  const hint = document.querySelector('#notifications-hint');
  // This hint depends on the authenticated account, not only the page language.
  hint.removeAttribute('data-i18n');
  const words = (ru, en) => language() === 'en' ? en : ru;
  let user = null, generation = 0, saving = false;
  function render() {
    button.disabled = saving || !user?.telegramLinked || !user?.telegramNotificationsAvailable;
    button.setAttribute('aria-checked', String(Boolean(user?.telegramNotificationsEnabled)));
    hint.textContent = !user?.telegramLinked
      ? words('Войдите через Telegram, чтобы получать уведомления от бота.', 'Sign in with Telegram to receive notifications from the bot.')
      : !user?.telegramNotificationsAvailable
        ? words('Доставка в Telegram пока недоступна. Уведомления остаются на сайте.', 'Telegram delivery is currently unavailable. Notifications remain on the website.')
        : words('Бот присылает те же уведомления, что и сайт. Их можно отключить здесь.', 'The bot sends the same notifications as the website. You can turn them off here.');
  }
  async function refresh() {
    if (saving) return;
    const version = ++generation;
    button.disabled = true;
    try {
      const response = await fetchWithSession('/auth/me', {credentials:'same-origin'});
      if (!response.ok) throw new Error('session');
      const next = await response.json();
      if (version !== generation) return;
      user = next; render();
    } catch {
      if (version !== generation) return;
      user = null; render();
      hint.textContent = words('Войдите через Telegram. Если вы уже вошли, откройте настройки ещё раз.', 'Sign in with Telegram. If already signed in, reopen settings.');
    }
  }
  button.addEventListener('click', async () => {
    if (button.disabled || saving) return;
    saving = true; ++generation; render();
    try {
      const response = await fetchWithSession('/auth/telegram/notifications', {
        method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({enabled:!user.telegramNotificationsEnabled}),
      });
      if (!response.ok) throw new Error('save');
      user = await response.json();
      saving = false; render();
    } catch {
      saving = false; render();
      hint.textContent = words('Не удалось сохранить настройку. Попробуйте ещё раз.', 'Could not save this setting. Please try again.');
    }
  });
  render();
  return { refresh };
}
