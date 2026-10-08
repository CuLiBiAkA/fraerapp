// One shared template for account and settings on every page.
export function mountAccountDialogs() {
  if (document.querySelector("#settings-modal")) return;
  const template = document.createElement("template");
  template.innerHTML = `    <div id="settings-modal" class="modal-layer hidden" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
      <div class="modal-backdrop" data-modal-close="settings"></div>
      <section class="modal-card compact-modal-card">
        <button id="settings-modal-close" class="modal-close" type="button" aria-label="Закрыть"></button>
        <h2 id="settings-modal-title" data-i18n="settingsModalTitle">Настройки</h2>
        <div class="modal-setting-row">
          <span id="modal-sound-label" data-i18n="settingsSound">Звук</span>
          <button id="modal-sound-toggle" class="settings-switch" type="button" role="switch" aria-checked="false" aria-labelledby="modal-sound-label"></button>
        </div>
        <div class="modal-setting-row">
          <span data-i18n="settingsLanguage">Язык</span>
          <div class="modal-segmented">
            <button id="modal-lang-ru" type="button">RU</button>
            <button id="modal-lang-en" type="button">EN</button>
          </div>
        </div>
        <label class="modal-setting-row"><span data-i18n="volumeLabel">Громкость</span><input id="modal-volume" type="range" min="0" max="100" value="45"></label>
        <div class="modal-setting-row">
          <span id="modal-notifications-label" data-i18n="settingsNotifications">Уведомления</span>
          <button id="modal-notifications-toggle" class="settings-switch" type="button" role="switch" aria-checked="false" aria-labelledby="modal-notifications-label" aria-describedby="notifications-hint"></button>
        </div>
        <p id="notifications-hint" class="settings-hint" data-i18n="notificationsHint">Уведомления доступны в личном кабинете. Push-уведомления появятся позже.</p>
        <div class="settings-actions">
          <button id="modal-support" type="button" data-i18n="settingsSupport">Поддержка</button>
          <button id="modal-passkey" type="button" data-i18n="settingsPasskey">Привязать passkey</button>
        </div>
        <p id="modal-settings-status" class="settings-hint" role="status" aria-live="polite"></p>
        <div class="modal-links">
          <a href="/privacy-policy.html" target="_blank" rel="noopener" data-i18n="privacyLink">Политика</a>
          <a href="/personal-data-consent.html" target="_blank" rel="noopener" data-i18n="consentLink">Согласие</a>
          <a href="/terms.html" target="_blank" rel="noopener" data-i18n="termsLink">Пользовательское соглашение</a>
        </div>
      </section>
    </div>

    <div id="profile-modal" class="modal-layer hidden" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
      <div class="modal-backdrop" data-modal-close="profile"></div>
      <section class="modal-card compact-modal-card">
        <button id="profile-modal-close" class="modal-close" type="button" aria-label="Закрыть"></button>
        <h2 id="profile-modal-title" data-i18n="profileModalTitle">Аккаунт</h2>
        <p id="profile-modal-email" class="profile-email"></p>
        <p id="profile-account-status" role="status"></p>
        <button id="profile-favorites" type="button" class="outline-button" data-i18n="favoritesOnly">Избранное</button>
        <button id="profile-my-stories" type="button" class="outline-button" data-i18n="myStories">Мои истории</button>
        <a id="profile-subscription" class="outline-button" href="/subscription/" data-i18n="subscription">Подписка</a>
        <button id="profile-builder" type="button" class="outline-button hidden" data-i18n="builderButton">Конструктор</button>
        <button id="profile-moderation" type="button" class="outline-button hidden" data-i18n="moderationButton">Модерация</button>
        <button id="profile-admin" type="button" class="outline-button hidden" data-i18n="profileAdmin">Администратор</button>
        <button id="profile-logout" type="button" class="outline-button" data-i18n="logoutButton">Выйти</button>
        <details id="profile-notification-panel"><summary id="profile-notification-title">Уведомления</summary><div id="profile-notifications"></div></details>
      </section>
    </div>

`;
  document.body.append(template.content.cloneNode(true));
}
