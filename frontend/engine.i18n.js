export const translations = {
  ru: {
    noStories: "Опубликованных историй пока нет.",
    endingLabel: "Финал: {title}",
    endingFallback: "завершено",
    progressSaved: "Прогресс сохранен",
    sessionFinished: "Сессия завершена",
    loading: "Загрузка...",
    loginFailed: "Не удалось войти: {message}",
    webAudioUnsupported: "Web Audio не поддерживается в этом браузере",
    importFirst: "Сначала импортируйте историю.",
    errorPrefix: "Ошибка: {message}",
    soundOn: "Звук: включен",
    soundOff: "Звук: выключен",
  },
  en: {
    noStories: "No published stories yet.",
    endingLabel: "Ending: {title}",
    endingFallback: "finished",
    progressSaved: "Progress saved",
    sessionFinished: "Session finished",
    loading: "Loading...",
    loginFailed: "Login failed: {message}",
    webAudioUnsupported: "Web Audio is not supported",
    importFirst: "Import a story first.",
    errorPrefix: "Error: {message}",
    soundOn: "Sound: on",
    soundOff: "Sound: off",
  },
};

export function normalizeLanguage(language) {
  return language === "en" ? "en" : "ru";
}

export function translate(language, key, params = {}) {
  const normalized = normalizeLanguage(language);
  const template = translations[normalized]?.[key] ?? translations.ru[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
}

export function soundLabel(language, enabled) {
  return translate(language, enabled ? "soundOn" : "soundOff");
}

export function sessionStatusLabel(language, status) {
  return translate(language, status === "finished" ? "sessionFinished" : "progressSaved");
}

export function endingLabel(language, ending) {
  return translate(language, "endingLabel", {
    title: ending?.title || ending?.type || translate(language, "endingFallback"),
  });
}
