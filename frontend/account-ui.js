export function createAccountUI({ request, email, language }) {
  let owner = null, account = null, pending = false;
  const ru = () => language() !== "en";
  const buttons = [...document.querySelectorAll('#home-profile, #library-profile')];
  const notices = document.querySelector('#profile-notifications');
  const status = document.querySelector('#profile-account-status');
  function paint() {
    const signed = Boolean(email());
    for (const button of buttons) {
      button.classList.add('account-icon');
      button.classList.toggle('account-signed', signed);
      button.classList.toggle('account-unread', signed && Boolean(account?.unreadCount));
      button.querySelector('img').src = '/assets/home/account-neon.png';
      button.setAttribute('aria-label', signed
        ? (account?.unreadCount ? (ru() ? `Аккаунт: ${account.unreadCount} непрочитанных уведомлений` : `Account: ${account.unreadCount} unread notifications`) : (ru() ? 'Открыть аккаунт' : 'Open account'))
        : (ru() ? 'Войти в профиль' : 'Sign in'));
    }
    document.querySelector('#profile-notification-title').textContent = (ru() ? 'Уведомления' : 'Notifications') + (account?.unreadCount ? ` (${account.unreadCount})` : '');
    notices.replaceChildren();
    if (!account) return;
    if (!account.notifications.length) {
      const empty = document.createElement('p'); empty.textContent = ru() ? 'Пока нет уведомлений' : 'No notifications yet'; notices.append(empty);
    }
    for (const notice of account.notifications) {
      const row = document.createElement('article'); row.className = 'account-notice';
      row.classList.toggle('is-unread', notice.unread);
      const text = document.createElement('p');
      text.textContent = notice.kind === 'story' ? `${ru() ? 'Новые сцены в истории' : 'New scenes in'} «${notice.message}»` : notice.message;
      row.append(text);
      if ((notice.kind === 'moderation' && notice.storyId) || notice.slug || notice.collectionId) {
        const link = document.createElement('a');
        link.href = notice.collectionId
          ? (notice.kind === 'collection_moderation' || notice.kind === 'moderation'
            ? `/my-stories/?view=collections&collection=${encodeURIComponent(notice.collectionId)}`
            : `/collections/${encodeURIComponent(notice.collectionId)}`)
          : notice.kind === 'moderation' && notice.storyId
          ? `/my-stories/?story=${encodeURIComponent(notice.storyId)}${notice.revision ? `&revision=${encodeURIComponent(notice.revision)}` : ''}`
          : `/history/${encodeURIComponent(notice.slug)}`;
        link.textContent = ['moderation','collection_moderation'].includes(notice.kind) ? (ru() ? 'Открыть решение' : 'View decision') : (ru() ? 'Открыть историю' : 'Open story'); row.append(link);
      }
      if (notice.unread) {
        const read = document.createElement('button'); read.type = 'button'; read.textContent = ru() ? 'Прочитано' : 'Mark as read';
        read.onclick = async () => {
          read.disabled = true;
          try { await request(`/api/account/notifications/${encodeURIComponent(notice.id)}/read`, {method:'POST'}); await refresh(true); }
          catch { status.textContent = ru() ? 'Не удалось отметить прочитанным. Попробуйте ещё раз.' : 'Could not mark as read. Try again.'; read.disabled = false; }
        }; row.append(read);
      }
      notices.append(row);
    }
  }
  async function refresh(force = false) {
    const current = email();
    if (owner !== current) { owner = current; account = null; status.textContent = ''; }
    paint();
    if (!current || pending || (account && !force)) return;
    pending = true;
    try { const result = await request('/api/account'); if (email() === current) { account = result; status.textContent = ''; } }
    catch { if (email() === current) status.textContent = ru() ? 'Не удалось загрузить профиль. Откройте окно ещё раз.' : 'Could not load your profile. Reopen this window.'; }
    finally { pending = false; paint(); }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(true); });
  const timer = setInterval(() => { if (!document.hidden) refresh(true); }, 60000);
  window.addEventListener('pagehide', () => clearInterval(timer), {once:true});
  return { refresh };
}
