import { canEditStories, filterAfterSubmit, storyLabels, workflowLabel } from "../story-workflow.js?v=1";
import { reviewLimitMessage } from "../review-limit.js?v=1";
import { decorateHelp, helpButton, helpTopics } from "./help.js?v=4";

import { initChapterTabs } from "./chapter-panel.js?v=1";
import { genres, topics, fillClassification } from "./genre-topic.js?v=1";
const selectChapterTab = initChapterTabs(document.querySelector("#chapter-workspace"));
let chapterParent = null;
const sceneTextControls = new WeakMap();

const els = {
  runtimeUrl: document.querySelector("#runtime-url"),
  adminToken: document.querySelector("#admin-token"),
  meta: [...document.querySelectorAll("[data-meta]")],
  variables: document.querySelector("#variables"),
  assets: document.querySelector("#assets"),
  scenes: document.querySelector("#scenes"),
  variableOutline: document.querySelector("#variable-outline"),
  assetOutline: document.querySelector("#asset-outline"),
  sceneOutline: document.querySelector("#scene-outline"),
  activeContext: document.querySelector("#active-context"),
  validation: document.querySelector("#validation"),
  apiResult: document.querySelector("#api-result"),
  pasteDialog: document.querySelector("#paste-dialog"),
  pasteArea: document.querySelector("#paste-area"),
  authorName: document.querySelector("#author-name"),
  authorLogin: document.querySelector("#author-login"),
  authorLogout: document.querySelector("#author-logout"),
  authorState: document.querySelector("#author-state"),
  langRu: document.querySelector("#lang-ru"),
  langEn: document.querySelector("#lang-en"),
  quickAddScene: document.querySelector("#quick-add-scene"),
  scrollTop: document.querySelector("#scroll-top"),
  scrollBottom: document.querySelector("#scroll-bottom"),
};

const translations = {
  ru: {
    pageTitle: "FraerApp - Конструктор историй",
    builderTitle: "Конструктор историй",
    authorSessionLabel: "Общая сессия FraerApp",
    authorSessionRefresh: "Проверить вход",
    runtimeApiLabel: "API рантайма",
    adminTokenLabel: "Админ-действия требуют роль admin",
    loadExample: "Загрузить пример",
    copyJson: "Копировать JSON",
    downloadJson: "Скачать JSON",
    importJsonFile: "Импорт JSON-файла",
    pasteJson: "Вставить JSON",
    clearDraft: "Очистить черновик",
    localDraftSaveFailed: "Не удалось сохранить черновик на этом устройстве. Изменения остаются в открытой вкладке. Скачайте JSON или сохраните главу на сервере перед закрытием.",
    backToSite: "На главную",
    invalidJson: "Не удалось открыть JSON: {message}",
    draftChanged: "История или сервер изменились во время операции. Действие остановлено; повторите его для нужной истории.",
    storyMetadata: "Метаданные истории",
    keyLabel: "Ключ",
    titleLabel: "Название",
    versionLabel: "Версия",
    startSceneLabel: "Стартовая сцена",
    descriptionLabel: "Описание",
    genreLabel: "Жанр",
    topicLabel: "Тема",
    variablesTitle: "Переменные",
    addVariable: "Добавить переменную",
    assetsTitle: "Медиафайлы",
    addAsset: "Добавить медиафайл",
    scenesTitle: "Сцены",
    addScene: "Добавить сцену",
    runtimeActions: "Действия с runtime",
    importToRuntime: "Сохранить черновик на сервере",
    validateLastImport: "Проверить последний импорт",
    publishLastImport: "Отправить на проверку",
    myStories: "Мои истории",
    storyStatusFilter: "Состояние работы",
    unsavedChanges: "Есть несохранённые изменения. Они хранятся только в этом браузере.",
    savedOnServer: "Сохранено на сервере · редакция v{revision}",
    changeSaved: "Изменение сохранено.",
    reviewSent: "Редакция v{revision} отправлена на согласование. Публикация не меняется.",
    replaceReviewConfirm: "Заменить заявку v{revision} новым сохранённым черновиком? Старую заявку больше нельзя будет одобрить.",
    staleStory: "История изменилась. Список обновлён: проверьте текущую редакцию и повторите действие.",
    withdrawConfirm: "Отозвать заявку «{title}»? Черновик и предыдущая публикация сохранятся.",
    archiveConfirm: "Архивировать «{title}»? История станет недоступна читателям. Данные и прогресс сохранятся.",
    switchUnsaved: "В текущей истории есть изменения только в этом браузере. Открыть другую историю и заменить их?",
    leaveChapterUnsaved: "Изменения главы ещё не сохранены на сервере. Вернуться к списку глав без сохранения?",
    validationTitle: "Проверка",
    storyJsonTitle: "JSON истории",
    pasteStoryJson: "Вставить JSON истории",
    cancelButton: "Отмена",
    applyButton: "Применить",
    newStoryKey: "new_story",
    newStoryTitle: "Новая история",
    defaultSceneText: "История начинается.",
    builderExampleKey: "builder_example",
    builderExampleTitle: "Пример конструктора",
    builderExampleDescription: "История, собранная в Story Builder.",
    exampleStartTitle: "Начало",
    exampleStartText: "Вы стоите перед запертой дверью.",
    takeKey: "Взять ключ",
    goWithoutKey: "Пойти без ключа",
    doorTitle: "Дверь",
    doorText: "Если ключ у вас, откроется лучшая концовка.",
    openDoor: "Открыть дверь",
    waitOutside: "Подождать снаружи",
    goodEndingTitle: "Хорошая концовка",
    goodEndingText: "Ключ поворачивается. Вы входите в теплый свет.",
    goodEndingLabel: "Вы открыли путь",
    quietEndingTitle: "Тихая концовка",
    quietEndingText: "Вы ждете, пока не погаснут фонари.",
    quietEndingLabel: "Вы остались снаружи",
    variableItem: "Переменная {index}",
    assetItem: "Медиафайл {index}",
    sceneItem: "Сцена {index}: {name}",
    newSceneFallback: "new_scene",
    choiceItem: "Выбор {index}",
    conditionItem: "Условие {index}",
    effectItem: "Эффект {index}",
    sceneEffects: "Эффекты сцены",
    sceneLocalVariables: "Локальные переменные сцены",
    sceneLocalAssets: "Медиафайлы сцены",
    choiceEffects: "Эффекты выбора",
    choicesTitle: "Выборы",
    conditionsTitle: "Условия",
    endingTitle: "Финал",
    addChoice: "Добавить выбор",
    addCondition: "Добавить условие",
    addEffect: "Добавить эффект",
    endingEnabled: "Финал включен",
    removeButton: "Удалить",
    nameLabel: "Имя",
    typeLabel: "Тип",
    valueLabel: "Значение",
    showInStatsLabel: "Показывать в статах игры",
    idLabel: "Id",
    urlLabel: "URL",
    uploadAsset: "Загрузить файл",
    uploadAssetFirst: "Сначала импортируйте draft, чтобы появился storyId.",
    uploadAssetDone: "Медиафайл загружен: {id}",
    deleteAssetDone: "Медиафайл удален: {id}",
    metadataJsonLabel: "JSON метаданных",
    textLabel: "Текст",
    backgroundLabel: "Фон",
    musicLabel: "Музыка",
    animationLabel: "Анимация",
    animationDurationLabel: "Длительность анимации, мс",
    labelLabel: "Подпись",
    targetSceneLabel: "Целевая сцена",
    fallbackTargetSceneLabel: "Сцена если условия не выполнены",
    variableLabel: "Переменная",
    operatorLabel: "Оператор",
    kindLabel: "Тип",
    endingTypeLabel: "Тип финала",
    endingTitleLabel: "Заголовок финала",
    noneOption: "Нет",
    validationOk: "Story JSON корректен.",
    keyRequired: "Поле key обязательно.",
    titleRequired: "Поле title обязательно.",
    startSceneMissing: "startSceneId должен указывать на существующую сцену.",
    duplicateSceneId: "Дублирующийся id сцены: {id}.",
    missingBackground: "Сцена {scene} ссылается на отсутствующий фон {asset}.",
    missingMusic: "Сцена {scene} ссылается на отсутствующую музыку {asset}.",
    duplicateChoiceId: "Сцена {scene} содержит дублирующийся id выбора: {id}.",
    missingTarget: "Выбор {choice} в сцене {scene} указывает на отсутствующую цель {target}.",
    missingConditionVariable: "Условие в выборе {choice} ссылается на отсутствующую переменную {variable}.",
    missingEffectVariableChoice: "Эффект в выборе {choice} ссылается на отсутствующую переменную {variable}.",
    invalidIncChoice: "Эффект inc в выборе {choice} должен ссылаться на числовую переменную {variable}.",
    missingEffectVariableScene: "Эффект сцены {scene} ссылается на отсутствующую переменную {variable}.",
    invalidIncScene: "Эффект inc в сцене {scene} должен ссылаться на числовую переменную {variable}.",
    importFirst: "Сначала импортируйте историю.",
    storyFileName: "story",
    variablePrefix: "variable",
    assetPrefix: "asset",
    scenePrefix: "scene",
    sceneDefaultTitle: "Сцена",
    choicePrefix: "choice",
    choiceDefaultLabel: "Выбор",
    collapseAll: "\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u0432\u0441\u0435",
    expandAll: "\u0420\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u0432\u0441\u0435",
    collapsedHint: "\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u043e",
    expandedHint: "\u0420\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u043e",
    sceneSummary: "{choices} \u0432\u044b\u0431\u043e\u0440\u043e\u0432, {effects} \u044d\u0444\u0444\u0435\u043a\u0442\u043e\u0432",
    sceneSummaryEnding: "{choices} \u0432\u044b\u0431\u043e\u0440\u043e\u0432, {effects} \u044d\u0444\u0444\u0435\u043a\u0442\u043e\u0432, \u0444\u0438\u043d\u0430\u043b",
    insertVariableIntoText: "\u0412\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u043f\u0435\u0440\u0435\u043c\u0435\u043d\u043d\u0443\u044e",
    noGlobalVariables: "\u041d\u0435\u0442 \u0433\u043b\u043e\u0431\u0430\u043b\u044c\u043d\u044b\u0445 \u043f\u0435\u0440\u0435\u043c\u0435\u043d\u043d\u044b\u0445",
    assetSummary: "\u0442\u0438\u043f: {type}",
    variableSummary: "\u0442\u0438\u043f: {type}",
    boardView: "\u041a\u0430\u0440\u0442\u0430 \u0441\u0446\u0435\u043d\u0430\u0440\u0438\u044f",
    projectStructureTitle: "\u0421\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u0430",
    globalVariablesTitle: "\u0413\u043b\u043e\u0431\u0430\u043b\u044c\u043d\u044b\u0435 \u043f\u0435\u0440\u0435\u043c\u0435\u043d\u043d\u044b\u0435",
    globalAssetsTitle: "Медиафайлы истории",
    scenePackagesTitle: "\u041f\u0430\u043a\u0435\u0442\u044b \u0441\u0446\u0435\u043d",
    moveUp: "\u0412\u044b\u0448\u0435",
    moveDown: "\u041d\u0438\u0436\u0435",
    openBlock: "\u041e\u0442\u043a\u0440\u044b\u0442\u044c",
    conditionRuntimeHint: "\u0420\u0430\u043d\u0442\u0430\u0439\u043c \u043f\u0440\u043e\u0432\u0435\u0440\u0438\u0442 \u0443\u0441\u043b\u043e\u0432\u0438\u044f: \u0435\u0441\u043b\u0438 \u043e\u043d\u0438 \u0438\u0441\u0442\u0438\u043d\u043d\u044b, \u043f\u0435\u0440\u0435\u0439\u0434\u0435\u0442 \u0432 \u0446\u0435\u043b\u0435\u0432\u0443\u044e \u0441\u0446\u0435\u043d\u0443; \u0438\u043d\u0430\u0447\u0435 - \u0432 fallback-\u0441\u0446\u0435\u043d\u0443, \u0435\u0441\u043b\u0438 \u043e\u043d\u0430 \u0437\u0430\u0434\u0430\u043d\u0430.",
    authorStoryPicker: "\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0430\u0432\u0442\u043e\u0440\u0430",
    authorStoryPickerEmpty: "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0438\u0441\u0442\u043e\u0440\u0438\u044e",
    uploadSceneAsset: "Загрузить медиафайл в сцену",
    authorLoggedIn: "Автор: {name}. Сохраняйте черновик и отправляйте его на проверку.",
    authorRoleMissing: "\u0412\u0445\u043e\u0434 \u0435\u0441\u0442\u044c, \u043d\u043e \u043d\u0443\u0436\u043d\u0430 \u0440\u043e\u043b\u044c author.",
    newAuthorStory: "\u041d\u043e\u0432\u0430\u044f \u0438\u0441\u0442\u043e\u0440\u0438\u044f",
    editStoryButton: "\u041f\u0440\u0430\u0432\u0438\u0442\u044c",
    storyStatsButton: "\u0421\u0442\u0430\u0442\u044b",
    submitReviewButton: "\u041d\u0430 review",
    archiveStoryButton: "\u0412 \u0430\u0440\u0445\u0438\u0432",
    previewStoryButton: "\u041f\u0440\u0435\u0432\u044c\u044e",
    versionsButton: "\u0412\u0435\u0440\u0441\u0438\u0438",
    rollbackPrompt: "\u041d\u043e\u043c\u0435\u0440 \u0432\u0435\u0440\u0441\u0438\u0438 \u0434\u043b\u044f \u043e\u0442\u043a\u0430\u0442\u0430:",
    rollbackDone: "\u041e\u0442\u043a\u0430\u0442 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d \u043a \u0432\u0435\u0440\u0441\u0438\u0438 {version}.",
    statusDraft: "\u0427\u0435\u0440\u043d\u043e\u0432\u0438\u043a",
    statusReview: "\u041d\u0430 review",
    statusPublished: "\u041e\u043f\u0443\u0431\u043b.",
    statusArchived: "\u0410\u0440\u0445\u0438\u0432",
    deleteStoryButton: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c",
    deleteStoryConfirm: "Переместить «{title}» в корзину? Данные и решения сохранятся. Восстановление доступно через модерацию.",
    deleteStoryDone: "\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0443\u0434\u0430\u043b\u0435\u043d\u0430: {title}",
    deleteStoryCurrentDraft: "\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0443\u0434\u0430\u043b\u0435\u043d\u0430. \u0422\u0435\u043a\u0443\u0449\u0438\u0439 draft \u043e\u0441\u0442\u0430\u043b\u0441\u044f \u0432 \u0440\u0435\u0434\u0430\u043a\u0442\u043e\u0440\u0435.",
    authorLoggedOut: "Общая сессия FraerApp не найдена. Войдите по выданной администратором ссылке.",
  },
  en: {
    pageTitle: "FraerApp - Story Builder",
    builderTitle: "Story Builder",
    authorSessionLabel: "Shared FraerApp session",
    authorSessionRefresh: "Check sign-in",
    runtimeApiLabel: "Runtime API",
    adminTokenLabel: "Admin actions require the admin role",
    loadExample: "Load Example",
    copyJson: "Copy JSON",
    downloadJson: "Download JSON",
    importJsonFile: "Import JSON File",
    pasteJson: "Paste JSON",
    clearDraft: "Clear draft",
    localDraftSaveFailed: "The draft could not be saved on this device. Your changes remain in this tab. Download JSON or save the chapter to the server before closing it.",
    backToSite: "Home",
    invalidJson: "Could not open JSON: {message}",
    draftChanged: "The story or server changed during the operation. It was stopped; retry for the intended story.",
    storyMetadata: "Story metadata",
    keyLabel: "Key",
    titleLabel: "Title",
    versionLabel: "Version",
    startSceneLabel: "Start scene",
    descriptionLabel: "Description",
    genreLabel: "Genre",
    topicLabel: "Topic",
    variablesTitle: "Variables",
    addVariable: "Add variable",
    assetsTitle: "Assets",
    addAsset: "Add asset",
    scenesTitle: "Scenes",
    addScene: "Add scene",
    runtimeActions: "Runtime actions",
    importToRuntime: "Save draft to server",
    validateLastImport: "Validate Last Import",
    publishLastImport: "Submit for review",
    myStories: "My stories",
    storyStatusFilter: "Work status",
    unsavedChanges: "Unsaved changes. They exist only in this browser.",
    savedOnServer: "Saved on server · revision v{revision}",
    changeSaved: "Change saved.",
    reviewSent: "Revision v{revision} submitted for review. Publication is unchanged.",
    replaceReviewConfirm: "Replace submission v{revision} with the new saved draft? The old submission can no longer be approved.",
    staleStory: "The story changed. The list has been refreshed: inspect the current revision and try again.",
    withdrawConfirm: "Withdraw submission for “{title}”? The draft and previous publication are retained.",
    archiveConfirm: "Archive “{title}”? Readers will lose access. Data and progress are retained.",
    switchUnsaved: "The current story has changes stored only in this browser. Open another story and replace them?",
    leaveChapterUnsaved: "Chapter changes have not been saved to the server. Return to the chapter list without saving?",
    validationTitle: "Validation",
    storyJsonTitle: "Story JSON",
    pasteStoryJson: "Paste Story JSON",
    cancelButton: "Cancel",
    applyButton: "Apply",
    newStoryKey: "new_story",
    newStoryTitle: "New Story",
    defaultSceneText: "The story begins.",
    builderExampleKey: "builder_example",
    builderExampleTitle: "Builder Example",
    builderExampleDescription: "A story created in the Story Builder.",
    exampleStartTitle: "Start",
    exampleStartText: "You stand before a locked door.",
    takeKey: "Take the key",
    goWithoutKey: "Go without the key",
    doorTitle: "The Door",
    doorText: "If you have the key, the better ending is available.",
    openDoor: "Open the door",
    waitOutside: "Wait outside",
    goodEndingTitle: "Good Ending",
    goodEndingText: "The key turns. You step into warm light.",
    goodEndingLabel: "You opened the way",
    quietEndingTitle: "Quiet Ending",
    quietEndingText: "You wait until the lamps go out.",
    quietEndingLabel: "You stayed outside",
    variableItem: "Variable {index}",
    assetItem: "Asset {index}",
    sceneItem: "Scene {index}: {name}",
    newSceneFallback: "new_scene",
    choiceItem: "Choice {index}",
    conditionItem: "Condition {index}",
    effectItem: "Effect {index}",
    sceneEffects: "Scene effects",
    sceneLocalVariables: "Scene local variables",
    sceneLocalAssets: "Scene local assets",
    choiceEffects: "Choice effects",
    choicesTitle: "Choices",
    conditionsTitle: "Conditions",
    endingTitle: "Ending",
    addChoice: "Add choice",
    addCondition: "Add condition",
    addEffect: "Add effect",
    endingEnabled: "Ending enabled",
    removeButton: "Remove",
    nameLabel: "Name",
    typeLabel: "Type",
    valueLabel: "Value",
    showInStatsLabel: "Show in game stats",
    idLabel: "Id",
    urlLabel: "URL",
    uploadAsset: "Upload file",
    uploadAssetFirst: "Import the draft first so it has a storyId.",
    uploadAssetDone: "Asset uploaded: {id}",
    deleteAssetDone: "Asset deleted: {id}",
    metadataJsonLabel: "Metadata JSON",
    textLabel: "Text",
    backgroundLabel: "Background",
    musicLabel: "Music",
    animationLabel: "Animation",
    animationDurationLabel: "Animation duration ms",
    labelLabel: "Label",
    targetSceneLabel: "Target scene",
    fallbackTargetSceneLabel: "Scene if conditions fail",
    variableLabel: "Variable",
    operatorLabel: "Operator",
    kindLabel: "Kind",
    endingTypeLabel: "Ending type",
    endingTitleLabel: "Ending title",
    noneOption: "None",
    validationOk: "Story JSON is valid.",
    keyRequired: "key is required.",
    titleRequired: "title is required.",
    startSceneMissing: "startSceneId must point to an existing scene.",
    duplicateSceneId: "Duplicate scene id: {id}.",
    missingBackground: "Scene {scene} has missing background asset {asset}.",
    missingMusic: "Scene {scene} has missing music asset {asset}.",
    duplicateChoiceId: "Scene {scene} has duplicate choice id: {id}.",
    missingTarget: "Choice {choice} in scene {scene} points to missing target {target}.",
    missingConditionVariable: "Condition in choice {choice} references missing variable {variable}.",
    missingTextVariable: "Scene {scene} text references missing variable {variable}.",
    missingEffectVariableChoice: "Effect in choice {choice} references missing variable {variable}.",
    invalidIncChoice: "inc effect in choice {choice} must target number variable {variable}.",
    missingEffectVariableScene: "Scene {scene} effect references missing variable {variable}.",
    invalidIncScene: "inc effect in scene {scene} must target number variable {variable}.",
    importFirst: "Import a story first.",
    storyFileName: "story",
    variablePrefix: "variable",
    assetPrefix: "asset",
    scenePrefix: "scene",
    sceneDefaultTitle: "Scene",
    choicePrefix: "choice",
    choiceDefaultLabel: "Choice",
    collapseAll: "Collapse all",
    expandAll: "Expand all",
    collapsedHint: "Collapsed",
    expandedHint: "Expanded",
    sceneSummary: "{choices} choices, {effects} effects",
    sceneSummaryEnding: "{choices} choices, {effects} effects, ending",
    insertVariableIntoText: "Insert variable",
    noGlobalVariables: "No global variables",
    assetSummary: "type: {type}",
    variableSummary: "type: {type}",
    boardView: "Scenario map",
    projectStructureTitle: "Structure",
    globalVariablesTitle: "Global variables",
    globalAssetsTitle: "Global assets",
    scenePackagesTitle: "Scene packages",
    moveUp: "Up",
    moveDown: "Down",
    openBlock: "Open",
    conditionRuntimeHint: "Runtime checks the conditions: if they pass it goes to the target scene; otherwise it goes to the fallback scene when one is set.",
    authorStoryPicker: "Author story",
    authorStoryPickerEmpty: "Choose a story",
    uploadSceneAsset: "Upload asset to scene",
    authorLoggedIn: "Author: {name}. Save drafts and submit them for review.",
    authorLoggedOut: "No shared FraerApp session was found. Use the sign-in link provided by an administrator.",
    authorRoleMissing: "You are signed in, but the author role is required.",
    newAuthorStory: "New story",
    editStoryButton: "Edit",
    storyStatsButton: "Stats",
    submitReviewButton: "To review",
    archiveStoryButton: "Archive",
    previewStoryButton: "Preview",
    versionsButton: "Versions",
    rollbackPrompt: "Version number to roll back to:",
    rollbackDone: "Rolled back to version {version}.",
    statusDraft: "Draft",
    statusReview: "Review",
    statusPublished: "Published",
    statusArchived: "Archived",
    deleteStoryButton: "Delete",
    deleteStoryConfirm: "Move “{title}” to trash? Data and decisions are retained. Moderation can restore it.",
    deleteStoryDone: "Story deleted: {title}",
    deleteStoryCurrentDraft: "Story deleted. The current draft stayed in the editor.",
  },
};

