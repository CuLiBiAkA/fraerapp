// Shared author/Builder/moderation presentation rules. The API remains the authority.
const words = {
  ru: {
    draft: "Черновик", in_review: "На согласовании", approved: "Одобрена", rejected: "Нужны исправления",
    public: "Публичная", unlisted: "По ссылке", private: "Не опубликована", hidden: "Скрыта модератором", archived: "В архиве", deleted: "В корзине",
    published: "Опубликована", previousPublication: "Последняя публикация", noPublication: "Не опубликована",
    all: "Все", drafts: "Черновики", review: "На согласовании", corrections: "Нужны исправления", publications: "Опубликованные", restricted: "Скрытые / архив", trash: "Корзина",
    edit: "Продолжить редактирование", submit: "Отправить на проверку", withdraw: "Отозвать заявку", preview: "Приватное превью", archive: "В архив", delete: "В корзину", restore: "Восстановить в приватную",
    approve: "Одобрить без публикации", "approve-publish": "Одобрить и опубликовать", "publish-approved": "Опубликовать одобренную", reject: "Отклонить", hide: "Скрыть", visibility: "Изменить доступность",
    submitted: "Отправлена", superseded: "Заявка заменена", withdrawn: "Заявка отозвана", author_archive: "Архивировано автором", author_delete: "Удалено автором",
    migration_approved: "Разрешённая миграция публикации", metadata: "Метаданные", variables: "Переменные", assets: "Ресурсы", scenes: "Сцены", choices: "Выборы и переходы", noChanges: "Различий с опубликованной редакцией нет", firstPublication: "Публичной редакции ещё нет: всё содержимое новое.",
    before: "Опубликовано", after: "Просматриваемая редакция", changed: "Изменено", added: "Добавлено", removed: "Удалено", raw: "Полный JSON редакции", missing: "Не задано", mediaUnavailable: "Для этого адреса доступен только просмотр URL", noScenes: "Нет сцен",
  },
  en: {
    draft: "Draft", in_review: "In review", approved: "Approved", rejected: "Needs changes",
    public: "Public", unlisted: "Unlisted", private: "Not published", hidden: "Hidden by moderator", archived: "Archived", deleted: "In trash",
    published: "Published", previousPublication: "Last publication", noPublication: "Not published",
    all: "All", drafts: "Drafts", review: "In review", corrections: "Needs changes", publications: "Published", restricted: "Hidden / archived", trash: "Trash",
    edit: "Continue editing", submit: "Submit for review", withdraw: "Withdraw submission", preview: "Private preview", archive: "Archive", delete: "Move to trash", restore: "Restore as private",
    approve: "Approve without publishing", "approve-publish": "Approve and publish", "publish-approved": "Publish approved revision", reject: "Reject", hide: "Hide", visibility: "Change visibility",
    submitted: "Submitted", superseded: "Submission replaced", withdrawn: "Submission withdrawn", author_archive: "Archived by author", author_delete: "Deleted by author",
    migration_approved: "Authorized publication migration", metadata: "Metadata", variables: "Variables", assets: "Assets", scenes: "Scenes", choices: "Choices and transitions", noChanges: "No differences from the published revision", firstPublication: "There is no published revision yet: all content is new.",
    before: "Published", after: "Selected revision", changed: "Changed", added: "Added", removed: "Removed", raw: "Complete revision JSON", missing: "Not set", mediaUnavailable: "Only the URL can be inspected for this address", noScenes: "No scenes",
  },
};

export function workflowLabel(key, language = "ru") {
  return words[language === "en" ? "en" : "ru"][key] || key;
}

export function canEditStories(user) {
  return !user?.blocked && Boolean(user?.roles?.some(role => role === "author" || role === "admin"));
}

export function canModerateStories(user) {
  return !user?.blocked && Boolean(user?.roles?.some(role => role === "moderator" || role === "admin"));
}

export function workspaceTarget(value) {
  if (["my-stories", "/my-stories", "/my-stories/"].includes(value)) return "/my-stories/";
  if (["moderation", "/moderation", "/moderation/"].includes(value)) return "/moderation/";
  return null;
}

