export function createAccountUI({ request, email, language }) {
  let owner = null, account = null, pending = false, changing = false, version = 0;
  const ru = () => language() !== "en";
  const buttons = [...document.querySelectorAll('#home-profile, #library-profile, [data-site-account]')];
  const notices = document.querySelector('#profile-notifications');
  const status = document.querySelector('#profile-account-status');
  function paint() {
    const signed = Boolean(email());
    for (const button of buttons) {
      button.classList.add('account-icon');
      button.classList.toggle('account-signed', signed);
      button.classList.toggle('account-unread', signed && Boolean(account?.unreadCount));
      button.querySelector('img').src = '/assets/home/account-neon.webp';
      button.setAttribute('aria-label', signed
        ? (account?.unreadCount ? (ru() ? `Аккаунт: ${account.unreadCount} непрочитанных уведомлений` : `Account: ${account.unreadCount} unread notifications`) : (ru() ? 'Открыть аккаунт' : 'Open account'))
        : (ru() ? 'Войти в профиль' : 'Sign in'));
      button.title = button.getAttribute('aria-label');
    }
    document.querySelector('#profile-notification-title').textContent = (ru() ? 'Уведомления' : 'Notifications') + (account?.unreadCount ? ` (${account.unreadCount})` : '');
    notices.replaceChildren();
    if (!account) return;
    if (!account.notifications.length) {
      const empty = document.createElement('p'); empty.textContent = ru() ? 'Пока нет уведомлений' : 'No notifications yet'; notices.append(empty);
    } else {
      const clear = document.createElement('button'); clear.type = 'button';
      clear.textContent = ru() ? 'Очистить все' : 'Clear all'; clear.disabled = changing;
      clear.onclick = () => changeNotices('/api/account/notifications', 'DELETE');
      notices.append(clear);
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
        read.disabled = changing;
        read.onclick = () => changeNotices(`/api/account/notifications/${encodeURIComponent(notice.id)}/read`, 'POST');
        row.append(read);
      }
      const remove = document.createElement('button'); remove.type = 'button';
      remove.textContent = ru() ? 'Удалить' : 'Delete'; remove.disabled = changing;
      remove.onclick = () => changeNotices(`/api/account/notifications/${encodeURIComponent(notice.id)}`, 'DELETE');
      row.append(remove);
      notices.append(row);
    }
  }
  async function changeNotices(path, method) {
    if (changing) return;
    const current = email(), operation = ++version;
    changing = true;
    status.textContent = '';
    notices.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
      let result = await request(path, {method});
      if (method === 'POST') result = await request('/api/account');
      if (email() === current && version === operation) account = result;
    } catch {
      if (email() === current && version === operation) status.textContent = method === 'DELETE'
        ? (ru() ? 'Не удалось удалить уведомления. Попробуйте ещё раз.' : 'Could not delete notifications. Try again.')
        : (ru() ? 'Не удалось отметить прочитанным. Попробуйте ещё раз.' : 'Could not mark as read. Try again.');
    } finally {
      const restoreFocus = notices.contains(document.activeElement);
      changing = false;
      paint();
      if (restoreFocus) (notices.querySelector('button') || document.querySelector('#profile-notification-title')).focus();
    }
  }
  async function refresh(force = false) {
    const current = email();
    if (owner !== current) { owner = current; account = null; status.textContent = ''; version++; }
    if (changing) return;
    paint();
    if (!current || pending || (account && !force)) return;
    const snapshotVersion = version;
    pending = true;
    try { const result = await request('/api/account'); if (email() === current && version === snapshotVersion) { account = result; status.textContent = ''; } }
    catch { if (email() === current && version === snapshotVersion) status.textContent = ru() ? 'Не удалось загрузить профиль. Откройте окно ещё раз.' : 'Could not load your profile. Reopen this window.'; }
    finally { pending = false; if (!changing && version === snapshotVersion) paint(); }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(true); });
  const timer = setInterval(() => { if (!document.hidden) refresh(true); }, 60000);
  window.addEventListener('pagehide', () => clearInterval(timer), {once:true});
  return { refresh };
}
