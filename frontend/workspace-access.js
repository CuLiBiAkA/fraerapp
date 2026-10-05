import { allowsWorkspace, workspaceTarget } from "./story-workflow.js?v=1";

const language = localStorage.getItem("fraerapp.language") === "en" ? "en" : "ru";
document.documentElement.lang = language;
const text = (ru, en) => language === "en" ? en : ru;
const title = document.querySelector("#access-title");
const status = document.querySelector("#access-status");
const home = document.querySelector("#access-home");
const mine = document.querySelector("#access-mine");
title.textContent = text("Проверяем доступ", "Checking access");
status.textContent = text("Восстанавливаем текущую сессию…", "Restoring your current session…");
home.textContent = text("На главную для входа", "Go home to sign in");
mine.textContent = text("Мои истории", "My stories");
const target = workspaceTarget(new URLSearchParams(location.search).get("next"));

async function readCurrentSession() {
  let response = await fetch("/auth/me", { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } });
  if (response.status === 401) {
    const refreshed = await fetch("/auth/refresh", { method: "POST", credentials: "include", cache: "no-store", headers: { Accept: "application/json", "X-Fraer-Request": "same-origin" } });
    if (refreshed.ok) response = await fetch("/auth/me", { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } });
  }
  if (!response.ok) { const error = new Error(); error.status = response.status; throw error; }
  return response.json();
}

if (!target) {
  title.textContent = text("Раздел не найден", "Section not found");
  status.textContent = text("Откройте «Мои истории» или «Модерация» из своего профиля.", "Open My stories or Moderation from your profile.");
} else {
  try {
    const user = await readCurrentSession();
    if (allowsWorkspace(target, user)) location.replace(target);
    else {
      title.textContent = text("Нет доступа к модерации", "Moderation access denied");
      status.textContent = text("Для этого раздела нужна актуальная роль модератора или администратора. Свои работы можно просмотреть в «Моих историях».", "This section requires a current moderator or administrator role. You can view your own work in My stories.");
      mine.hidden = !allowsWorkspace("/my-stories/", user);
    }
  } catch (error) {
    title.textContent = text("Не удалось открыть раздел", "Could not open this section");
    status.textContent = error.status === 401
      ? text("Сессия завершена. Войдите на главной странице и откройте раздел снова.", "Your session ended. Sign in on the home page and open this section again.")
      : error.status === 403
        ? text("Нет доступа к текущей сессии. Вернитесь на главную страницу.", "This session cannot access the section. Return to the home page.")
        : text("Проверка доступа временно недоступна. Обновите страницу через некоторое время.", "Access checks are temporarily unavailable. Reload this page shortly.");
  }
}