export function allowsWorkspace(target, user) {
  if (!user || user.blocked || !(user.id || user.userId)) return false;
  return target === "/my-stories/" || (target === "/moderation/" && canModerateStories(user));
}

export function isOwnStory(story, user) {
  return Boolean(story.ownerUserId && String(story.ownerUserId) === String(user?.id ?? user?.userId));
}

export function authorActions(story, user) {
  if (!canEditStories(user) || story.visibility === "deleted") return [];
  const actions = ["edit"];
  if (story.hasDraft) actions.push("submit");
  if (story.reviewState === "in_review") actions.push("withdraw");
  if (!story.restricted && story.visibility !== "archived") {
    actions.push("archive");
    if (!story.publishedRevision) actions.push("delete");
  }
  return actions;
}

export function moderationActions(story, user) {
  if (!canModerateStories(user)) return [];
  const mayRestoreOrApprove = !isOwnStory(story, user) || user.roles.includes("admin");
  if (story.visibility === "deleted") return mayRestoreOrApprove ? ["restore"] : [];
  const restricted = story.restricted || ["hidden", "archived"].includes(story.visibility);
  const actions = [];
  if (story.reviewState === "in_review" && story.submittedRevision) {
    if (mayRestoreOrApprove) {
      if (!restricted) actions.push("approve-publish");
      actions.push("approve");
    }
    actions.push("reject");
  }
  if (story.reviewState === "approved" && story.submittedRevision && !restricted && mayRestoreOrApprove
      && (story.publishedRevision !== story.submittedRevision || !["public", "unlisted"].includes(story.visibility))) actions.push("publish-approved");
  if (restricted && mayRestoreOrApprove) actions.push("restore");
  if (!restricted && mayRestoreOrApprove) actions.push("visibility");
  if (story.visibility !== "hidden") actions.push("hide");
  if (story.visibility !== "archived") actions.push("archive");
  actions.push("delete");
  return actions;
}

export function needsOwnOverride(action, story, user) {
  return isOwnStory(story, user) && ["approve", "approve-publish", "publish-approved", "restore", "visibility"].includes(action);
}

export function storyLabels(story, language = "ru") {
  const t = key => workflowLabel(key, language);
  const labels = [];
  if (story.publishedRevision) labels.push(`${t(["public", "unlisted"].includes(story.visibility) ? "published" : "previousPublication")} v${story.publishedRevision}`);
  else labels.push(t("noPublication"));
  if (story.submittedRevision && story.reviewState !== "draft") labels.push(`${t(story.reviewState)} v${story.submittedRevision}`);
  if (story.hasDraft) labels.push(`${t("draft")} v${story.draftRevision}`);
  if (story.visibility !== "public" && (story.publishedRevision || story.visibility !== "private")) labels.push(t(story.visibility));
  return labels;
}

export function revisionLabels(story, revision, language = "ru") {
  const labels = [];
  if (story.publishedRevision === revision) labels.push(workflowLabel("published", language));
  if (story.submittedRevision === revision && story.reviewState !== "draft") labels.push(workflowLabel(story.reviewState, language));
  if (story.hasDraft && story.draftRevision === revision) labels.push(workflowLabel("draft", language));
  return labels;
}

export const authorFilters = ["all", "drafts", "review", "corrections", "publications", "restricted", "trash"];