const storageKey = "fraerapp.storyBuilderDraft";
const languageKey = "fraerapp.storyBuilderLanguage";
const authorStorageKey = "fraerapp.storyBuilderAuthor";
const collapseStateKey = "fraerapp.storyBuilderCollapseState";
const outlineStateKey = "fraerapp.storyBuilderOutlineState";
const runtimeUrlStorageKey = "fraerapp.storyBuilderRuntimeUrl";
let currentLanguage = readLocalStorage(languageKey) || "ru";
let collapseState = loadCollapseState();
let outlineState = loadOutlineState();
let lastAppliedHash = "";
let contextObserver = null;
let activeContextId = "";
let contextScrollBound = false;
const variableTypeOptions = ["string", "number", "boolean", "timer"];

function t(key, params = {}) {
  const template = translations[currentLanguage]?.[key] ?? translations.ru[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
}

let draft = loadDraft() || emptyDraft();
draft = localizeDraftDefaults(draft);
let authorSession = null;
let authorHomeCache = null;
let authorFilter = "all";
let builderWorkflowBusy = false;
let draftStorageFailed = false;

els.runtimeUrl.value = initialRuntimeUrl();
writeLocalStorage(runtimeUrlStorageKey, els.runtimeUrl.value);
els.runtimeUrl.addEventListener("input", () => {
  writeLocalStorage(runtimeUrlStorageKey, els.runtimeUrl.value);
});

function initialRuntimeUrl() {
  const stored = readLocalStorage(runtimeUrlStorageKey);
  const fallback = defaultRuntimeUrl();
  if (window.location.pathname.startsWith("/builder") && isLocalRuntimeUrl(stored)) {
    return fallback;
  }
  return stored || fallback;
}

function defaultRuntimeUrl() {
  if (window.location.pathname.startsWith("/builder")) {
    return els.runtimeUrl.dataset.prodRuntime || window.location.origin;
  }
  return els.runtimeUrl.dataset.localRuntime || els.runtimeUrl.value;
}

function isLocalRuntimeUrl(value) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(String(value || "").trim());
}

function emptyDraft() {
  return {
    key: t("newStoryKey"),
    title: t("newStoryTitle"),
    description: "",
    version: 1,
    startSceneId: "start",
    variables: [{ name: "score", type: "number", value: 0, showInStats: false }],
    assets: [{ id: "start_bg", type: "image", url: "/assets/platform.svg", metadata: "" }],
    scenes: [
      {
        id: "start",
        title: t("exampleStartTitle"),
        text: t("defaultSceneText"),
        background: "start_bg",
        music: "",
        variables: [],
        assets: [],
        animationType: "fade-in",
        animationDurationMs: 800,
        effects: [],
        endingEnabled: false,
        endingType: "",
        endingTitle: "",
        choices: [],
      },
    ],
  };
}

function exampleDraft() {
  return {
    key: t("builderExampleKey"),
    title: t("builderExampleTitle"),
    description: t("builderExampleDescription"),
    version: 1,
    startSceneId: "start",
    variables: [
      { name: "score", type: "number", value: 0, showInStats: true },
      { name: "hasKey", type: "boolean", value: false, showInStats: true },
    ],
    assets: [
      { id: "start_bg", type: "image", url: "/assets/platform.svg", metadata: "" },
      { id: "door_bg", type: "image", url: "/assets/door.svg", metadata: "" },
      { id: "end_bg", type: "image", url: "/assets/departure.svg", metadata: "" },
    ],
    scenes: [
      {
        id: "start",
        title: t("exampleStartTitle"),
        text: t("exampleStartText"),
        background: "start_bg",
        music: "",
        variables: [{ name: "doorHint", type: "string", value: "locked" }],
        assets: [],
        animationType: "fade-in",
        animationDurationMs: 800,
        effects: [],
        endingEnabled: false,
        endingType: "",
        endingTitle: "",
        choices: [
          {
            id: "take_key",
            label: t("takeKey"),
            target: "door",
            conditions: [],
            effects: [
              { kind: "set", variable: "hasKey", value: true },
              { kind: "inc", variable: "score", value: 1 },
            ],
          },
          {
            id: "go_without_key",
            label: t("goWithoutKey"),
            target: "door",
            conditions: [],
            effects: [],
          },
        ],
      },
      {
        id: "door",
        title: t("doorTitle"),
        text: t("doorText"),
        background: "door_bg",
        music: "",
        variables: [],
        assets: [],
        animationType: "fade-in",
        animationDurationMs: 600,
        effects: [],
        endingEnabled: false,
        endingType: "",
        endingTitle: "",
        choices: [
          {
            id: "open_door",
            label: t("openDoor"),
            target: "good_end",
            fallbackTarget: "bad_end",
            conditions: [{ variable: "hasKey", op: "==", value: true }],
            effects: [{ kind: "inc", variable: "score", value: 5 }],
          },
          {
            id: "wait",
            label: t("waitOutside"),
            target: "bad_end",
            conditions: [],
            effects: [],
          },
        ],
      },
      endingScene("good_end", t("goodEndingTitle"), t("goodEndingText"), "end_bg", "good", t("goodEndingLabel")),
      endingScene("bad_end", t("quietEndingTitle"), t("quietEndingText"), "door_bg", "bad", t("quietEndingLabel")),
    ],
  };
}

function endingScene(id, title, text, background, endingType, endingTitle) {
  return {
    id,
    title,
    text,
    background,
    music: "",
    animationType: "fade-in",
    animationDurationMs: 600,
    effects: [],
    endingEnabled: true,
    endingType,
    endingTitle,
    choices: [],
  };
}

function applyTranslations() {
  document.querySelector(".floating-tools").setAttribute("aria-label", currentLanguage === "en" ? "Quick builder actions" : "Быстрые действия конструктора");
  document.documentElement.lang = currentLanguage;
  document.title = t("pageTitle");
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  els.langRu.classList.toggle("is-active", currentLanguage === "ru");
  els.langEn.classList.toggle("is-active", currentLanguage === "en");
}

function setLanguage(language) {
  currentLanguage = language === "en" ? "en" : "ru";
  writeLocalStorage(languageKey, currentLanguage);
  draft = localizeDraftDefaults(draft);
  applyTranslations();
  render();
  renderAuthorWorkspace();
}

function render(options = {}) {
  const scrollState = options.preserveScroll ? captureScrollState() : null;
  applyTranslations();
  renderMeta();
  const chapterWork = new URLSearchParams(location.search).get("work");
  if (chapterWork) {
    document.querySelector(".topbar h1").textContent = currentLanguage === "en" ? "Chapter builder" : "Конструктор главы";
    const heading = document.querySelector('[data-i18n="storyMetadata"]');
    heading.textContent = currentLanguage === "en" ? "Chapter settings" : "Настройки главы";
  }
  decorateHelp(currentLanguage);
  renderVariables();
  renderAssets();
  renderScenes();
  renderProjectOutlineExplorer();
  renderPreview();
  renderAuthorWorkspace();
  setupContextTracking();
  saveDraft();
  applyHashFocus();
  updateAuthorGate();
  if (scrollState) {
    restoreScrollState(scrollState);
  }
}

function captureScrollState() {
  return {
    windowY: window.scrollY,
    editor: document.querySelector(".editor")?.scrollTop ?? 0,
    preview: document.querySelector(".preview")?.scrollTop ?? 0,
    project: document.querySelector(".project-panel")?.scrollTop ?? 0,
  };
}

function restoreScrollState(state) {
  requestAnimationFrame(() => {
    window.scrollTo({ top: state.windowY });
    const editor = document.querySelector(".editor");
    const preview = document.querySelector(".preview");
    const project = document.querySelector(".project-panel");
    if (editor) editor.scrollTop = state.editor;
    if (preview) preview.scrollTop = state.preview;
    if (project) project.scrollTop = state.project;
  });
}

function contextId(...parts) {
  return parts.map((part) => String(part ?? "").replace(/[^a-zA-Z0-9_-]+/g, "_")).join("__");
}

function annotateContext(node, { id, kind, title, subtitle = "", depth = 0, path = "" }) {
  node.dataset.contextId = id;
  node.dataset.contextKind = kind;
  node.dataset.contextTitle = title;
  node.dataset.contextSubtitle = subtitle;
  node.dataset.contextDepth = String(depth);
  node.dataset.contextPath = path || title;
  return node;
}