export function matchesAuthorFilter(story, filter = "all", query = "") {
  const found = `${story.title || ""} ${story.key || ""} ${story.ownerName || ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  if (!found) return false;
  if (filter === "trash") return story.visibility === "deleted";
  if (story.visibility === "deleted") return false;
  switch (filter) {
    case "drafts": return Boolean(story.hasDraft);
    case "review": return story.reviewState === "in_review";
    case "corrections": return story.reviewState === "rejected";
    case "publications": return Boolean(story.publishedRevision) && ["public", "unlisted"].includes(story.visibility);
    case "restricted": return ["hidden", "archived"].includes(story.visibility);
    default: return true;
  }
}

export function filterAfterSubmit(filter) { return filter === "drafts" ? "review" : filter; }

export function publicStoryUrl(story) {
  return story.publishedRevision && story.publishedSlug && ["public", "unlisted"].includes(story.visibility)
    ? `/history/${encodeURIComponent(story.publishedSlug)}` : null;
}

export function documentChanges(before, after, path = "") {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  const object = value => value !== null && typeof value === "object";
  if (object(before) && object(after) && Array.isArray(before) === Array.isArray(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => documentChanges(before[key], after[key], `${path}/${String(key).replaceAll("~", "~0").replaceAll("/", "~1")}`));
  }
  return [{ path: path || "/", before, after, kind: before === undefined ? "added" : after === undefined ? "removed" : "changed" }];
}

export function safePreviewMediaUrl(value) {
  return typeof value === "string" && /^\/(?:uploads|assets)\/[A-Za-z0-9_./%\-]+$/.test(value) && !value.includes("..") ? value : null;
}

export function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined && text !== null) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}

function jsonSection(title, value, open = false) {
  const details = node("details", null, "workspace-json");
  details.open = open;
  details.append(node("summary", title), node("pre", JSON.stringify(value, null, 2)));
  return details;
}

function renderAssets(assets, language) {
  const section = node("section", null, "workspace-assets");
  for (const asset of assets || []) {
    const card = node("figure");
    card.append(node("figcaption", `${asset.id || "—"} · ${asset.type || "—"}`));
    const url = safePreviewMediaUrl(asset.url);
    if (url && ["image", "audio", "music", "sound", "video"].includes(asset.type)) {
      const media = node(asset.type === "image" ? "img" : asset.type === "video" ? "video" : "audio");
      media.src = url;
      if (asset.type === "image") { media.alt = asset.id || ""; media.loading = "lazy"; }
      else { media.controls = true; media.preload = "none"; }
      card.append(media);
    } else if (asset.url) card.append(node("p", workflowLabel("mediaUnavailable", language)));
    card.append(node("code", asset.url || workflowLabel("missing", language)));
    if (asset.metadata) card.append(jsonSection(workflowLabel("metadata", language), asset.metadata));
    section.append(card);
  }
  return section;
}

export function renderStoryDocument(documentValue, language = "ru") {
  const doc = documentValue || {};
  const result = node("div", null, "workspace-document");
  const t = key => workflowLabel(key, language);
  result.append(node("h3", doc.title || doc.key || "—"), node("p", doc.description || "", "workspace-prose"));
  const { scenes, assets, variables, ...metadata } = doc;
  result.append(jsonSection(t("metadata"), metadata), jsonSection(t("variables"), variables || {}));
  result.append(node("h4", t("assets")), renderAssets(assets, language), node("h4", `${t("scenes")} (${scenes?.length || 0})`));
  for (const scene of scenes || []) {
    const details = node("details", null, "workspace-scene");
    details.open = true;
    details.append(node("summary", `${scene.id} · ${scene.title || ""}`), node("p", scene.text || "", "workspace-prose"));
    const { text, assets: localAssets, choices, ...sceneMetadata } = scene;
    details.append(jsonSection(t("metadata"), sceneMetadata), renderAssets(localAssets, language));
    for (const [index, choice] of (choices || []).entries()) {
      details.append(jsonSection(`${index + 1}. ${choice.text || choice.label || t("choices")}`, choice, true));
    }
    result.append(details);
  }
  if (!scenes?.length) result.append(node("p", t("noScenes")));
  result.append(jsonSection(t("raw"), doc));
  return result;
}

export function renderDocumentDiff(before, after, language = "ru") {
  const result = node("div", null, "workspace-diff");
  const t = key => workflowLabel(key, language);
  if (!before) { result.append(node("p", t("firstPublication"))); return result; }
  const changes = documentChanges(before, after);
  if (!changes.length) result.append(node("p", t("noChanges")));
  for (const change of changes) {
    const row = node("details");
    row.append(node("summary", `${t(change.kind)} · ${change.path}`));
    const values = node("div", null, "workspace-diff-values");
    for (const [label, value] of [["before", change.before], ["after", change.after]]) {
      const side = node("div");
      side.append(node("strong", t(label)), node("pre", value === undefined ? "∅" : JSON.stringify(value, null, 2)));
      values.append(side);
    }
    row.append(values); result.append(row);
  }
  return result;
}