function setupContextTracking() {
  const contexts = [...document.querySelectorAll(".editor [data-context-id]")];
  if (contextObserver) {
    contextObserver.disconnect();
  }
  contextObserver = new IntersectionObserver(() => updateActiveContextFromViewport(), {
    root: null,
    rootMargin: "-84px 0px -55% 0px",
    threshold: [0, 0.1, 0.35],
  });
  contexts.forEach((node) => contextObserver.observe(node));
  if (!contextScrollBound) {
    window.addEventListener("scroll", scheduleActiveContextUpdate, { passive: true });
    window.addEventListener("resize", scheduleActiveContextUpdate);
    contextScrollBound = true;
  }
  requestAnimationFrame(updateActiveContextFromViewport);
}

let contextUpdateQueued = false;

function scheduleActiveContextUpdate() {
  if (contextUpdateQueued) return;
  contextUpdateQueued = true;
  requestAnimationFrame(() => {
    contextUpdateQueued = false;
    updateActiveContextFromViewport();
  });
}

function updateActiveContextFromViewport() {
  const contexts = [...document.querySelectorAll(".editor [data-context-id]")];
  if (!contexts.length) return;
  const anchor = els.activeContext?.getBoundingClientRect().bottom + 12 || 96;
  let best = null;
  for (const node of contexts) {
    const rect = node.getBoundingClientRect();
    if (rect.bottom < anchor) {
      best = node;
      continue;
    }
    if (rect.top <= anchor && rect.bottom >= anchor) {
      if (!best || Number(node.dataset.contextDepth || 0) >= Number(best.dataset.contextDepth || 0)) {
        best = node;
      }
    }
  }
  best ||= contexts.find((node) => node.getBoundingClientRect().bottom > anchor) || contexts[0];
  setActiveContext(best);
}

function setActiveContext(node) {
  if (!node) return;
  activeContextId = node.dataset.contextId;
  document.querySelectorAll("[data-context-id].is-context-active").forEach((current) => current.classList.remove("is-context-active"));
  node.classList.add("is-context-active");
  document.querySelectorAll("[data-outline-target].is-active").forEach((current) => current.classList.remove("is-active"));
  document.querySelectorAll(".tree-folder.is-active-branch").forEach((current) => current.classList.remove("is-active-branch"));
  const activeLinks = [...document.querySelectorAll(`[data-outline-target="${cssEscape(activeContextId)}"]`)];
  activeLinks.forEach((link) => link.classList.add("is-active"));
  revealActiveOutline(activeLinks[0]);
  if (els.activeContext) {
    els.activeContext.replaceChildren();
    const kicker = document.createElement("span");
    kicker.className = "active-context-kicker";
    kicker.textContent = node.dataset.contextKind || "Story";
    const title = document.createElement("strong");
    title.textContent = node.dataset.contextPath || node.dataset.contextTitle || t("storyMetadata");
    const subtitle = document.createElement("span");
    subtitle.textContent = node.dataset.contextSubtitle || draft.title || draft.key || t("newStoryTitle");
    els.activeContext.append(kicker, title, subtitle);
  }
}

function revealActiveOutline(link) {
  if (!link) return;
  const ownFolder = link.closest(".outline-folder")?.querySelector(":scope > .tree-folder");
  link.closest(".tree-folder")?.classList.add("is-active-branch");
  link.closest(".outline-tree")?.querySelectorAll(".tree-folder.is-active-branch").forEach((folder) => {
    if (!folder.contains(link)) folder.classList.remove("is-active-branch");
  });
  link.closest(".tree-folder")?.querySelectorAll(".tree-folder").forEach((folder) => {
    if (folder.contains(link)) folder.classList.add("is-active-branch");
  });
  let parent = link.parentElement;
  while (parent) {
    if (parent.tagName === "DETAILS") {
      parent.open = true;
      parent.classList.add("is-active-branch");
    }
    parent = parent.parentElement;
  }
  if (ownFolder) { ownFolder.open = true; ownFolder.classList.add("is-active-branch"); }
  const scroller = link.closest(".outline-tree");
  if (!scroller) return;
  const linkRect = link.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  if (linkRect.top < scrollerRect.top + 20 || linkRect.bottom > scrollerRect.bottom - 20) {
    scroller.scrollTop += linkRect.top - scrollerRect.top - (scrollerRect.height / 2) + (linkRect.height / 2);
  }
}

function renderMeta() {
  for (const input of els.meta) {
    const key = input.dataset.meta;
    if (key === "genre" || key === "topic") {
      fillClassification(input, key === "genre" ? genres : topics, draft[key], currentLanguage);
    }
    if (key === "startSceneId") {
      fillSelect(input, draft.scenes.map((scene) => scene.id), true);
    }
    input.value = draft[key] ?? "";
    input.oninput = () => {
      draft[key] = key === "version" ? Number(input.value || 1) : input.value;
      renderPreview();
      saveDraft();
      if (key === "key" || key === "title" || key === "startSceneId") {
        renderMeta();
      }
    };
  }
}

function renderVariables() {
  els.variables.replaceChildren();
  appendCollectionToolbar(
    els.variables,
    draft.variables.map((_, index) => collapseKey("variable", index)),
  );
  draft.variables.forEach((variable, index) => {
    const contextTitle = t("variableItem", { index: index + 1 });
    const item = collapsibleItem({
      title: contextTitle,
      subtitle: `${variable.name || `${t("variablePrefix")}_${index + 1}`} · ${t("variableSummary", { type: variable.type || "string" })}`,
      key: collapseKey("variable", index),
      onRemove: () => removeAt(draft.variables, index),
      entityKind: "variable",
      entityId: variable.name || `${index}`,
    });
    annotateContext(item, {
      id: contextId("variable", index, variable.name || index),
      kind: t("variablesTitle"),
      title: contextTitle,
      subtitle: variable.name || `${t("variablePrefix")}_${index + 1}`,
      depth: 0,
    });
    item.append(
      field(t("nameLabel"), input(variable.name, (value) => renameVariable(variable, value))),
      selectField(t("typeLabel"), variableTypeOptions, variable.type, (value) => {
        const previousType = variable.type || "string";
        const previousValue = variable.value;
        variable.type = value;
        variable.value = preserveValueForType(previousValue, previousType, value);
        render({ preserveScroll: true });
      }),
      typedValueField(variable, (value) => (variable.value = value)),
      checkboxField(t("showInStatsLabel"), Boolean(variable.showInStats), (checked) => (variable.showInStats = checked)),
    );
    els.variables.append(item);
  });
}

function renderAssets() {
  els.assets.replaceChildren();
  appendCollectionToolbar(
    els.assets,
    draft.assets.map((_, index) => collapseKey("asset", index)),
  );
  draft.assets.forEach((asset, index) => {
    const contextTitle = t("assetItem", { index: index + 1 });
    const item = collapsibleItem({
      title: contextTitle,
      subtitle: `${asset.id || `${t("assetPrefix")}_${index + 1}`} · ${t("assetSummary", { type: asset.type || "image" })}`,
      key: collapseKey("asset", index),
      onRemove: () => removeAssetAt(draft.assets, index, null),
      entityKind: "asset",
      entityId: asset.id || `${index}`,
    });
    annotateContext(item, {
      id: contextId("asset", index, asset.id || index),
      kind: t("assetsTitle"),
      title: contextTitle,
      subtitle: asset.id || `${t("assetPrefix")}_${index + 1}`,
      depth: 0,
    });
    item.append(
      field(t("idLabel"), input(asset.id, (value) => renameAsset(asset, value))),
      selectField(t("typeLabel"), ["image", "music", "sound", "video", "sprite"], asset.type, (value) => (asset.type = value)),
      field(t("urlLabel"), input(asset.url, (value) => (asset.url = value))),
      assetUploadField(asset),
      field(t("metadataJsonLabel"), textarea(asset.metadata || "", (value) => (asset.metadata = value), 3)),
    );
    els.assets.append(item);
  });
}

function renderScenes() {
  els.scenes.replaceChildren();
  appendCollectionToolbar(
    els.scenes,
    draft.scenes.map((scene, index) => collapseKey("scene", scene.id || index)),
  );
  draft.scenes.forEach((scene, sceneIndex) => {
    scene.variables ||= [];
    scene.assets ||= [];
    const assetIds = assetOptions(scene);
    const sceneContextId = contextId("scene", sceneIndex, scene.id || sceneIndex);
    const sceneContextTitle = t("sceneItem", { index: sceneIndex + 1, name: scene.id || t("newSceneFallback") });
    const item = collapsibleItem({
      title: sceneContextTitle,
      subtitle: `${scene.title || t("sceneDefaultTitle")} · ${t(scene.endingEnabled ? "sceneSummaryEnding" : "sceneSummary", {
        choices: scene.choices.length,
        effects: scene.effects.length,
      })}`,
      key: collapseKey("scene", scene.id || sceneIndex),
      onRemove: () => removeAt(draft.scenes, sceneIndex),
      entityKind: "scene",
      entityId: scene.id || `${sceneIndex}`,
    });
    annotateContext(item, {
      id: sceneContextId,
      kind: t("scenesTitle"),
      title: sceneContextTitle,
      subtitle: scene.title || scene.id || t("sceneDefaultTitle"),
      depth: 0,
      path: sceneContextTitle,
    });
    item.append(sceneOrderControls(sceneIndex));
    const identityFields = div("form-panel scene-identity");
    identityFields.append(
      field(t("idLabel"), input(scene.id, (value) => renameScene(scene, value))),
      field(t("titleLabel"), input(scene.title, (value) => (scene.title = value))),
      sceneTextField(scene),
    );
    const mediaFields = div("form-panel form-grid two");
    mediaFields.append(
      selectField(t("backgroundLabel"), ["", ...assetIds], scene.background || "", (value) => (scene.background = value)),
      sceneAssetUploadField(scene, "background"),
      selectField(t("musicLabel"), ["", ...assetIds], scene.music || "", (value) => (scene.music = value)),
      sceneAssetUploadField(scene, "music"),
      selectField(t("animationLabel"), ["none", "fade-in"], scene.animationType || "none", (value) => (scene.animationType = value)),
      field(t("animationDurationLabel"), input(scene.animationDurationMs || 600, (value) => (scene.animationDurationMs = Number(value || 0)), "number")),
    );
    item.append(
      identityFields,
      localVariablesEditor(scene, sceneIndex),
      localAssetsEditor(scene, sceneIndex),
      mediaFields,
      effectsEditor(scene.effects, t("sceneEffects"), scene, { scope: "scene", sceneIndex }),
      endingEditor(scene, sceneIndex),
      choicesEditor(scene, sceneIndex),
    );
    els.scenes.append(item);
  });
}

function choicesEditor(scene, sceneIndex) {
  const wrap = div("nested nested-panel");
  const scenePath = sceneContextPath(scene, sceneIndex);
  annotateContext(wrap, {
    id: contextId("scene", sceneIndex, "choices"),
    kind: t("scenesTitle"),
    title: t("choicesTitle"),
    subtitle: scene.title || scene.id || t("sceneDefaultTitle"),
    depth: 1,
    path: `${scenePath} -> ${t("choicesTitle")}`,
  });
  const add = addButton(t("addChoice"), () => {
    scene.choices.push({
      id: `${t("choicePrefix")}_${scene.choices.length + 1}`,
      label: t("choiceDefaultLabel"),
      target: scene.id,
      fallbackTarget: "",
      conditions: [],
      effects: [],
    });
    render({ preserveScroll: true });
  });
  wrap.append(rowTitle(t("choicesTitle"), add));
  scene.choices.forEach((choice, index) => {
    const item = div("item subitem");
    const choiceTitle = t("choiceItem", { index: index + 1 });
    annotateContext(item, {
      id: contextId("scene", sceneIndex, "choice", index, choice.id || index),
      kind: t("choicesTitle"),
      title: choiceTitle,
      subtitle: choice.label || choice.id || t("choiceDefaultLabel"),
      depth: 2,
      path: `${scenePath} -> ${choiceTitle}`,
    });
    item.append(
      rowHead(choiceTitle, () => removeAt(scene.choices, index)),
      field(t("idLabel"), input(choice.id, (value) => (choice.id = value))),
      field(t("labelLabel"), input(choice.label, (value) => (choice.label = value))),
      selectField(t("targetSceneLabel"), draft.scenes.map((candidate) => candidate.id), choice.target, (value) => (choice.target = value)),
      selectField(t("fallbackTargetSceneLabel"), ["", ...draft.scenes.map((candidate) => candidate.id)], choice.fallbackTarget || "", (value) => (choice.fallbackTarget = value)),
      conditionsEditor(choice.conditions, scene, { sceneIndex, choiceIndex: index, choice }),
      effectsEditor(choice.effects, t("choiceEffects"), scene, { scope: "choice", sceneIndex, choiceIndex: index, choice }),
    );
    wrap.append(item);
  });
  return wrap;
}

function conditionsEditor(conditions, scene, context = {}) {
  const wrap = div("nested nested-panel compact-panel");
  const parentPath = choiceContextPath(scene, context.sceneIndex, context.choiceIndex, context.choice);
  annotateContext(wrap, {
    id: contextId("scene", context.sceneIndex ?? "x", "choice", context.choiceIndex ?? "x", "conditions"),
    kind: t("choicesTitle"),
    title: t("conditionsTitle"),
    subtitle: context.choice?.label || context.choice?.id || t("choiceDefaultLabel"),
    depth: 3,
    path: `${parentPath} -> ${t("conditionsTitle")}`,
  });
  const hint = document.createElement("p");
  hint.className = "summary-subtitle";
  hint.textContent = t("conditionRuntimeHint");
  wrap.append(rowTitle(t("conditionsTitle"), addButton(t("addCondition"), () => {
    const variable = firstVariable(scene);
    conditions.push({ variable, op: "==", value: defaultValue(variableType(variable, scene)) });
    render({ preserveScroll: true });
  })));
  wrap.append(hint);
  conditions.forEach((condition, index) => {
    const variableNames = variableOptions(scene);
    condition.op ||= "==";
    const item = div("item subitem");
    const conditionTitle = t("conditionItem", { index: index + 1 });
    annotateContext(item, {
      id: contextId("scene", context.sceneIndex ?? "x", "choice", context.choiceIndex ?? "x", "condition", index),
      kind: t("conditionsTitle"),
      title: conditionTitle,
      subtitle: `${condition.variable || t("variableLabel")} ${condition.op || "=="} ${condition.value ?? ""}`,
      depth: 4,
      path: `${parentPath} -> ${conditionTitle}`,
    });
    item.append(
      rowHead(conditionTitle, () => removeAt(conditions, index)),
      selectField(t("variableLabel"), variableNames, condition.variable, (value) => {
        const previousType = variableType(condition.variable, scene);
        const previousValue = condition.value;
        condition.variable = value;
        condition.value = preserveValueForType(previousValue, previousType, variableType(value, scene));
        render({ preserveScroll: true });
      }),
      selectField(t("operatorLabel"), ["==", "!=", ">=", "<=", ">", "<"], condition.op || "==", (value) => (condition.op = value || "==")),
      typedValueField({ type: variableType(condition.variable, scene), value: condition.value }, (value) => (condition.value = value)),
    );
    wrap.append(item);
  });
  return wrap;
}

function effectsEditor(effects, title, scene = null, context = {}) {
  const wrap = div("nested nested-panel compact-panel");
  const parentPath = context.scope === "choice"
    ? choiceContextPath(scene, context.sceneIndex, context.choiceIndex, context.choice)
    : sceneContextPath(scene, context.sceneIndex);
  annotateContext(wrap, {
    id: contextId("scene", context.sceneIndex ?? "global", context.scope || "effects", context.choiceIndex ?? "", "effects"),
    kind: context.scope === "choice" ? t("choicesTitle") : t("scenesTitle"),
    title,
    subtitle: context.choice?.label || scene?.title || scene?.id || "",
    depth: context.scope === "choice" ? 3 : 1,
    path: `${parentPath} -> ${title}`,
  });
  wrap.append(rowTitle(title, addButton(t("addEffect"), () => {
    const variable = firstVariable(scene);
    effects.push({ kind: "set", variable, value: defaultValue(variableType(variable, scene)) });
    render({ preserveScroll: true });
  })));
  effects.forEach((effect, index) => {
    const variableNames = variableOptions(scene);
    const type = variableType(effect.variable, scene);
    if (effect.kind === "inc" && type !== "number") {
      effect.kind = "set";
      effect.value = coerceValue(type, effect.value);
    }
    const item = div("item");
    const effectTitle = t("effectItem", { index: index + 1 });
    annotateContext(item, {
      id: contextId("scene", context.sceneIndex ?? "global", context.scope || "effect", context.choiceIndex ?? "", "effect", index),
      kind: title,
      title: effectTitle,
      subtitle: `${effect.kind || "set"} ${effect.variable || t("variableLabel")}`,
      depth: context.scope === "choice" ? 4 : 2,
      path: `${parentPath} -> ${effectTitle}`,
    });
    item.append(
      rowHead(effectTitle, () => removeAt(effects, index)),
      selectField(t("kindLabel"), type === "number" ? ["set", "inc"] : ["set"], effect.kind, (value) => {
        const previousValue = effect.value;
        effect.kind = value;
        if (value === "inc") {
          effect.value = toNumberOrDefault(previousValue, 1);
        } else {
          effect.value = coerceValue(variableType(effect.variable, scene), previousValue);
        }
        render({ preserveScroll: true });
      }),
      selectField(t("variableLabel"), variableNames, effect.variable, (value) => {
        const previousType = variableType(effect.variable, scene);
        const previousValue = effect.value;
        effect.variable = value;
        const nextType = variableType(value, scene);
        if (effect.kind === "inc" && nextType !== "number") {
          effect.kind = "set";
        }
        effect.value = preserveValueForType(previousValue, previousType, nextType, effect.kind);
        render({ preserveScroll: true });
      }),
      effect.kind === "inc"
        ? field(t("valueLabel"), input(effect.value ?? 1, (value) => (effect.value = Number(value || 0)), "number"))
        : typedValueField({ type, value: effect.value }, (value) => (effect.value = value)),
    );
    wrap.append(item);
  });
  return wrap;
}

function endingEditor(scene, sceneIndex) {
  const wrap = div("nested nested-panel compact-panel");
  const scenePath = sceneContextPath(scene, sceneIndex);
  annotateContext(wrap, {
    id: contextId("scene", sceneIndex, "ending"),
    kind: t("scenesTitle"),
    title: t("endingTitle"),
    subtitle: scene.title || scene.id || t("sceneDefaultTitle"),
    depth: 1,
    path: `${scenePath} -> ${t("endingTitle")}`,
  });
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(scene.endingEnabled);
  checkbox.onchange = () => {
    scene.endingEnabled = checkbox.checked;
    render({ preserveScroll: true });
  };
  const label = switchLabel(t("endingEnabled"), checkbox);
  wrap.append(rowTitle(t("endingTitle")), label);
  if (scene.endingEnabled) {
    wrap.append(
      field(t("endingTypeLabel"), input(scene.endingType || "", (value) => (scene.endingType = value))),
      field(t("endingTitleLabel"), input(scene.endingTitle || "", (value) => (scene.endingTitle = value))),
    );
  }
  return wrap;
}

function renderPreview() {
  const story = toStoryJson();
  const errors = validateStory(story);
  els.validation.replaceChildren();
  els.validation.classList.toggle("ok", errors.length === 0);
  if (errors.length === 0) {
    const ok = document.createElement("li");
    ok.textContent = t("validationOk");
    els.validation.append(ok);
  } else {
    errors.forEach((error) => {
      const item = document.createElement("li");
      item.textContent = error;
      els.validation.append(item);
    });
  }
}

function toStoryJson() {
  return {
    key: draft.key,
    title: draft.title,
    description: draft.description,
    genre: draft.genre || "",
    topic: draft.topic || "",
    ...(draft.completionStatus ? {completionStatus:draft.completionStatus} : {}),
    ...(draft.metadata ? {metadata:structuredClone(draft.metadata)} : {}),
    version: Number(draft.version || 1),
    startSceneId: draft.startSceneId,
    variables: Object.fromEntries(draft.variables.filter((variable) => variable.name).map((variable) => [variable.name, serializeVariable(variable)])),
    assets: draft.assets.filter((asset) => asset.id).map((asset) => {
      const result = { id: asset.id, type: asset.type, url: asset.url };
      const metadata = parseMetadata(asset.metadata);
      if (metadata) {
        result.metadata = metadata;
      }
      return result;
    }),
    scenes: draft.scenes.filter((scene) => scene.id).map((scene) => ({
      id: scene.id,
      title: scene.title,
      text: scene.text,
      variables: Object.fromEntries((scene.variables || []).filter((variable) => variable.name).map((variable) => [variable.name, serializeVariable(variable)])),
      assets: (scene.assets || []).filter((asset) => asset.id).map((asset) => {
        const result = { id: asset.id, type: asset.type, url: asset.url };
        const metadata = parseMetadata(asset.metadata);
        if (metadata) {
          result.metadata = metadata;
        }
        return result;
      }),
      background: scene.background || null,
      music: scene.music || null,
      animation: scene.animationType === "fade-in" ? { type: "fade-in", durationMs: Number(scene.animationDurationMs || 600) } : {},
      effects: serializeEffects(scene.effects, scene),
      ...(scene.endingEnabled ? { ending: { type: scene.endingType || "ending", title: scene.endingTitle || scene.title } } : {}),
      choices: scene.choices.map((choice) => ({
        id: choice.id,
        label: choice.label,
        target: choice.target,
        fallbackTarget: choice.fallbackTarget || null,
        conditions: serializeConditions(choice.conditions, scene),
        effects: serializeEffects(choice.effects, scene),
      })),
    })),
  };
}

function localVariablesEditor(scene, sceneIndex) {
  const wrap = div("nested nested-panel");
  const scenePath = sceneContextPath(scene, sceneIndex);
  annotateContext(wrap, {
    id: contextId("scene", sceneIndex, "variables"),
    kind: t("scenesTitle"),
    title: t("sceneLocalVariables"),
    subtitle: scene.title || scene.id || t("sceneDefaultTitle"),
    depth: 1,
    path: `${scenePath} -> ${t("sceneLocalVariables")}`,
  });
  wrap.append(rowTitle(t("sceneLocalVariables"), addButton(t("addVariable"), () => {
    scene.variables ||= [];
    scene.variables.push({ name: `${scene.id || t("scenePrefix")}_${t("variablePrefix")}_${scene.variables.length + 1}`, type: "string", value: "", showInStats: false });
    render({ preserveScroll: true });
  })));
  (scene.variables || []).forEach((variable, index) => {
    const item = div("item subitem");
    const variableTitle = t("variableItem", { index: index + 1 });
    annotateContext(item, {
      id: contextId("scene", sceneIndex, "variable", index, variable.name || index),
      kind: t("sceneLocalVariables"),
      title: variableTitle,
      subtitle: variable.name || `${t("variablePrefix")}_${index + 1}`,
      depth: 2,
      path: `${scenePath} -> ${variableTitle}`,
    });
    item.append(
      rowHead(variableTitle, () => removeAt(scene.variables, index)),
      field(t("nameLabel"), input(variable.name, (value) => renameVariable(variable, value, scene))),
      selectField(t("typeLabel"), variableTypeOptions, variable.type, (value) => {
        const previousType = variable.type || "string";
        const previousValue = variable.value;
        variable.type = value;
        variable.value = preserveValueForType(previousValue, previousType, value);
        render({ preserveScroll: true });
      }),
      typedValueField(variable, (value) => (variable.value = value)),
    );
    wrap.append(item);
  });
  return wrap;
}

function localAssetsEditor(scene, sceneIndex) {
  const wrap = div("nested nested-panel");
  const scenePath = sceneContextPath(scene, sceneIndex);
  annotateContext(wrap, {
    id: contextId("scene", sceneIndex, "assets"),
    kind: t("scenesTitle"),
    title: t("sceneLocalAssets"),
    subtitle: scene.title || scene.id || t("sceneDefaultTitle"),
    depth: 1,
    path: `${scenePath} -> ${t("sceneLocalAssets")}`,
  });
  wrap.append(rowTitle(t("sceneLocalAssets"), addButton(t("addAsset"), () => {
    scene.assets ||= [];
    scene.assets.push({ id: `${scene.id || t("scenePrefix")}_${t("assetPrefix")}_${scene.assets.length + 1}`, type: "image", url: "", metadata: "" });
    render({ preserveScroll: true });
  })));
  (scene.assets || []).forEach((asset, index) => {
    const item = div("item subitem");
    const assetTitle = t("assetItem", { index: index + 1 });
    annotateContext(item, {
      id: contextId("scene", sceneIndex, "asset", index, asset.id || index),
      kind: t("sceneLocalAssets"),
      title: assetTitle,
      subtitle: asset.id || `${t("assetPrefix")}_${index + 1}`,
      depth: 2,
      path: `${scenePath} -> ${assetTitle}`,
    });
    item.append(
      rowHead(assetTitle, () => removeAssetAt(scene.assets, index, scene)),
      field(t("idLabel"), input(asset.id, (value) => renameAsset(asset, value, scene))),
      selectField(t("typeLabel"), ["image", "music", "sound", "video", "sprite"], asset.type, (value) => (asset.type = value)),
      field(t("urlLabel"), input(asset.url, (value) => (asset.url = value))),
      assetUploadField(asset, scene),
      field(t("metadataJsonLabel"), textarea(asset.metadata || "", (value) => (asset.metadata = value), 3)),
    );
    wrap.append(item);
  });
  return wrap;
}

function sceneContextPath(scene, sceneIndex) {
  return t("sceneItem", { index: Number(sceneIndex ?? 0) + 1, name: scene?.id || t("newSceneFallback") });
}

function choiceContextPath(scene, sceneIndex, choiceIndex, choice = null) {
  const scenePath = sceneContextPath(scene, sceneIndex);
  const choiceTitle = t("choiceItem", { index: Number(choiceIndex ?? 0) + 1 });
  return `${scenePath} -> ${choiceTitle}`;
}

function serializeVariable(variable) {
  const value = coerceValue(variable.type, variable.value);
  if (variable.type === "timer") {
    return variable.showInStats ? { type: "timer", value, showInStats: true } : { type: "timer", value };
  }
  return variable.showInStats ? { value, showInStats: true } : value;
}

function serializeConditions(conditions, scene = null) {
  return conditions.map((condition) => ({
    var: condition.variable,
    op: condition.op,
    value: coerceValue(variableType(condition.variable, scene), condition.value),
  }));
}

function serializeEffects(effects, scene = null) {
  return effects.map((effect) => effect.kind === "inc"
    ? { inc: effect.variable, value: Number(effect.value || 0) }
    : { set: effect.variable, value: coerceValue(variableType(effect.variable, scene), effect.value) });
}

function validateStory(story) {
  const errors = [];
  const sceneIds = story.scenes.map((scene) => scene.id);
  const assetIds = story.assets.map((asset) => asset.id);
  const globalVariableNames = Object.keys(story.variables);
  if (!story.key) errors.push(t("keyRequired"));
  if (!story.title) errors.push(t("titleRequired"));
  if (!story.startSceneId || !sceneIds.includes(story.startSceneId)) errors.push(t("startSceneMissing"));
  duplicates(sceneIds).forEach((id) => errors.push(t("duplicateSceneId", { id })));
  story.scenes.forEach((scene) => {
    const sceneAssetIds = [...assetIds, ...(scene.assets || []).map((asset) => asset.id)];
    const variableNames = [...globalVariableNames, ...Object.keys(scene.variables || {})];
    if (scene.background && !sceneAssetIds.includes(scene.background)) errors.push(t("missingBackground", { scene: scene.id, asset: scene.background }));
    if (scene.music && !sceneAssetIds.includes(scene.music)) errors.push(t("missingMusic", { scene: scene.id, asset: scene.music }));
    duplicates(scene.choices.map((choice) => choice.id)).forEach((id) => errors.push(t("duplicateChoiceId", { scene: scene.id, id })));
    extractTextVariables(scene.text).forEach((variable) => {
      if (!variableNames.includes(variable)) errors.push(t("missingTextVariable", { scene: scene.id, variable }));
    });
    scene.choices.forEach((choice) => {
      if (!sceneIds.includes(choice.target)) errors.push(t("missingTarget", { choice: choice.id, scene: scene.id, target: choice.target }));
      if (choice.fallbackTarget && !sceneIds.includes(choice.fallbackTarget)) errors.push(t("missingTarget", { choice: choice.id, scene: scene.id, target: choice.fallbackTarget }));
      choice.conditions.forEach((condition) => {
        if (!variableNames.includes(condition.var)) errors.push(t("missingConditionVariable", { choice: choice.id, variable: condition.var }));
      });
      choice.effects.forEach((effect) => {
        const name = effect.inc || effect.set;
        if (!variableNames.includes(name)) errors.push(t("missingEffectVariableChoice", { choice: choice.id, variable: name }));
        if (effect.inc && variableType(effect.inc, draft.scenes.find((candidate) => candidate.id === scene.id)) !== "number") errors.push(t("invalidIncChoice", { choice: choice.id, variable: effect.inc }));
      });
    });
    scene.effects.forEach((effect) => {
      const name = effect.inc || effect.set;
      if (!variableNames.includes(name)) errors.push(t("missingEffectVariableScene", { scene: scene.id, variable: name }));
      if (effect.inc && variableType(effect.inc, draft.scenes.find((candidate) => candidate.id === scene.id)) !== "number") errors.push(t("invalidIncScene", { scene: scene.id, variable: effect.inc }));
    });
  });
  return errors;
}

function extractTextVariables(text) {
  return [...new Set([...String(text || "").matchAll(/\{\{\s*([^{}\s]+)\s*}}/g)].map((match) => match[1]))];
}

function fromStoryJson(story) {
  if (!story || typeof story !== "object" || Array.isArray(story) || !Array.isArray(story.scenes)) {
    throw new Error("Ожидается объект истории с массивом scenes / Expected a story object with a scenes array");
  }
  if (story.metadata != null) {
    const object = value => value != null && typeof value === "object" && !Array.isArray(value);
    const optionalArray = value => value == null || (Array.isArray(value) && value.every(object));
    const meta = story.metadata;
    if (!object(meta) || !optionalArray(meta.relations) || (meta.inputContract != null && (!object(meta.inputContract) || !optionalArray(meta.inputContract.fields)))
      || (meta.relations || []).some(relation => !object(relation.target) || (relation.stateTransfer != null && (!object(relation.stateTransfer) || !optionalArray(relation.stateTransfer.mapping))))) {
      throw new Error("Неверная структура связей или входного контракта / Invalid relations or input contract shape");
    }
  }
  draft = {
    key: story.key || t("newStoryKey"),
    title: story.title || t("newStoryTitle"),
    description: story.description || "",
    genre: story.genre || "",
    topic: story.topic || "",
    completionStatus: story.completionStatus || "",
    ...(story.metadata ? {metadata:structuredClone(story.metadata)} : {}),
    version: story.version || 1,
    startSceneId: story.startSceneId || "",
    variables: Object.entries(story.variables || {}).map(([name, definition]) => {
      const value = variableValue(definition);
      return {
        name,
        type: detectType(definition),
        value,
        showInStats: Boolean(definition && typeof definition === "object" && definition.showInStats),
      };
    }),
    assets: (story.assets || [])
      .filter((asset) => asset.id)
      .map((asset) => ({ id: asset.id, type: asset.type || "image", url: asset.url || "", metadata: asset.metadata ? JSON.stringify(asset.metadata, null, 2) : "" })),
    scenes: (story.scenes || []).map((scene) => ({
      id: scene.id,
      title: scene.title || "",
      text: scene.text || "",
      variables: Object.entries(scene.variables || {}).map(([name, definition]) => {
        const value = variableValue(definition);
        return {
          name,
          type: detectType(definition),
          value,
          showInStats: false,
        };
      }),
      assets: (scene.assets || []).map((asset) => ({ id: asset.id, type: asset.type || "image", url: asset.url || "", metadata: asset.metadata ? JSON.stringify(asset.metadata, null, 2) : "" })),
      background: scene.background || "",
      music: scene.music || "",
      animationType: scene.animation?.type || "none",
      animationDurationMs: scene.animation?.durationMs || 600,
      effects: parseEffects(scene.effects || []),
      endingEnabled: Boolean(scene.ending),
      endingType: scene.ending?.type || "",
      endingTitle: scene.ending?.title || "",
      choices: (scene.choices || []).map((choice) => ({
        id: choice.id,
        label: choice.label || "",
        target: choice.target || "",
        fallbackTarget: choice.fallbackTarget || "",
        conditions: (choice.conditions || []).map(parseCondition),
        effects: parseEffects(choice.effects || []),
      })),
    })),
  };
  render();
}

function parseCondition(condition) {
  return {
    variable: condition.var ?? condition.variable ?? condition.name ?? "",
    op: condition.op ?? condition.operator ?? "==",
    value: condition.value ?? defaultValue(variableType(condition.var ?? condition.variable ?? condition.name ?? "")),
  };
}

function parseEffects(effects) {
  return effects.map((effect) => {
    if (effect.kind) {
      return {
        kind: effect.kind === "inc" ? "inc" : "set",
        variable: effect.variable ?? effect.set ?? effect.inc ?? effect.name ?? "",
        value: effect.value ?? (effect.kind === "inc" ? 1 : ""),
      };
    }
    if (Object.hasOwn(effect, "inc")) {
      return { kind: "inc", variable: effect.inc ?? effect.variable ?? effect.name ?? "", value: effect.value ?? 1 };
    }
    return { kind: "set", variable: effect.set ?? effect.variable ?? effect.name ?? "", value: effect.value };
  });
}

function localizeDraftDefaults(sourceDraft) {
  const draftCopy = structuredClone(sourceDraft);
  const replaceIfDefault = (value, ruValue, enValue) => {
    if (value === ruValue || value === enValue) {
      return currentLanguage === "ru" ? ruValue : enValue;
    }
    return value;
  };

  draftCopy.title = replaceIfDefault(draftCopy.title, translations.ru.newStoryTitle, translations.en.newStoryTitle);
  draftCopy.description = replaceIfDefault(draftCopy.description, translations.ru.builderExampleDescription, translations.en.builderExampleDescription);

  draftCopy.scenes = (draftCopy.scenes || []).map((scene) => ({
    ...scene,
    title: replaceIfDefault(
      replaceIfDefault(
        replaceIfDefault(
          replaceIfDefault(scene.title, translations.ru.exampleStartTitle, translations.en.exampleStartTitle),
          translations.ru.doorTitle,
          translations.en.doorTitle,
        ),
        translations.ru.goodEndingTitle,
        translations.en.goodEndingTitle,
      ),
      translations.ru.quietEndingTitle,
      translations.en.quietEndingTitle,
    ),
    text: replaceIfDefault(
      replaceIfDefault(
        replaceIfDefault(
          replaceIfDefault(scene.text, translations.ru.defaultSceneText, translations.en.defaultSceneText),
          translations.ru.exampleStartText,
          translations.en.exampleStartText,
        ),
        translations.ru.doorText,
        translations.en.doorText,
      ),
      translations.ru.goodEndingText,
      translations.en.goodEndingText,
    ) === translations.en.goodEndingText || replaceIfDefault(
      replaceIfDefault(
        replaceIfDefault(
          replaceIfDefault(scene.text, translations.ru.defaultSceneText, translations.en.defaultSceneText),
          translations.ru.exampleStartText,
          translations.en.exampleStartText,
        ),
        translations.ru.doorText,
        translations.en.doorText,
      ),
      translations.ru.goodEndingText,
      translations.en.goodEndingText,
    ) === translations.ru.goodEndingText
      ? replaceIfDefault(
        replaceIfDefault(
          replaceIfDefault(
            replaceIfDefault(scene.text, translations.ru.defaultSceneText, translations.en.defaultSceneText),
            translations.ru.exampleStartText,
            translations.en.exampleStartText,
          ),
          translations.ru.doorText,
          translations.en.doorText,
        ),
        translations.ru.goodEndingText,
        translations.en.goodEndingText,
      )
      : replaceIfDefault(scene.text, translations.ru.quietEndingText, translations.en.quietEndingText),
    endingTitle: replaceIfDefault(
      replaceIfDefault(scene.endingTitle, translations.ru.goodEndingLabel, translations.en.goodEndingLabel),
      translations.ru.quietEndingLabel,
      translations.en.quietEndingLabel,
    ),
    choices: (scene.choices || []).map((choice) => ({
      ...choice,
      label: replaceIfDefault(
        replaceIfDefault(
          replaceIfDefault(
            replaceIfDefault(choice.label, translations.ru.takeKey, translations.en.takeKey),
            translations.ru.goWithoutKey,
            translations.en.goWithoutKey,
          ),
          translations.ru.openDoor,
          translations.en.openDoor,
        ),
        translations.ru.waitOutside,
        translations.en.waitOutside,
      ),
    })),
  }));

  return draftCopy;
}

function field(labelText, control, className = "") {
  const label = document.createElement("label");
  if (className) label.className = className;
  const text = document.createElement("span");
  text.className = "field-label";
  text.textContent = labelText;
  label.append(text, control);
  return label;
}

function input(value, onChange, type = "text") {
  const el = document.createElement("input");
  el.type = type;
  el.value = value ?? "";
  el.oninput = () => {
    const scrollState = captureScrollState();
    onChange(type === "number" ? Number(el.value || 0) : el.value);
    renderPreview();
    saveDraft();
    restoreScrollState(scrollState);
  };
  return el;
}

function textarea(value, onChange, rows = 3) {
  const el = document.createElement("textarea");
  el.rows = rows;
  el.value = value ?? "";
  el.oninput = () => {
    const scrollState = captureScrollState();
    onChange(el.value);
    renderPreview();
    saveDraft();
    restoreScrollState(scrollState);
  };
  return el;
}

function sceneTextField(scene) {
  const wrap = div("field-wide variable-text-field");
  const label = document.createElement("label");
  label.className = "field-label";
  label.textContent = t("textLabel");
  const control = textarea(scene.text, (value) => (scene.text = value), 4);
  control.id = `scene-text-${draft.scenes.indexOf(scene)}`;
  label.htmlFor = control.id;
  sceneTextControls.set(scene, control);
  const tools = div("variable-insert-tools");
  const names = draft.variables.map((variable) => variable.name).filter(Boolean);
  if (!names.length) {
    const empty = document.createElement("span");
    empty.className = "muted-hint";
    empty.textContent = t("noGlobalVariables");
    tools.append(empty);
  }
  names.forEach((name) => {
    const insert = button(`{{${name}}}`, () => {
      insertTextAtCursor(control, `{{${name}}}`);
      scene.text = control.value;
      renderPreview();
      saveDraft();
      control.focus();
    });
    insert.title = `${t("insertVariableIntoText")}: ${name}`;
    tools.append(insert);
  });
  wrap.append(label, control, tools);
  return wrap;
}

function insertTextAtCursor(control, text) {
  const start = control.selectionStart ?? control.value.length;
  const end = control.selectionEnd ?? control.value.length;
  control.value = `${control.value.slice(0, start)}${text}${control.value.slice(end)}`;
  const nextPosition = start + text.length;
  control.setSelectionRange(nextPosition, nextPosition);
}

function selectField(labelText, options, selected, onChange) {
  const select = document.createElement("select");
  fillSelect(select, keepSelectedOption(options, selected), false);
  select.value = selected ?? "";
  select.onchange = () => {
    onChange(select.value);
    render({ preserveScroll: true });
  };
  return field(labelText, select);
}

function keepSelectedOption(options, selected) {
  const value = selected ?? "";
  if (!value || options.includes(value)) {
    return options;
  }
  return [value, ...options];
}

function checkboxField(labelText, checked, onChange) {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = checked;
  checkbox.onchange = () => {
    const scrollState = captureScrollState();
    onChange(checkbox.checked);
    renderPreview();
    saveDraft();
    restoreScrollState(scrollState);
  };
  return switchLabel(labelText, checkbox);
}

function switchLabel(labelText, checkbox) {
  const label = document.createElement("label");
  label.className = "switch-field";
  const visual = document.createElement("span");
  visual.className = "switch-control";
  const text = document.createElement("span");
  text.className = "switch-text";
  text.textContent = labelText;
  label.append(checkbox, visual, text);
  return label;
}

function assetUploadField(asset, scene = null) {
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "image/*,audio/*";
  picker.onchange = async () => {
    const file = picker.files?.[0];
    if (!file) return;
    const scrollState = captureScrollState();
    try {
      applyAssetTypeFromFile(asset, file);
      await uploadAssetFile(asset, file, scene ? "local" : "global");
      render({ preserveScroll: true });
    } catch (error) {
      els.apiResult.textContent = error.message;
    } finally {
      picker.value = "";
      restoreScrollState(scrollState);
    }
  };
  return field(t("uploadAsset"), picker);
}

function applyAssetTypeFromFile(asset, file) {
  const contentType = file.type || "";
  if (contentType.startsWith("audio/")) {
    asset.type = "music";
  } else if (contentType.startsWith("image/")) {
    asset.type = "image";
  }
}

function sceneAssetUploadField(scene, targetField) {
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = targetField === "music" ? "audio/*" : "image/*";
  picker.onchange = async () => {
    const file = picker.files?.[0];
    if (!file) return;
    const scrollState = captureScrollState();
    const asset = {
      id: uniqueDraftAssetId(`${scene.id || t("scenePrefix")}_${targetField}`, scene),
      type: targetField === "music" ? "music" : "image",
      url: "",
      metadata: "",
    };
    scene.assets ||= [];
    scene.assets.push(asset);
    try {
      await uploadAssetFile(asset, file, "local");
      scene[targetField] = asset.id;
      render({ preserveScroll: true });
    } catch (error) {
      scene.assets = scene.assets.filter((candidate) => candidate !== asset);
      els.apiResult.textContent = error.message;
      render({ preserveScroll: true });
    } finally {
      picker.value = "";
      restoreScrollState(scrollState);
    }
  };
  return field(t("uploadSceneAsset"), picker);
}

function uniqueDraftAssetId(base, scene = null) {
  const normalized = String(base || t("assetPrefix"))
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "") || t("assetPrefix");
  const existing = new Set([
    ...draft.assets.map((asset) => asset.id),
    ...((scene?.assets || []).map((asset) => asset.id)),
  ]);
  if (!existing.has(normalized)) return normalized;
  let index = 2;
  while (existing.has(`${normalized}_${index}`)) index += 1;
  return `${normalized}_${index}`;
}

function typedValueField(variable, onChange) {
  if (variable.type === "boolean") {
    return selectField(t("valueLabel"), ["false", "true"], String(toBoolean(variable.value)), (value) => onChange(value === "true"));
  }
  return field(t("valueLabel"), input(variable.value ?? "", (value) => onChange(coerceValue(variable.type, value)), ["number", "timer"].includes(variable.type) ? "number" : "text"));
}

function preserveValueForType(value, previousType, nextType, effectKind = "set") {
  if (effectKind === "inc") {
    return toNumberOrDefault(value, 1);
  }
  if (previousType === nextType) {
    return coerceValue(nextType, value);
  }
  if (nextType === "number" || nextType === "timer") {
    return toNumberOrDefault(value, 0);
  }
  if (nextType === "boolean") {
    return toBoolean(value);
  }
  return value == null ? "" : String(value);
}

function toNumberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return Boolean(value);
}

function fillSelect(select, options, includeEmpty) {
  select.replaceChildren();
  const values = includeEmpty ? ["", ...options] : options;
  values.forEach((option) => {
    const el = document.createElement("option");
    el.value = option;
    el.textContent = option || t("noneOption");
    select.append(el);
  });
}

function rowHead(title, onRemove) {
  const row = div("row-head");
  const strong = document.createElement("strong");
  strong.textContent = title;
  row.append(strong, button(t("removeButton"), () => handleRemove(onRemove), "danger small"));
  return row;
}

function rowTitle(title, action) {
  const row = div("row-head");
  const strong = document.createElement("strong");
  strong.textContent = title;
  const topic = Object.keys(helpTopics).find(key => t(key) === title);
  if (topic) {
    const heading = div("builder-help-heading");
    heading.append(strong, helpButton(topic, currentLanguage));
    row.append(heading);
  } else row.append(strong);
  if (action) row.append(action);
  return row;
}

function addButton(text, onClick) {
  return button(text, onClick, "secondary small add-button");
}

function button(text, onClick, className = "secondary small") {
  const el = document.createElement("button");
  el.type = "button";
  el.className = className;
  el.textContent = text;
  el.onclick = onClick;
  return el;
}

function div(className) {
  const el = document.createElement("div");
  el.className = className;
  return el;
}

function appendCollectionToolbar(container, ids) {
  if (!ids.length) return;
  const toolbar = div("collection-toolbar");
  toolbar.append(
    button(t("collapseAll"), () => {
      setCollapsedMany(ids, true);
      render();
    }),
    button(t("expandAll"), () => {
      setCollapsedMany(ids, false);
      render();
    }),
  );
  container.append(toolbar);
}

function collapsibleItem({ title, subtitle, key, onRemove, entityKind = "", entityId = "" }) {
  const details = document.createElement("details");
  details.className = "item collapsible-item";
  details.open = !isCollapsed(key);
  if (entityKind) details.dataset.entityKind = entityKind;
  if (entityId) details.dataset.entityId = entityId;
  details.ontoggle = () => {
    collapseState[key] = !details.open;
    saveCollapseState();
  };

  const summary = document.createElement("summary");
  summary.className = "row-head collapsible-summary";

  const text = div("summary-copy");
  const strong = document.createElement("strong");
  strong.textContent = title;
  text.append(strong);
  if (subtitle) {
    const meta = document.createElement("span");
    meta.className = "summary-subtitle";
    meta.textContent = subtitle;
    text.append(meta);
  }

  const actions = div("summary-actions");
  const state = document.createElement("span");
  state.className = "summary-state";
  state.textContent = details.open ? t("expandedHint") : t("collapsedHint");
  actions.append(state);

  details.addEventListener("toggle", () => {
    state.textContent = details.open ? t("expandedHint") : t("collapsedHint");
  });

  summary.append(text, actions);
  const tools = div("collapsible-tools");
  tools.append(summaryRemoveButton(onRemove));
  details.append(summary, tools);
  return details;
}

function summaryRemoveButton(onRemove) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "danger small";
  el.textContent = t("removeButton");
  el.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleRemove(onRemove);
  };
  return el;
}

function handleRemove(onRemove) {
  try {
    const result = onRemove();
    if (result?.then) {
      result.catch((error) => {
        els.apiResult.textContent = error.message;
      });
    } else {
      render();
    }
  } catch (error) {
    els.apiResult.textContent = error.message;
  }
}

function collapseKey(kind, value) {
  return `${kind}:${value}`;
}

function isCollapsed(key) {
  return collapseState[key] === true;
}

function setCollapsedMany(ids, collapsed) {
  ids.forEach((id) => {
    collapseState[id] = collapsed;
  });
  saveCollapseState();
}

function applyHashFocus() {
  if (!window.location.hash.startsWith("#")) return;
  if (window.location.hash === lastAppliedHash) return;
  const raw = decodeURIComponent(window.location.hash.slice(1));
  const [kind, ...rest] = raw.split(":");
  const entityId = rest.join(":");
  if (!kind || !entityId) return;
  const target = document.querySelector(`[data-entity-kind="${cssEscape(kind)}"][data-entity-id="${cssEscape(entityId)}"]`);
  if (!target) return;
  if (target.tagName === "DETAILS") {
    target.open = true;
    const stateKey = target.dataset.entityKind === "scene"
      ? collapseKey("scene", entityId)
      : target.dataset.entityKind === "asset"
        ? collapseKey("asset", draft.assets.findIndex((asset) => (asset.id || "") === entityId))
        : collapseKey("variable", draft.variables.findIndex((variable) => (variable.name || "") === entityId));
    collapseState[stateKey] = false;
    saveCollapseState();
  }
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  lastAppliedHash = window.location.hash;
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return String(value).replace(/["\\]/g, "\\$&");
}

function removeAt(list, index) {
  list.splice(index, 1);
  render();
}

function renameScene(scene, nextId) {
  const previousId = scene.id || scene._lastId;
  scene.id = nextId;
  if (!previousId || !nextId || previousId === nextId) {
    scene._lastId = nextId || previousId;
    return;
  }
  if (draft.startSceneId === previousId) draft.startSceneId = nextId;
  for (const candidate of draft.scenes) {
    for (const choice of candidate.choices || []) {
      if (choice.target === previousId) choice.target = nextId;
      if (choice.fallbackTarget === previousId) choice.fallbackTarget = nextId;
    }
  }
  scene._lastId = nextId;
  renderMeta();
}

function renameAsset(asset, nextId, scene = null) {
  const previousId = asset.id || asset._lastId;
  asset.id = nextId;
  if (!previousId || !nextId || previousId === nextId) {
    asset._lastId = nextId || previousId;
    return;
  }
  const scenes = scene ? [scene] : draft.scenes.filter(candidate => !(candidate.assets || []).some(local => local.id === previousId));
  for (const candidate of scenes) {
    if (candidate.background === previousId) candidate.background = nextId;
    if (candidate.music === previousId) candidate.music = nextId;
  }
  asset._lastId = nextId;
}

async function removeAssetAt(list, index, scene = null) {
  const asset = list[index];
  if (!asset) return;
  const deleted = list.splice(index, 1)[0];
  if (scene) {
    if (scene.background === deleted.id) scene.background = "";
    if (scene.music === deleted.id) scene.music = "";
  } else {
    draft.scenes.forEach((candidate) => {
      if ((candidate.assets || []).some(local => local.id === deleted.id)) return;
      if (candidate.background === deleted.id) candidate.background = "";
      if (candidate.music === deleted.id) candidate.music = "";
    });
  }
  try {
    await deleteUploadedAsset(deleted);
  } finally {
    render();
  }
}

function renameVariable(variable, nextName, scene = null) {
  const oldName = variable.name || variable._lastName || "";
  variable.name = nextName;
  if (nextName) {
    rememberVariableName(variable, nextName);
  }
  if (!oldName || !nextName || oldName === nextName) {
    return;
  }
  if (scene) {
    renameVariableReferencesInScene(scene, oldName, nextName);
    return;
  }
  draft.scenes.forEach((candidate) => {
    if ((candidate.variables || []).some((localVariable) => localVariable.name === oldName)) {
      return;
    }
    renameVariableReferencesInScene(candidate, oldName, nextName);
  });
}

function rememberVariableName(variable, name) {
  Object.defineProperty(variable, "_lastName", {
    value: name,
    writable: true,
    configurable: true,
    enumerable: false,
  });
}

function renameVariableReferencesInScene(scene, oldName, nextName) {
  if (typeof scene.text === "string") {
    scene.text = scene.text.replace(/(\{\{\s*)([^{}\s]+)(\s*}})/g, (placeholder, open, name, close) =>
      name === oldName ? `${open}${nextName}${close}` : placeholder);
    const control = sceneTextControls.get(scene);
    if (control?.isConnected) control.value = scene.text;
  }
  renameVariableReferences(scene.effects || [], oldName, nextName);
  (scene.choices || []).forEach((choice) => {
    (choice.conditions || []).forEach((condition) => {
      if (condition.variable === oldName) {
        condition.variable = nextName;
      }
    });
    renameVariableReferences(choice.effects || [], oldName, nextName);
  });
}

function renameVariableReferences(effects, oldName, nextName) {
  effects.forEach((effect) => {
    if (effect.variable === oldName) {
      effect.variable = nextName;
    }
  });
}

function firstVariable(scene = null) {
  return variableOptions(scene)[0] || "";
}

function variableType(name, scene = null) {
  return (scene?.variables || []).find((variable) => variable.name === name)?.type
    || draft.variables.find((variable) => variable.name === name)?.type
    || "string";
}

function variableOptions(scene = null) {
  return [
    ...draft.variables.map((variable) => variable.name),
    ...((scene?.variables || []).map((variable) => variable.name)),
  ].filter(Boolean);
}

function assetOptions(scene = null) {
  return [
    ...draft.assets.map((asset) => asset.id),
    ...((scene?.assets || []).map((asset) => asset.id)),
  ].filter(Boolean);
}

function defaultValue(type) {
  if (type === "number") return 0;
  if (type === "timer") return 60;
  if (type === "boolean") return false;
  return "";
}

function coerceValue(type, value) {
  if (type === "number") return Number(value || 0);
  if (type === "timer") return Math.max(0, Number(value || 0));
  if (type === "boolean") return value === true || value === "true";
  return value ?? "";
}

function detectType(value) {
  if (value && typeof value === "object" && value.type === "timer") {
    return "timer";
  }
  if (value && typeof value === "object" && "value" in value) {
    return detectType(value.value);
  }
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "string";
}

function variableValue(value) {
  return value && typeof value === "object" && "value" in value ? value.value : value;
}

function parseMetadata(value) {
  if (!value || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return { raw: value };
  }
}

function duplicates(values) {
  const seen = new Set();
  const duplicate = new Set();
  values.filter(Boolean).forEach((value) => {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  });
  return [...duplicate];
}

function getDraftStoryId() {
  const binding = draft.runtimeStory;
  return binding?.key === draft.key && binding.base === els.runtimeUrl.value.replace(/\/$/, "")
    ? binding.storyId : null;
}

function bindDraftStory(storyId, savedDocument = null, revision = null) {
  draft.runtimeStory = { storyId, key: draft.key, base: els.runtimeUrl.value.replace(/\/$/, ""), savedDocument, revision };
  saveDraft();
}

function saveDraft() {
  draftStorageFailed = !writeLocalStorage(storageKey, JSON.stringify(draft));
  const warning = document.querySelector("#local-draft-warning");
  warning.hidden = !draftStorageFailed;
  warning.textContent = draftStorageFailed ? t("localDraftSaveFailed") : "";
  renderAuthorWorkspace();
  return !draftStorageFailed;
}

function readLocalStorage(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeLocalStorage(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

function removeLocalStorage(key) {
  try { localStorage.removeItem(key); return true; } catch { return false; }
}

function hasUnsavedChanges() {
  return !getDraftStoryId() || draft.runtimeStory?.savedDocument !== JSON.stringify(toStoryJson());
}

function updateServerDraftState() {
  const status = document.querySelector("#server-draft-state");
  if (status) status.textContent = hasUnsavedChanges() ? t("unsavedChanges") : t("savedOnServer", { revision: draft.runtimeStory?.revision || "—" });
}

function loadDraft() {
  try {
    const raw = readLocalStorage(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAuthorSession(session) {
  if (!session || (authorSession?.id || authorSession?.email) !== (session.id || session.email)) authorHomeCache = null;
  authorSession = session;
  els.authorName.value = session?.email || "";
  if (session) {
    writeLocalStorage(authorStorageKey, JSON.stringify(session));
  } else {
    removeLocalStorage(authorStorageKey);
  }
  renderAuthorWorkspace();
  updateAuthorGate();
}

function loadAuthorSession() {
  try {
    const raw = readLocalStorage(authorStorageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCollapseState() {
  writeLocalStorage(collapseStateKey, JSON.stringify(collapseState));
}

function loadCollapseState() {
  try {
    const raw = readLocalStorage(collapseStateKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function outlineOpenState(key, fallback) {
  return Object.hasOwn(outlineState, key) ? outlineState[key] !== false : fallback;
}

function saveOutlineOpenState(key, open) {
  outlineState[key] = Boolean(open);
  writeLocalStorage(outlineStateKey, JSON.stringify(outlineState));
}

function loadOutlineState() {
  try {
    const raw = readLocalStorage(outlineStateKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function authorHeaders(contentType = false) {
  const headers = { "X-Fraer-Request": "same-origin" };
  if (contentType) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

async function authorFetch(path, options = {}) {
  return authorFetchAttempt(path, options, true);
}

async function authorFetchAttempt(path, options = {}, allowRefresh = true) {
  const base = els.runtimeUrl.value.replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...authorHeaders(Boolean(options.body)),
      ...(options.headers || {}),
    },
    credentials: "include",
    cache: "no-store",
    body: options.body,
  });
  if (response.status === 401 && allowRefresh && shouldRefreshAuth(path)) {
    await refreshAuth(base);
    return authorFetchAttempt(path, options, false);
  }
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(payload.code === "REVIEW_LIMIT_REACHED" ? reviewLimitMessage(currentLanguage) : payload.message || payload.detail || payload.error || `HTTP ${response.status}`);
    error.status = response.status; error.code = payload.code;
    throw error;
  }
  return payload;
}

const authorRefreshPromises = new Map();

async function refreshAuth(base = els.runtimeUrl.value.replace(/\/$/, "")) {
  if (!authorRefreshPromises.has(base)) {
    authorRefreshPromises.set(base, performAuthRefresh(base).finally(() => { authorRefreshPromises.delete(base); }));
  }
  return authorRefreshPromises.get(base);
}

async function performAuthRefresh(base) {
  const response = await fetch(`${base}/auth/refresh`, {
    method: "POST",
    headers: { Accept: "application/json", "X-Fraer-Request": "same-origin" },
    credentials: "include",
  });
  if (response.status === 401) {
    // Another tab can win one-time refresh rotation before its new cookies arrive.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await new Promise(resolve => setTimeout(resolve, attempt * 150));
      const session = await fetch(`${base}/auth/me`, {
        headers: { Accept: "application/json" }, credentials: "include", cache: "no-store",
      });
      if (session.ok) return;
      if (session.status !== 401) break;
    }
  }
  if (!response.ok) {
    throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
  }
}

function shouldRefreshAuth(path) {
  return !String(path).startsWith("/auth/verify")
    && !String(path).startsWith("/auth/logout")
    && !String(path).startsWith("/auth/refresh");
}

async function uploadAssetFile(asset, file, scope = "global") {
  if (!canAuthor()) {
    throw new Error(t("uploadAssetFirst"));
  }
  const uploadDraft = draft;
  const uploadKey = draft.key;
  const base = els.runtimeUrl.value.replace(/\/$/, "");
  if (!getDraftStoryId()) {
    await importDraftToRuntime();
  }
  const storyId = getDraftStoryId();
  if (draft !== uploadDraft || draft.key !== uploadKey || base !== els.runtimeUrl.value.replace(/\/$/, "")) throw new Error(t("draftChanged"));
  if (!storyId) {
    throw new Error(t("uploadAssetFirst"));
  }
  const form = new FormData();
  form.append("file", file);
  if (asset.id) {
    form.append("assetKey", asset.id);
  }
  if (asset.type) {
    form.append("type", asset.type);
  }
  if (scope === "local") {
    form.append("scope", "local");
  }
  const payload = await fetchJson(`${base}/api/author/stories/${storyId}/assets`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...authorHeaders(false),
    },
    body: form,
  });
  asset.id = payload.id;
  asset.type = payload.type;
  asset.url = payload.url;
  asset.metadata = payload.metadata ? JSON.stringify(payload.metadata, null, 2) : "";
  if (draft !== uploadDraft || draft.key !== uploadKey || base !== els.runtimeUrl.value.replace(/\/$/, "")) throw new Error(t("draftChanged"));
  renderPreview();
  saveDraft();
  await importDraftToRuntime();
  els.apiResult.textContent = t("uploadAssetDone", { id: payload.id });
  return payload;
}

async function deleteUploadedAsset(asset) {
  const storyId = getDraftStoryId();
  if (!asset?.url || !isUploadedAssetUrl(asset.url) || !canAuthor() || !storyId) {
    return null;
  }
  const base = els.runtimeUrl.value.replace(/\/$/, "");
  const params = new URLSearchParams({ url: asset.url });
  if (asset.id) {
    params.set("assetKey", asset.id);
  }
  const payload = await fetchJson(`${base}/api/author/stories/${storyId}/assets?${params}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      ...authorHeaders(false),
    },
  });
  els.apiResult.textContent = t("deleteAssetDone", { id: asset.id || asset.url });
  return payload;
}

function isUploadedAssetUrl(url) {
  return typeof url === "string" && url.startsWith("/uploads/");
}

async function loginAuthor() {
  await bootstrapAuth();
}

async function loadAuthorHome() {
  if (!authorSession) {
    renderAuthorWorkspace();
    return null;
  }
  const home = await authorFetch("/api/author/home");
  authorHomeCache = home;
  renderAuthorWorkspace(home);
  return home;
}

window.addEventListener("focus",()=>{
  if(canAuthor()&&!builderWorkflowBusy)loadAuthorHome().catch(()=>{});
});

const panelWords = {
  chapter: ['Моя глава', 'My chapter'], check: ['Проверка', 'Validation'], publication: ['Публикация', 'Publication'],
  save: ['Сохранить главу', 'Save chapter'], preview: ['Предпросмотр', 'Preview'], close: ['Закрыть', 'Close'],
  checkAgain: ['Проверить ещё раз', 'Check again'], submit: ['Отправить на модерацию', 'Submit for moderation'],
  saveHint: ['Сохранённая на сервере глава доступна с других устройств.', 'A chapter saved on the server is available on other devices.'],
  checkHint: ['Проверяем текущий JSON: сцены, переменные и переходы. Изменения сохранять не обязательно.', 'Check the current JSON: scenes, variables and transitions. Saving is not required.'],
  checkNote: ['Это проверка структуры, а не литературного текста. Полная серверная проверка выполняется перед отправкой модератору.', 'This checks structure, not literary quality. Full server validation runs before submission.'],
  publicationHint: ['Глава станет доступна читателям после одобрения и публикации модератором.', 'Readers can access the chapter after a moderator approves and publishes it.'],
  submitHint: ['Перед отправкой проверим главу и сохраним изменения. На модерации может быть одна ваша история с её главами.', 'We will check and save the chapter. Only one of your stories and its chapters can be under review at a time.'],
  previewHint: ['Текущий текст и варианты выборов. Это просмотр сцен, без прохождения и сохранения прогресса.', 'Current text and choices. This is a scene preview without playthrough or saved progress.'],
};

function renderAuthorWorkspace(home = authorHomeCache) {
  const en = currentLanguage === "en";
  document.querySelector('.chapter-tabs').setAttribute('aria-label', en ? 'Chapter workspace' : 'Работа с главой');
  document.querySelectorAll('[data-panel-text]').forEach(node => {
    node.textContent = panelWords[node.dataset.panelText][en ? 1 : 0];
  });
  document.querySelectorAll('[data-chapter-tab]').forEach(node => {
    const label = panelWords[node.dataset.chapterTab][en ? 1 : 0];
    node.title = label; node.setAttribute('aria-label', label);
  });
  const current = home?.stories?.find(story => story.storyId === getDraftStoryId());
  if(current?.reviewLimitReached)document.querySelector('[data-panel-text="submitHint"]').textContent=reviewLimitMessage(currentLanguage);
  const items = chapterParent?.draftDocument?.items || [];
  const index = items.findIndex(item => item.target.id === getDraftStoryId());
  const parentId = chapterParent?.collectionId || chapterParent?.id;
  const parentLink = document.querySelector('.builder-home');
  parentLink.href = parentId ? `/my-stories/?collection=${encodeURIComponent(parentId)}` : '/';
  parentLink.querySelector('span').textContent = parentId ? (en ? 'Story chapters' : 'К главам истории') : t('backToSite');
  parentLink.onclick = parentId ? event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (hasUnsavedChanges() && !confirm(t('leaveChapterUnsaved'))) event.preventDefault();
  } : null;
  document.querySelector('#chapter-story-name').textContent = chapterParent?.title || chapterParent?.draftDocument?.title || (en ? 'Independent draft' : 'Отдельный черновик');
  document.querySelector('#chapter-number').textContent = index < 0 ? '' : [items[index].season, `${en ? 'Chapter' : 'Глава'} ${index + 1}`].filter(Boolean).join(' · ');
  document.querySelector('#chapter-title').textContent = draft.title || draft.key;
  document.querySelector('#chapter-status').textContent = current ? storyLabels(current, currentLanguage).join(' · ') : (en ? 'Draft' : 'Черновик');
  document.querySelector('#chapter-publication-status').textContent = current?.reviewState === 'in_review'
    ? (en ? 'Under review' : 'На модерации')
    : current?.publishedRevision && (hasUnsavedChanges() || current.draftRevision !== current.publishedRevision)
      ? (en ? 'Unpublished changes' : 'Есть неопубликованные изменения')
      : current ? storyLabels(current, currentLanguage).join(' · ') : (en ? 'Not published yet' : 'Ещё не опубликована');
  const comment = document.querySelector('#chapter-review-comment');
  comment.textContent = current?.reason || ''; comment.hidden = !comment.textContent;
  els.authorState.textContent = canAuthor() ? '' : (authorSession ? t('authorRoleMissing') : t('authorLoggedOut'));
  els.authorState.hidden = canAuthor();
  updateServerDraftState();
  updateAuthorGate();
}

function statusLabel(status) {
  const key = `status${String(status || "draft").replace(/^\w/, (char) => char.toUpperCase())}`;
  return t(key);
}

function updateAuthorGate() {
  const loggedIn = canAuthor();
  const current=authorHomeCache?.stories?.find(story=>story.storyId===getDraftStoryId());
  document.body.classList.toggle("builder-locked", !loggedIn);
  els.authorLogin.hidden = loggedIn;
  els.authorLogout.hidden = !loggedIn;
  els.authorName.disabled = loggedIn;
  document.querySelectorAll("main button, main input, main select, main textarea").forEach((control) => {
    const allowed = control.getAttribute("role") === "tab" || control === els.authorLogin || control === els.authorName || control.classList.contains("builder-help-button");
    if (control === els.authorLogout) {
      control.disabled = !loggedIn;
      return;
    }
    if (allowed) {
      control.disabled = false;
      return;
    }
    control.disabled = !loggedIn || (builderWorkflowBusy && (control.dataset.authorMutation === "true" || ["import-runtime", "validate-runtime", "publish-runtime", "author-story-select", "refresh-author", "runtime-url"].includes(control.id)));
    if(control.id==='publish-runtime'&&current?.reviewLimitReached)control.disabled=true;
  });
  document.querySelectorAll("a.nav-link").forEach((link) => {
    link.classList.toggle("is-disabled", !loggedIn);
    link.setAttribute("aria-disabled", String(!loggedIn));
    link.tabIndex = loggedIn ? 0 : -1;
  });
  document.querySelectorAll(".file-button").forEach((label) => {
    const input = label.querySelector("input");
    label.classList.toggle("is-disabled", Boolean(input?.disabled));
  });
}

function addSceneAndFocus() {
  const scene = {
    id: `${t("scenePrefix")}_${draft.scenes.length + 1}`,
    title: t("sceneDefaultTitle"),
    text: "",
    background: draft.assets[0]?.id || "",
    music: "",
    variables: [],
    assets: [],
    animationType: "fade-in",
    animationDurationMs: 600,
    effects: [],
    endingEnabled: false,
    endingType: "",
    endingTitle: "",
    choices: [],
  };
  draft.scenes.push(scene);
  collapseState[collapseKey("scene", scene.id)] = false;
  saveCollapseState();
  render();
  requestAnimationFrame(() => {
    document.querySelector(`[data-entity-kind="scene"][data-entity-id="${cssEscape(scene.id)}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderProjectOutline() {
  renderSimpleOutline(els.variableOutline, draft.variables, (variable, index) => ({
    label: variable.name || `${t("variablePrefix")}_${index + 1}`,
    kind: "variable",
    id: variable.name || `${index}`,
  }));
  renderSimpleOutline(els.assetOutline, draft.assets, (asset, index) => ({
    label: asset.id || `${t("assetPrefix")}_${index + 1}`,
    kind: "asset",
    id: asset.id || `${index}`,
  }));
  els.sceneOutline.replaceChildren();
  draft.scenes.forEach((scene, index) => {
    const item = div("outline-item");
    const link = button(`${index + 1}. ${scene.title || scene.id || t("sceneDefaultTitle")}`, () => focusEntity("scene", scene.id || `${index}`), "secondary small outline-link");
    const up = button("↑", () => moveScene(index, -1), "secondary small outline-move");
    const down = button("↓", () => moveScene(index, 1), "secondary small outline-move");
    up.title = t("moveUp");
    down.title = t("moveDown");
    up.disabled = index === 0;
    down.disabled = index === draft.scenes.length - 1;
    item.append(link, up, down);
    els.sceneOutline.append(item);
  });
}

function renderSimpleOutline(container, items, mapper) {
  container.replaceChildren();
  items.forEach((itemValue, index) => {
    const item = div("outline-item");
    const mapped = mapper(itemValue, index);
    const link = button(mapped.label, () => focusEntity(mapped.kind, mapped.id), "secondary small outline-link");
    link.title = t("openBlock");
    item.append(link);
    container.append(item);
  });
}

function renderProjectOutlineTree() {
  renderSimpleOutlineTree(els.variableOutline, draft.variables, (variable, index) => ({
    label: variable.name || `${t("variablePrefix")}_${index + 1}`,
    kind: "variable",
    id: variable.name || `${index}`,
    contextId: contextId("variable", index, variable.name || index),
  }));
  renderSimpleOutlineTree(els.assetOutline, draft.assets, (asset, index) => ({
    label: asset.id || `${t("assetPrefix")}_${index + 1}`,
    kind: "asset",
    id: asset.id || `${index}`,
    contextId: contextId("asset", index, asset.id || index),
  }));
  els.sceneOutline.replaceChildren();
  els.sceneOutline.classList.add("outline-tree");
  draft.scenes.forEach((scene, index) => {
    const branch = div("outline-branch");
    const item = div("outline-item");
    const link = outlineButton(
      `${index + 1}. ${scene.title || scene.id || t("sceneDefaultTitle")}`,
      contextId("scene", index, scene.id || index),
      0,
      () => focusEntity("scene", scene.id || `${index}`),
    );
    const up = button("↑", () => moveScene(index, -1), "secondary small outline-move");
    const down = button("↓", () => moveScene(index, 1), "secondary small outline-move");
    up.title = t("moveUp");
    down.title = t("moveDown");
    up.disabled = index === 0;
    down.disabled = index === draft.scenes.length - 1;
    item.append(link, up, down);
    branch.append(item, sceneOutlineChildren(scene, index));
    els.sceneOutline.append(branch);
  });
}

function renderSimpleOutlineTree(container, items, mapper) {
  container.replaceChildren();
  items.forEach((itemValue, index) => {
    const item = div("outline-item");
    const mapped = mapper(itemValue, index);
    item.append(outlineButton(mapped.label, mapped.contextId, 0, () => focusEntity(mapped.kind, mapped.id)));
    container.append(item);
  });
}

function sceneOutlineChildren(scene, sceneIndex) {
  const children = div("outline-children");
  children.append(outlineButton(t("sceneLocalVariables"), contextId("scene", sceneIndex, "variables"), 1));
  (scene.variables || []).forEach((variable, index) => {
    children.append(outlineButton(`${t("variableItem", { index: index + 1 })}: ${variable.name || `${t("variablePrefix")}_${index + 1}`}`, contextId("scene", sceneIndex, "variable", index, variable.name || index), 2));
  });
  children.append(outlineButton(t("sceneLocalAssets"), contextId("scene", sceneIndex, "assets"), 1));
  (scene.assets || []).forEach((asset, index) => {
    children.append(outlineButton(`${t("assetItem", { index: index + 1 })}: ${asset.id || `${t("assetPrefix")}_${index + 1}`}`, contextId("scene", sceneIndex, "asset", index, asset.id || index), 2));
  });
  children.append(outlineButton(t("sceneEffects"), contextId("scene", sceneIndex, "scene", "", "effects"), 1));
  (scene.effects || []).forEach((effect, index) => {
    children.append(outlineButton(`${t("effectItem", { index: index + 1 })}: ${effect.kind || "set"} ${effect.variable || ""}`, contextId("scene", sceneIndex, "scene", "", "effect", index), 2));
  });
  children.append(outlineButton(t("endingTitle"), contextId("scene", sceneIndex, "ending"), 1));
  children.append(outlineButton(t("choicesTitle"), contextId("scene", sceneIndex, "choices"), 1));
  (scene.choices || []).forEach((choice, choiceIndex) => {
    children.append(outlineButton(`${t("choiceItem", { index: choiceIndex + 1 })}: ${choice.label || choice.id || t("choiceDefaultLabel")}`, contextId("scene", sceneIndex, "choice", choiceIndex, choice.id || choiceIndex), 2));
    children.append(outlineButton(t("conditionsTitle"), contextId("scene", sceneIndex, "choice", choiceIndex, "conditions"), 2));
    (choice.conditions || []).forEach((condition, index) => {
      children.append(outlineButton(`${t("conditionItem", { index: index + 1 })}: ${condition.variable || ""} ${condition.op || "=="} ${condition.value ?? ""}`, contextId("scene", sceneIndex, "choice", choiceIndex, "condition", index), 2));
    });
    children.append(outlineButton(t("choiceEffects"), contextId("scene", sceneIndex, "choice", choiceIndex, "effects"), 2));
    (choice.effects || []).forEach((effect, index) => {
      children.append(outlineButton(`${t("effectItem", { index: index + 1 })}: ${effect.kind || "set"} ${effect.variable || ""}`, contextId("scene", sceneIndex, "choice", choiceIndex, "effect", index), 2));
    });
  });
  return children;
}

function outlineButton(label, targetContextId, depth = 0, fallback = null) {
  const link = button(label, (event) => {
    event.stopPropagation();
    focusContext(targetContextId, fallback);
  }, `secondary small outline-link depth-${depth}`);
  link.title = t("openBlock");
  link.dataset.outlineTarget = targetContextId;
  return link;
}

function renderProjectOutlineExplorer() {
  renderGlobalOutlineFolder(
    els.variableOutline,
    "global:variables",
    t("globalVariablesTitle"),
    draft.variables.map((variable, index) => ({
      label: variable.name || `${t("variablePrefix")}_${index + 1}`,
      kind: "variable",
      id: variable.name || `${index}`,
      contextId: contextId("variable", index, variable.name || index),
    })),
  );
  renderGlobalOutlineFolder(
    els.assetOutline,
    "global:assets",
    t("globalAssetsTitle"),
    draft.assets.map((asset, index) => ({
      label: asset.id || `${t("assetPrefix")}_${index + 1}`,
      kind: "asset",
      id: asset.id || `${index}`,
      contextId: contextId("asset", index, asset.id || index),
    })),
  );

  els.sceneOutline.replaceChildren();
  els.sceneOutline.classList.add("outline-tree");
  const scenesRoot = outlineFolder("scenes", true, t("scenePackagesTitle"), contextId("scene-root"), 0);
  draft.scenes.forEach((scene, sceneIndex) => {
    const label = `${sceneIndex + 1}. ${scene.title || scene.id || t("sceneDefaultTitle")}`;
    const folder = outlineFolder(`scene:${sceneIndex}:${scene.id || sceneIndex}`, true, label);
    folder.classList.add("has-outline-moves");
    const row = div("tree-row");
    row.append(
      outlineButton(label, contextId("scene", sceneIndex, scene.id || sceneIndex), 0, () => focusEntity("scene", scene.id || `${sceneIndex}`)),
      outlineMoveButton("↑", t("moveUp"), () => moveScene(sceneIndex, -1), sceneIndex === 0),
      outlineMoveButton("↓", t("moveDown"), () => moveScene(sceneIndex, 1), sceneIndex === draft.scenes.length - 1),
    );
    folder.querySelector(".outline-folder-tools").replaceChildren(row);
    appendOutlineContent(folder, explorerSceneChildren(scene, sceneIndex));
    appendOutlineContent(scenesRoot, folder);
  });
  els.sceneOutline.append(scenesRoot);
}

function renderGlobalOutlineFolder(container, key, label, items) {
  container.replaceChildren();
  container.classList.add("outline-tree");
  const folder = outlineFolder(key, true, label, items[0]?.contextId || "", 0);
  items.forEach((item) => {
    appendOutlineContent(folder, outlineLeaf(item.label, item.contextId, 1, () => focusEntity(item.kind, item.id)));
  });
  container.append(folder);
}

function explorerSceneChildren(scene, sceneIndex) {
  const children = div("outline-children");
  children.append(explorerFolderWithLeaves(
    `scene:${sceneIndex}:variables`,
    t("sceneLocalVariables"),
    contextId("scene", sceneIndex, "variables"),
    (scene.variables || []).map((variable, index) => ({
      label: `${t("variableItem", { index: index + 1 })}: ${variable.name || `${t("variablePrefix")}_${index + 1}`}`,
      context: contextId("scene", sceneIndex, "variable", index, variable.name || index),
    })),
  ));
  children.append(explorerFolderWithLeaves(
    `scene:${sceneIndex}:assets`,
    t("sceneLocalAssets"),
    contextId("scene", sceneIndex, "assets"),
    (scene.assets || []).map((asset, index) => ({
      label: `${t("assetItem", { index: index + 1 })}: ${asset.id || `${t("assetPrefix")}_${index + 1}`}`,
      context: contextId("scene", sceneIndex, "asset", index, asset.id || index),
    })),
  ));
  children.append(explorerFolderWithLeaves(
    `scene:${sceneIndex}:effects`,
    t("sceneEffects"),
    contextId("scene", sceneIndex, "scene", "", "effects"),
    (scene.effects || []).map((effect, index) => ({
      label: `${t("effectItem", { index: index + 1 })}: ${effect.kind || "set"} ${effect.variable || ""}`,
      context: contextId("scene", sceneIndex, "scene", "", "effect", index),
    })),
  ));
  children.append(outlineLeaf(t("endingTitle"), contextId("scene", sceneIndex, "ending"), 1));

  const choices = outlineFolder(`scene:${sceneIndex}:choices`, true, t("choicesTitle"), contextId("scene", sceneIndex, "choices"), 1);
  (scene.choices || []).forEach((choice, choiceIndex) => {
    const choiceFolder = outlineFolder(
      `scene:${sceneIndex}:choice:${choiceIndex}:${choice.id || choiceIndex}`,
      true,
      `${t("choiceItem", { index: choiceIndex + 1 })}: ${choice.label || choice.id || t("choiceDefaultLabel")}`,
      contextId("scene", sceneIndex, "choice", choiceIndex, choice.id || choiceIndex),
      2,
    );
    appendOutlineContent(choiceFolder, explorerFolderWithLeaves(
      `scene:${sceneIndex}:choice:${choiceIndex}:conditions`,
      t("conditionsTitle"),
      contextId("scene", sceneIndex, "choice", choiceIndex, "conditions"),
      (choice.conditions || []).map((condition, index) => ({
        label: `${t("conditionItem", { index: index + 1 })}: ${condition.variable || ""} ${condition.op || "=="} ${condition.value ?? ""}`,
        context: contextId("scene", sceneIndex, "choice", choiceIndex, "condition", index),
      })),
      2,
    ));
    appendOutlineContent(choiceFolder, explorerFolderWithLeaves(
      `scene:${sceneIndex}:choice:${choiceIndex}:effects`,
      t("choiceEffects"),
      contextId("scene", sceneIndex, "choice", choiceIndex, "effects"),
      (choice.effects || []).map((effect, index) => ({
        label: `${t("effectItem", { index: index + 1 })}: ${effect.kind || "set"} ${effect.variable || ""}`,
        context: contextId("scene", sceneIndex, "choice", choiceIndex, "effect", index),
      })),
      2,
    ));
    appendOutlineContent(choices, choiceFolder);
  });
  children.append(choices);
  return children;
}

function explorerFolderWithLeaves(key, label, targetContextId, leaves, depth = 1) {
  const folder = outlineFolder(key, false, label, targetContextId, depth);
  leaves.forEach((leaf) => appendOutlineContent(folder, outlineLeaf(leaf.label, leaf.context, Math.min(depth + 1, 2))));
  return folder;
}

function outlineFolder(key, defaultOpen = false, label = "", targetContextId = "", depth = 0) {
  const wrap = div("outline-folder");
  const folder = document.createElement("details");
  folder.className = "tree-folder";
  folder.open = outlineOpenState(key, defaultOpen);
  folder.ontoggle = () => saveOutlineOpenState(key, folder.open);
  const summary = document.createElement("summary");
  summary.setAttribute("aria-label", label);
  const caption = document.createElement("span");
  caption.className = `outline-link depth-${depth} outline-summary-caption`;
  caption.textContent = label;
  caption.setAttribute("aria-hidden", "true");
  summary.append(caption);
  const tools = div("outline-folder-tools");
  if (label) {
    tools.append(outlineButton(label, targetContextId, depth));
  }
  folder.append(summary);
  wrap.append(folder, tools);
  return wrap;
}

function appendOutlineContent(folder, content) {
  folder.querySelector(":scope > .tree-folder").append(content);
}

function outlineLeaf(label, targetContextId, depth = 0, fallback = null) {
  const row = div("tree-row");
  row.append(outlineButton(label, targetContextId, depth, fallback));
  return row;
}

function outlineMoveButton(label, title, onClick, disabled) {
  const control = button(label, (event) => {
    event.stopPropagation();
    onClick();
  }, "secondary small outline-move");
  control.title = title;
  control.setAttribute("aria-label", title);
  control.disabled = disabled;
  return control;
}

function sceneOrderControls(sceneIndex) {
  const row = div("actions tight scene-order");
  const up = button("↑ " + t("moveUp"), () => moveScene(sceneIndex, -1), "secondary small");
  const down = button("↓ " + t("moveDown"), () => moveScene(sceneIndex, 1), "secondary small");
  up.disabled = sceneIndex === 0;
  down.disabled = sceneIndex === draft.scenes.length - 1;
  row.append(up, down);
  return row;
}

function moveScene(index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= draft.scenes.length) return;
  const [scene] = draft.scenes.splice(index, 1);
  draft.scenes.splice(nextIndex, 0, scene);
  render({ preserveScroll: true });
}

function focusEntity(kind, id) {
  const target = document.querySelector(`[data-entity-kind="${cssEscape(kind)}"][data-entity-id="${cssEscape(id)}"]`);
  if (!target) return;
  if (target.tagName === "DETAILS") {
    target.open = true;
  }
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function focusContext(targetContextId, fallback = null) {
  const target = document.querySelector(`[data-context-id="${cssEscape(targetContextId)}"]`);
  if (!target) {
    fallback?.();
    return;
  }
  target.closest("details.collapsible-item")?.setAttribute("open", "");
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  setActiveContext(target);
}

async function openAuthorStory(storyId) {
  if (hasUnsavedChanges() && getDraftStoryId() && !confirm(t("switchUnsaved"))) return;
  const detail = await authorFetch(`/api/author/stories/${storyId}`);
  const parents = await authorFetch(`/api/author/collections/parents?scenarioId=${encodeURIComponent(storyId)}`);
  const url = new URL(location.href);
  chapterParent = parents.length ? await authorFetch(`/api/author/collections/${encodeURIComponent(parents[0].collectionId || parents[0].id)}`) : null;
  if (parents.length) url.searchParams.set("work", parents[0].collectionId || parents[0].id);
  else url.searchParams.delete("work");
  history.replaceState({}, "", url);
  const story = detail.draftDocument;
  fromStoryJson(story);
  bindDraftStory(storyId, JSON.stringify(toStoryJson()), detail.draftRevision);
  els.apiResult.textContent = "";
  renderAuthorWorkspace();
}

async function authorWorkflow(storyId, action, knownStory = null, alreadyBusy = false) {
  if (builderWorkflowBusy && !alreadyBusy) return;
  if (!["review", "withdraw", "archive"].includes(action)) throw new Error(t("authorRoleMissing"));
  builderWorkflowBusy = true; updateAuthorGate();
  try {
    const story = knownStory || authorHomeCache?.stories?.find(item => item.storyId === storyId) || await authorFetch(`/api/author/stories/${storyId}`);
    const replaceReview = action === "review" && story.reviewState === "in_review";
    if (replaceReview && !confirm(t("replaceReviewConfirm", { revision: story.submittedRevision }))) return null;
    if (action === "withdraw" && !confirm(t("withdrawConfirm", { title: story.title }))) return null;
    if (action === "archive" && !confirm(t("archiveConfirm", { title: story.title }))) return null;
    const payload = await authorFetch(`/api/author/stories/${storyId}/${action}`, {
      method: "POST", ...(["review", "withdraw"].includes(action) ? { body: JSON.stringify({ generation: story.generation, replaceReview }) } : {}),
    });
    if (action === "review") authorFilter = filterAfterSubmit(authorFilter);
    await loadAuthorHome();
    els.apiResult.textContent = action === "review" ? t("reviewSent", { revision: payload.submittedRevision }) : t("changeSaved");
    return payload;
  } catch (error) {
    if (error.status === 409) { await loadAuthorHome(); if(error.code!=="REVIEW_LIMIT_REACHED")throw new Error(t("staleStory")); }
    throw error;
  } finally { if (!alreadyBusy) { builderWorkflowBusy = false; updateAuthorGate(); } }
}

document.querySelector("#add-variable").onclick = () => {
  draft.variables.push({ name: `${t("variablePrefix")}_${draft.variables.length + 1}`, type: "string", value: "", showInStats: false });
  render();
};

document.querySelector("#add-asset").onclick = () => {
  draft.assets.push({ id: `${t("assetPrefix")}_${draft.assets.length + 1}`, type: "image", url: "", metadata: "" });
  render();
};

document.querySelector("#add-scene").onclick = addSceneAndFocus;
els.quickAddScene.onclick = addSceneAndFocus;

document.querySelector("#load-example").onclick = () => {
  draft = exampleDraft();
  render();
};

document.querySelector("#copy-json").onclick = async () => {
  await navigator.clipboard.writeText(JSON.stringify(toStoryJson(), null, 2));
};

document.querySelector("#download-json").onclick = () => {
  const blob = new Blob([JSON.stringify(toStoryJson(), null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${draft.key || t("storyFileName")}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
};

document.querySelector("#import-file").onchange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    fromStoryJson(JSON.parse(await file.text()));
    els.apiResult.textContent = "";
  } catch (error) {
    els.apiResult.textContent = t("invalidJson", { message: error.message });
  } finally {
    event.target.value = "";
  }
};

document.querySelector("#paste-json").onclick = () => {
  els.pasteArea.value = JSON.stringify(toStoryJson(), null, 2);
  els.pasteDialog.showModal();
};

document.querySelector("#apply-paste").onclick = () => {
  const errorMessage = document.querySelector("#paste-error");
  try {
    fromStoryJson(JSON.parse(els.pasteArea.value));
    errorMessage.textContent = "";
    els.pasteDialog.close();
  } catch (error) {
    errorMessage.textContent = t("invalidJson", { message: error.message });
  }
};

document.querySelector("#clear-draft").onclick = () => {
  removeLocalStorage(storageKey);
  draft = emptyDraft();
  render();
};

document.querySelector("#import-runtime").onclick = () => runtimeCall("import");
document.querySelector("#validate-runtime").onclick = () => { renderPreview(); els.apiResult.textContent = t('validationOk'); if (validateStory(toStoryJson()).length) els.apiResult.textContent = currentLanguage === 'en' ? 'Fix the listed errors.' : 'Исправьте перечисленные ошибки.'; };
document.querySelector('#preview-chapter').onclick = () => {
  const host = document.querySelector('#chapter-preview-content'); host.replaceChildren();
  for (const scene of toStoryJson().scenes) {
    const card = document.createElement('section');
    const title = document.createElement('h3'); title.textContent = scene.title || scene.id;
    const text = document.createElement('p'); text.className = 'chapter-prose'; text.textContent = scene.text;
    card.append(title, text);
    for (const choice of scene.choices) { const row = document.createElement('p'); row.textContent = `${choice.label} → ${choice.target}`; card.append(row); }
    host.append(card);
  }
  document.querySelector('#chapter-preview-dialog').showModal();
};
document.querySelector("#publish-runtime").onclick = () => runtimeCall("review");

async function importDraftToRuntime(base = els.runtimeUrl.value.replace(/\/$/, "")) {
  const importedDraft = draft;
  const importedKey = draft.key;
  const savedDocument = JSON.stringify(toStoryJson());
  const payload = await fetchJson(`${base}/api/author/stories/import`, {
    method: "POST",
    headers: {
      ...authorHeaders(true),
      Accept: "application/json",
    },
    body: savedDocument,
  });
  if (payload.storyId && draft === importedDraft && draft.key === importedKey && base === els.runtimeUrl.value.replace(/\/$/, "")) {
    bindDraftStory(payload.storyId, savedDocument, payload.draftRevision);
  }
  await loadAuthorHome();
  return payload;
}

async function runtimeCall(action) {
  if (builderWorkflowBusy) return;
  if (action === 'review' && validateStory(toStoryJson()).length) {
    renderPreview(); selectChapterTab('check', true);
    els.apiResult.textContent = currentLanguage === 'en' ? 'Fix the errors before submitting.' : 'Исправьте ошибки перед отправкой.';
    return;
  }
  builderWorkflowBusy = true; updateAuthorGate();
  try {
    const base = els.runtimeUrl.value.replace(/\/$/, "");
    if (canAuthor()) {
      let payload;
      if (action === "import") {
        payload = await importDraftToRuntime(base);
        els.apiResult.textContent = t("savedOnServer", { revision: payload.draftRevision });
        return;
      }
      if (action === "validate" || action === "review") {
        let storyId = getDraftStoryId();
        if (action === "review") {
          const submittingDraft = draft;
          const submittingKey = draft.key;
          const submittingDocument = JSON.stringify(toStoryJson());
          const imported = await importDraftToRuntime(base);
          if (draft !== submittingDraft || draft.key !== submittingKey || JSON.stringify(toStoryJson()) !== submittingDocument || base !== els.runtimeUrl.value.replace(/\/$/, "")) {
            throw new Error(t("draftChanged"));
          }
          const workId = new URLSearchParams(window.location.search).get("work");
          if (workId) {
            const parent = await authorFetch(`/api/author/collections/${encodeURIComponent(workId)}`);
            await authorFetch(`/api/author/collections/${encodeURIComponent(workId)}/chapters/review`, {method:"POST",body:JSON.stringify({storyId:imported.storyId,storyGeneration:imported.generation,generation:parent.generation,replaceReview:true})});
            els.apiResult.textContent = currentLanguage === "en" ? "Chapter submitted for review. Other drafts remain private." : "Глава отправлена на проверку. Остальные черновики остаются у вас.";
            await loadAuthorHome();
          } else await authorWorkflow(imported.storyId, "review", imported, true);
          return;
        }
        if (!storyId) throw new Error(t("importFirst"));
        payload = await fetchJson(`${base}/api/author/stories/${storyId}/${action}`, {
          method: "POST",
          headers: {
            ...authorHeaders(false),
            Accept: "application/json",
          },
        });
        els.apiResult.textContent = JSON.stringify(payload, null, 2);
        await loadAuthorHome();
        return;
      }
      return;
    }
    throw new Error(t("authorRoleMissing"));
  } catch (error) {
    els.apiResult.textContent = error.message;
  } finally {
    builderWorkflowBusy = false;
    updateAuthorGate();
  }
}

async function fetchJson(url, options) {
  return fetchJsonAttempt(url, options, true);
}

async function fetchJsonAttempt(url, options, allowRefresh) {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...options });
  if (response.status === 401 && allowRefresh) {
    const base = els.runtimeUrl.value.replace(/\/$/, "");
    await refreshAuth(base);
    return fetchJsonAttempt(url, options, false);
  }
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(payload.code === "REVIEW_LIMIT_REACHED" ? reviewLimitMessage(currentLanguage) : payload.message || payload.detail || payload.error || `HTTP ${response.status}`);
    error.status = response.status; error.code = payload.code;
    throw error;
  }
  return payload;
}

els.langRu.onclick = () => setLanguage("ru");
els.langEn.onclick = () => setLanguage("en");
els.scrollTop.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
els.scrollBottom.onclick = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
els.authorLogin.onclick = () => loginAuthor().catch((error) => {
  els.authorState.textContent = error.message;
});
els.authorLogout.onclick = () => {
  authorFetch("/auth/logout", { method: "POST" }).catch(() => {}).finally(() => {
    saveAuthorSession(null);

  });
};
els.authorName.value = authorSession?.email || "";

window.addEventListener("hashchange", () => {
  lastAppliedHash = "";
  applyHashFocus();
});

function updateScrollTopButton() {
  els.scrollTop.classList.toggle("is-visible", window.scrollY > 420);
}

window.addEventListener("scroll", updateScrollTopButton, { passive: true });
updateScrollTopButton();

render();
bootstrapAuth().catch(() => {
  saveAuthorSession(null);
  renderAuthorWorkspace();
});

function hasRole(role) {
  return Array.isArray(authorSession?.roles) && authorSession.roles.includes(role);
}

function canAuthor() {
  return canEditStories(authorSession);
}

async function bootstrapAuth() {
  const params = new URLSearchParams(window.location.search);
  const authToken = params.get("auth_token");
  if (authToken) {
    const result = await authorFetch("/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: authToken }),
    });
    saveAuthorSession(result.user);
    params.delete("auth_token");
    params.delete("redirect");
    const query = params.toString();
    window.history.replaceState(
      {},
      document.title,
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
    );
    await loadAuthorHome();
    return;
  }
  const user = await authorFetch("/auth/me");
  saveAuthorSession(user);
  await loadAuthorHome();
  const requestedStory = params.get("story");
  if (requestedStory && canAuthor()) {
    params.delete("story");
    window.history.replaceState({}, document.title, `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`);
    await openAuthorStory(requestedStory);
  }
}
