import { fetchWithSession } from "../auth-session.js?v=1";
import { validateStory as validateStoryDocument } from "./core.js?v=2";
import { canEditStories, canEditStoryDraft, publishedCorrectionNotice, filterAfterSubmit, storyLabels, workflowLabel } from "../story-workflow.js?v=3";
import { reviewLimitMessage } from "../review-limit.js?v=2";
import { decorateHelp, helpButton, helpTopics } from "./help.js?v=8";
import {createStoryPicker} from './story-picker.js?v=3';
import { chooseCover } from "../author-cover.js?v=3";
import { prepareImage } from "../image-preparation.js?v=1";
import { readingPreview, addChoiceReadingHint } from "./reading-preview.js?v=1";

import { initChapterTabs } from "./chapter-panel.js?v=1";
import { genres, topics, fillClassification } from "./genre-topic.js?v=1";
const selectChapterTab = initChapterTabs(document.querySelector("#chapter-workspace"));
let chapterParent = null;
const storyPicker=createStoryPicker({request:authorFetch,state:()=>({id:getDraftStoryId(),parent:chapterParent,language:currentLanguage,readOnly:publishedView(),canEdit:canAuthor(),unsaved:hasUnsavedChanges()}),save:()=>importDraftToRuntime()});
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
  metadataOutline: document.querySelector("#metadata-outline"),
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
    loadExample: "Открыть пример главы",
    copyJson: "Копировать JSON главы",
    downloadJson: "Скачать JSON главы",
    importJsonFile: "Импорт JSON главы",
    pasteJson: "Вставить JSON главы",
    homeLink: "На главную",
    myStories: "Мои истории",
    replaceDraft: "Заменить открытый черновик? Сначала скачайте JSON, если хотите сохранить текущие изменения. Серверная версия не изменится до сохранения.",
    packageInChapter: "Это пакет целой истории. Импортируйте его в разделе «Мои истории» → «Импорт истории». Текущая глава не изменена.",
    draftSaveConflict: "Глава изменилась в другой вкладке или её версия устарела. Ваши изменения остались здесь и не перезаписали сервер. Скачайте JSON главы для переноса правок, затем откройте актуальную версию.",
    reloadServerDraft: "Открыть актуальную версию",
    clearDraft: "Очистить черновик",
    localDraftSaveFailed: "Не удалось сохранить черновик на этом устройстве. Изменения остаются в открытой вкладке. Скачайте JSON или сохраните главу на сервере перед закрытием.",
    backToSite: "На главную",
    invalidJson: "Не удалось открыть JSON: {message}",
    draftChanged: "История или сервер изменились во время операции. Действие остановлено; повторите его для нужной истории.",
    storyMetadata: "Настройки главы",
    keyLabel: "Ключ",
    sceneKeyLabel: "Ключ сцены",
    toolbarLabel: "Действия с главой",
    chooseCover: "Выбрать обложку",
    coverHint: "Обложка показывается на карточке истории. Сохраните главу после выбора.",
    chapterCoverHint: "Обложку всей истории можно изменить в «Моих историях». Здесь выбирается обложка этой главы.",
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
    savedOnServer: "Сохранено на сервере",
    changeSaved: "Изменение сохранено.",
    reviewSent: "Глава отправлена на модерацию. Публикация не меняется.",
    replaceReviewConfirm: "Заменить заявку новым сохранённым черновиком? Старую заявку больше нельзя будет одобрить.",
    staleStory: "История изменилась. Список обновлён: проверьте текущую редакцию и повторите действие.",
    withdrawConfirm: "Отозвать заявку «{title}»? Черновик и предыдущая публикация сохранятся.",
    archiveConfirm: "Архивировать «{title}»? История станет недоступна читателям. Данные и прогресс сохранятся.",
    switchUnsaved: "В текущей истории есть изменения только в этом браузере. Открыть другую историю и заменить их?",
    leaveChapterUnsaved: "Изменения главы ещё не сохранены на сервере. Вернуться к списку глав без сохранения?",
    validationTitle: "Проверка",
    storyJsonTitle: "JSON главы",
    pasteStoryJson: "Вставить JSON главы",
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
    loadExample: "Open chapter example",
    copyJson: "Copy chapter JSON",
    downloadJson: "Download chapter JSON",
    importJsonFile: "Import chapter JSON",
    pasteJson: "Paste chapter JSON",
    homeLink: "Home",
    myStories: "My stories",
    replaceDraft: "Replace the open draft? Download its JSON first if you want to keep your current changes. The server version will not change until you save.",
    packageInChapter: "This is a complete story package. Import it in My stories → Import story. The current chapter has not changed.",
    draftSaveConflict: "The chapter changed in another tab or this version is outdated. Your edits remain here and have not overwritten the server. Download chapter JSON to preserve your changes, then open the current version.",
    reloadServerDraft: "Open current version",
    clearDraft: "Clear draft",
    localDraftSaveFailed: "The draft could not be saved on this device. Your changes remain in this tab. Download JSON or save the chapter to the server before closing it.",
    backToSite: "Home",
    invalidJson: "Could not open JSON: {message}",
    draftChanged: "The story or server changed during the operation. It was stopped; retry for the intended story.",
    storyMetadata: "Chapter settings",
    keyLabel: "Key",
    sceneKeyLabel: "Scene key",
    toolbarLabel: "Chapter actions",
    chooseCover: "Choose cover",
    coverHint: "The cover appears on the story card. Save the chapter after choosing it.",
    chapterCoverHint: "Change the whole story cover in My stories. This cover belongs to the current chapter.",
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
    savedOnServer: "Saved on server",
    changeSaved: "Change saved.",
    reviewSent: "Chapter submitted for review. Publication is unchanged.",
    replaceReviewConfirm: "Replace the submission with the new saved draft? The old submission can no longer be approved.",
    staleStory: "The story changed. The list has been refreshed: inspect the current revision and try again.",
    withdrawConfirm: "Withdraw submission for “{title}”? The draft and previous publication are retained.",
    archiveConfirm: "Archive “{title}”? Readers will lose access. Data and progress are retained.",
    switchUnsaved: "The current story has changes stored only in this browser. Open another story and replace them?",
    leaveChapterUnsaved: "Chapter changes have not been saved to the server. Return to the chapter list without saving?",
    validationTitle: "Validation",
    storyJsonTitle: "Chapter JSON",
    pasteStoryJson: "Paste chapter JSON",
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
    pendingKey: true,
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
    pendingKey: true,
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
  const section = document.querySelector("#story-metadata");
  annotateContext(section, { id: "metadata", kind: t("builderTitle"), title: t("storyMetadata"), subtitle: draft.title });
  document.querySelector("[data-toolbar]").setAttribute("aria-label", t("toolbarLabel"));
  const cover = document.querySelector("#builder-cover-preview");
  cover.hidden = !draft.metadata?.coverUrl;
  if (draft.metadata?.coverUrl) cover.src = draft.metadata.coverUrl;
  else cover.removeAttribute("src");
  document.querySelector('[data-i18n="coverHint"]').textContent = t(chapterParent ? "chapterCoverHint" : "coverHint");
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

function ensureDraftKey() {
  if (!draft.pendingKey || getDraftStoryId()) return;
  draft.key = `story_${crypto.randomUUID().replaceAll("-", "")}`;
  draft.pendingKey = false;
  saveDraft();
}

function exportStoryJson() {
  ensureDraftKey();
  return toStoryJson();
}

async function openCoverPicker() {
  const coverDraft = draft;
  const base = els.runtimeUrl.value.replace(/\/$/, "");
  const current = () => draft === coverDraft && els.runtimeUrl.value.replace(/\/$/, "") === base;
  await chooseCover({
    url: draft.metadata?.coverUrl || "",
    onSelect(url) {
      if (!current()) { els.apiResult.textContent = t("draftChanged"); return; }
      draft.metadata = { ...(draft.metadata || {}), schemaVersion: draft.metadata?.schemaVersion ?? 1, coverUrl: url };
      render({ preserveScroll: true });
    },
    async upload(file) {
      if (!current()) throw new Error(t("draftChanged"));
      const asset = { id: uniqueDraftAssetId("cover"), type: "image", url: "", metadata: "" };
      const result = await uploadAssetFile(asset, file, "local", { saveDocument: false, purpose: "cover", prepared: true });
      if (!current()) throw new Error(t("draftChanged"));
      return result?.url || null;
    },
    getImages: async () => coverDraft.assets.filter(asset => asset.type === "image" && asset.url),
  });
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
      field(t("sceneKeyLabel"), input(scene.id, (value) => renameScene(scene, value))),
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
      choiceReadingField(choice),
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
    ageRating: draft.ageRating || null,
    contentWarnings: draft.contentWarnings || null,
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
  return validateStoryDocument(story, currentLanguage);
}

function fromStoryJson(story) {
  if (story?.kind === 'fraerapp-work-package') throw new Error(t('packageInChapter'));
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
  const previousBinding = story.key === draft.key ? draft.runtimeStory : null;
  draft = {
    key: story.key || t("newStoryKey"),
    pendingKey: !story.key,
    title: story.title || t("newStoryTitle"),
    description: story.description || "",
    genre: story.genre || "",
    topic: story.topic || "",
    ageRating: story.ageRating || null,
    contentWarnings: story.contentWarnings || null,
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
  if (previousBinding) draft.runtimeStory = previousBinding;
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
  wrap.append(label, control, tools, readingPreview(control, () => currentLanguage));
  return wrap;
}

function choiceReadingField(choice) {
  const control = input(choice.label, value => (choice.label = value));
  return addChoiceReadingHint(field(t('labelLabel'), control), control, () => currentLanguage);
}

function insertTextAtCursor(control, text) {
  const start = control.selectionStart ?? control.value.length;
  const end = control.selectionEnd ?? control.value.length;
  control.value = `${control.value.slice(0, start)}${text}${control.value.slice(end)}`;
  const nextPosition = start + text.length;
  control.setSelectionRange(nextPosition, nextPosition);
  control.dispatchEvent(new Event('input', { bubbles: true }));
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
      if (!await uploadAssetFile(asset, file, scene ? "local" : "global")) return;
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
    try {
      if (!await uploadAssetFile(asset, file, "local", { saveDocument: false })) return;
      scene.assets ||= [];
      scene.assets.push(asset);
      scene[targetField] = asset.id;
      render({ preserveScroll: true });
      await importDraftToRuntime();
    } catch (error) {
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
  // Removing a reference is a draft edit. Persist it with the same generation
  // check as text changes; immutable media bytes remain available to old saves.
  render();
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

function getDraftStoryId() {
  const binding = draft.runtimeStory;
  return binding?.key === draft.key && binding.base === els.runtimeUrl.value.replace(/\/$/, "")
    ? binding.storyId : null;
}

function bindDraftStory(storyId, savedDocument = null, revision = null, generation = null) {
  draft.runtimeStory = { storyId, key: draft.key, base: els.runtimeUrl.value.replace(/\/$/, ""), savedDocument, revision, generation };
  saveDraft();
}

function saveDraft() {
  if(publishedView())return;
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
  const response = await fetchWithSession(`${base}${path}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...authorHeaders(Boolean(options.body)),
      ...(options.headers || {}),
    },
    credentials: "include",
    cache: "no-store",
    body: options.body,
  }, { base, refresh: allowRefresh });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(["REVIEW_LIMIT_REACHED", "REVIEW_DAILY_LIMIT_REACHED"].includes(payload.code) ? reviewLimitMessage(currentLanguage, payload) : payload.message || payload.detail || payload.error || `HTTP ${response.status}`);
    error.status = response.status; error.code = payload.code;
    throw error;
  }
  return payload;
}

async function uploadAssetFile(asset, file, scope = "global", { saveDocument = true, purpose = "scene", prepared: alreadyPrepared = false } = {}) {
  if (!canAuthor()) {
    throw new Error(t("uploadAssetFirst"));
  }
  const uploadDraft = draft;
  const base = els.runtimeUrl.value.replace(/\/$/, "");
  const prepared = alreadyPrepared ? file : await prepareImage(file, { purpose });
  if (!prepared) return null;
  if (draft !== uploadDraft || base !== els.runtimeUrl.value.replace(/\/$/, "")) throw new Error(t("draftChanged"));
  ensureDraftKey();
  const uploadKey = draft.key;
  const uploadType = { type: asset.type };
  applyAssetTypeFromFile(uploadType, prepared);
  if (!getDraftStoryId()) {
    await importDraftToRuntime();
  }
  const storyId = getDraftStoryId();
  if (draft !== uploadDraft || draft.key !== uploadKey || base !== els.runtimeUrl.value.replace(/\/$/, "")) throw new Error(t("draftChanged"));
  if (!storyId) {
    throw new Error(t("uploadAssetFirst"));
  }
  const form = new FormData();
  form.append("file", prepared);
  if (asset.id) {
    form.append("assetKey", asset.id);
  }
  if (uploadType.type) {
    form.append("type", uploadType.type);
  }
  // Store bytes without modifying the server document. Both global and local
  // references are then saved atomically with the bound document generation.
  form.append("scope", "local");
  const payload = await fetchJson(`${base}/api/author/stories/${storyId}/assets`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...authorHeaders(false),
    },
    body: form,
  });
  if (draft !== uploadDraft || draft.key !== uploadKey || base !== els.runtimeUrl.value.replace(/\/$/, "")) throw new Error(t("draftChanged"));
  asset.id = payload.id;
  asset.type = payload.type;
  asset.url = payload.url;
  const metadata = payload.metadata ? { ...payload.metadata } : null;
  if (metadata && scope !== "local") delete metadata.scope;
  asset.metadata = metadata ? JSON.stringify(metadata, null, 2) : "";
  if (draft !== uploadDraft || draft.key !== uploadKey || base !== els.runtimeUrl.value.replace(/\/$/, "")) throw new Error(t("draftChanged"));
  if (saveDocument) {
    renderPreview();
    saveDraft();
    await importDraftToRuntime();
  }
  els.apiResult.textContent = t("uploadAssetDone", { id: payload.id });
  return payload;
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
  storyPicker.refresh().catch(error=>{els.apiResult.textContent=error.message;});
  return home;
}

window.addEventListener("focus",()=>{
  if(canAuthor()&&!builderWorkflowBusy)loadAuthorHome().catch(()=>{});
});

const panelWords = {
  moderatorComment: ['Комментарий модератора', 'Moderator comment'],
  chapter: ['Мои истории', 'My stories'], check: ['Проверка', 'Validation'], publication: ['Публикация', 'Publication'],
  save: ['Сохранить главу', 'Save chapter'], preview: ['Просмотр сцен', 'Scene preview'], close: ['Закрыть', 'Close'],
  checkAgain: ['Проверить ещё раз', 'Check again'], submit: ['Отправить на модерацию', 'Submit for moderation'],
  saveHint: ['Сохранённая на сервере глава доступна с других устройств.', 'A chapter saved on the server is available on other devices.'],
  checkHint: ['Проверяем текущий JSON: сцены, переменные и переходы. Изменения сохранять не обязательно.', 'Check the current JSON: scenes, variables and transitions. Saving is not required.'],
  checkNote: ['Это проверка структуры, а не литературного текста. Полная серверная проверка выполняется перед отправкой модератору.', 'This checks structure, not literary quality. Full server validation runs before submission.'],
  publicationHint: ['После одобрения модератором вы сможете опубликовать главу.', 'After moderator approval, you can publish the chapter.'],
  submitHint: ['Перед отправкой проверим главу и сохраним изменения. На модерацию можно отправлять одну историю в сутки.', 'We will check and save the chapter. You can submit one story per day.'],
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
  if(current?.publishedRevision)document.querySelector('[data-panel-text="publicationHint"]').textContent=en
    ? 'The published version remains unchanged. Readers will see the correction after review and publication.'
    : 'Опубликованная версия остаётся без изменений. Читатели увидят исправление после проверки и публикации.';
  if(current?.reviewLimitReached || current?.reviewDailyLimitReached)document.querySelector('[data-panel-text="submitHint"]').textContent=reviewLimitMessage(currentLanguage, current);
  const items = chapterParent?.draftDocument?.items || [];
  const index = items.findIndex(item => item.target.id === getDraftStoryId());
  const parentId = chapterParent?.collectionId || chapterParent?.id;
  const parentLink = document.querySelector('.builder-home');
  parentLink.href = '/';
  parentLink.querySelector('span').textContent = en ? 'Home' : 'На главную';
  parentLink.onclick = event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (hasUnsavedChanges() && !confirm(t('leaveChapterUnsaved'))) event.preventDefault();
  };
  document.querySelector('#chapter-story-name').textContent = chapterParent?.title || chapterParent?.draftDocument?.title || (en ? 'Independent draft' : 'Отдельный черновик');
  document.querySelector('#chapter-number').textContent = index < 0 ? '' : [items[index].season, `${en ? 'Chapter' : 'Глава'} ${index + 1}`].filter(Boolean).join(' · ');
  document.querySelector('#chapter-title').textContent = draft.title || draft.key;
  const simpleStatus = !current ? (en ? 'Draft' : 'Черновик') : [current.publishedRevision ? (en ? 'Published' : 'Опубликована') : (en ? 'Not published' : 'Не опубликована'), ({draft:en?'Draft':'Черновик',in_review:en?'Under review':'На модерации',rejected:en?'Changes requested':'Нужны исправления',approved:en?'Review passed':'Модерация пройдена'})[current.reviewState]].filter(Boolean).join(' · ');
  document.querySelector('#chapter-status').textContent = publishedView() ? (en ? 'Published · View only' : 'Опубликована · Только просмотр') : simpleStatus;
  document.querySelector('#chapter-publication-status').textContent = current?.reviewState === 'in_review'
    ? (en ? 'Under review' : 'На модерации')
    : current?.publishedRevision && (hasUnsavedChanges() || current.draftRevision !== current.publishedRevision)
      ? (en ? 'Unpublished changes' : 'Есть неопубликованные изменения')
      : simpleStatus;
  const revisionNote = document.querySelector('#chapter-revision-note');
  revisionNote.hidden = !(current?.reviewState === 'rejected' && current.submittedRevision && current.draftRevision > current.submittedRevision);
  revisionNote.textContent = en ? 'The feedback concerns a previous revision. You have saved changes since the review.' : 'Замечания относятся к предыдущей редакции. После проверки вы сохранили изменения.';
  const comment = document.querySelector('#chapter-review-comment');
  const feedback = document.querySelector('#chapter-review-feedback');
  const commentText = [...new Set([current?.correctionReason,current?.reason,...(current?.events||[]).filter(e=>['reject','request-correction'].includes(e.action)).map(e=>e.reason)].filter(Boolean))].join('\n\n');
  const commentKey = `${getDraftStoryId() || ''}:${commentText}`;
  if (feedback.dataset.commentKey !== commentKey) feedback.open = false;
  feedback.dataset.commentKey = commentKey;
  comment.textContent = commentText;
  feedback.hidden = !commentText;
  storyPicker.update();
  const editNotice=document.querySelector('#chapter-edit-notice');
  editNotice.textContent=publishedView() ? (en ? 'You can inspect scenes, transitions and effects. Editing and saving are unavailable.' : 'Можно просматривать сцены, переходы и эффекты. Изменение и сохранение недоступны.') : publishedCorrectionNotice(current,currentLanguage);
  editNotice.hidden=!editNotice.textContent;
  els.authorState.textContent = canAuthor() ? '' : (authorSession ? t('authorRoleMissing') : t('authorLoggedOut'));
  els.authorState.hidden = canAuthor();
  updateServerDraftState();
  updateAuthorGate();
}

function statusLabel(status) {
  const key = `status${String(status || "draft").replace(/^\w/, (char) => char.toUpperCase())}`;
  return t(key);
}

function publishedView() {
  return new URLSearchParams(location.search).get('view') === 'published';
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
    if(control.hasAttribute('data-builder-navigation'))return;
    if (control === els.authorLogout) {
      control.disabled = !loggedIn;
      return;
    }
    if (allowed) {
      control.disabled = false;
      return;
    }
    control.disabled = !loggedIn || (builderWorkflowBusy && (control.dataset.authorMutation === "true" || ["import-runtime", "validate-runtime", "publish-runtime", "author-story-select", "refresh-author", "runtime-url"].includes(control.id)));
    if((publishedView()||(current&&!canEditStoryDraft(current)))&&!control.matches('.outline-link,.collection-toolbar button')&&!['preview-chapter','copy-json','download-json','validate-runtime','refresh-author','scroll-top','scroll-bottom'].includes(control.id))control.disabled=true;
    if(control.id==='publish-runtime'&&(current?.reviewLimitReached || current?.reviewDailyLimitReached))control.disabled=true;
  });
  document.querySelectorAll("a.nav-link").forEach((link) => {
    link.classList.toggle("is-disabled", !loggedIn||publishedView());
    link.setAttribute("aria-disabled", String(!loggedIn||publishedView()));
    link.onclick=event=>{if(!loggedIn||publishedView())event.preventDefault();};
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
  els.metadataOutline.replaceChildren(outlineLeaf(t("storyMetadata"), "metadata"));
  els.variableOutline.closest(".project-group").hidden = draft.variables.length === 0;
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
  let confirmedNavigation=false;
  try{confirmedNavigation=sessionStorage.getItem('fraerapp.builderNavigation')===storyId;sessionStorage.removeItem('fraerapp.builderNavigation');}catch{}
  if (!confirmedNavigation && hasUnsavedChanges() && getDraftStoryId() && !confirm(t("switchUnsaved"))) return;
  const detail = await authorFetch(`/api/author/stories/${storyId}`);
  const parents = await authorFetch(`/api/author/collections/parents?scenarioId=${encodeURIComponent(storyId)}`);
  const url = new URL(location.href);
  chapterParent = parents.length ? await authorFetch(`/api/author/collections/${encodeURIComponent(parents[0].collectionId || parents[0].id)}`) : null;
  if (parents.length) url.searchParams.set("work", parents[0].collectionId || parents[0].id);
  else url.searchParams.delete("work");
  history.replaceState({}, "", url);
  const story = publishedView() ? detail.publishedDocument : detail.draftDocument;
  if(!story)throw new Error(currentLanguage==='en'?'Published chapter is unavailable.':'Опубликованная глава недоступна.');
  authorHomeCache={...authorHomeCache,stories:[...(authorHomeCache?.stories||[]).filter(item=>item.storyId!==storyId),detail]};
  fromStoryJson(story);
  bindDraftStory(storyId, JSON.stringify(toStoryJson()), detail.draftRevision, detail.generation);
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
    acceptOwnGeneration(payload);
    if (action === "review") authorFilter = filterAfterSubmit(authorFilter);
    await loadAuthorHome();
    els.apiResult.textContent = action === "review" ? t("reviewSent", { revision: payload.submittedRevision }) : t("changeSaved");
    return payload;
  } catch (error) {
    if (error.status === 409) { await loadAuthorHome(); if(!["REVIEW_LIMIT_REACHED", "REVIEW_DAILY_LIMIT_REACHED"].includes(error.code))throw new Error(t("staleStory")); }
    throw error;
  } finally { if (!alreadyBusy) { builderWorkflowBusy = false; updateAuthorGate(); } }
}

function acceptOwnGeneration(summary) {
  const binding = draft.runtimeStory;
  if (!summary || summary.storyId !== getDraftStoryId() || !Number.isInteger(summary.generation)
    || summary.draftRevision !== binding?.revision) return;
  // Only the receipt of our successful command can advance the saved base.
  // A refreshed list may describe someone else's changes and is not sufficient.
  binding.generation = summary.generation;
  saveDraft();
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
  if (!confirm(t('replaceDraft'))) return;
  chapterParent = null;
  draft = exampleDraft();
  render();
};

document.querySelector("#copy-json").onclick = async () => {
  const text = JSON.stringify(exportStoryJson(), null, 2);
  try { await navigator.clipboard.writeText(text); }
  catch { els.pasteArea.value = text; els.pasteDialog.showModal(); els.pasteArea.focus(); els.pasteArea.select(); els.pasteArea.setSelectionRange(0, text.length); }
};


document.querySelector("#download-json").onclick = () => {
  const blob = new Blob([JSON.stringify(exportStoryJson(), null, 2)], { type: "application/json" });
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
    const value = JSON.parse(await file.text());
    if (value?.kind === 'fraerapp-work-package') throw new Error(t('packageInChapter'));
    if (!confirm(t('replaceDraft'))) return;
    fromStoryJson(value);
    els.apiResult.textContent = "";
  } catch (error) {
    els.apiResult.textContent = t("invalidJson", { message: error.message });
  } finally {
    event.target.value = "";
  }
};

document.querySelector("#paste-json").onclick = () => {
  els.pasteArea.value = JSON.stringify(exportStoryJson(), null, 2);
  els.pasteDialog.showModal();
};

document.querySelector("#apply-paste").onclick = () => {
  const errorMessage = document.querySelector("#paste-error");
  try {
    const value = JSON.parse(els.pasteArea.value);
    if (value?.kind === 'fraerapp-work-package') throw new Error(t('packageInChapter'));
    if (!confirm(t('replaceDraft'))) return;
    fromStoryJson(value);
    errorMessage.textContent = "";
    els.pasteDialog.close();
  } catch (error) {
    errorMessage.textContent = t("invalidJson", { message: error.message });
  }
};

document.querySelector("#clear-draft").onclick = () => {
  if (!confirm(t('replaceDraft'))) return;
  removeLocalStorage(storageKey);
  chapterParent = null;
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
document.querySelector("#choose-story-cover").onclick = () => openCoverPicker().catch(error => { els.apiResult.textContent = error.message; });

async function importDraftToRuntime(base = els.runtimeUrl.value.replace(/\/$/, "")) {
  if(publishedView())throw new Error(currentLanguage==='en'?'Published chapter is read-only.':'Опубликованная глава доступна только для просмотра.');
  ensureDraftKey();
  const importedDraft = draft;
  const importedKey = draft.key;
  const savedDocument = JSON.stringify(toStoryJson());
  const storyId = getDraftStoryId();
  const generation = draft.runtimeStory?.generation;
  if (storyId && !Number.isInteger(generation)) {
    throw Object.assign(new Error(t('draftSaveConflict')), { status: 409, code: 'DRAFT_GENERATION_REQUIRED' });
  }
  let payload;
  try {
    payload = await fetchJson(storyId ? `${base}/api/author/stories/${encodeURIComponent(storyId)}` : `${base}/api/author/stories/import`, {
      method: storyId ? "PUT" : "POST",
      headers: { ...authorHeaders(true), Accept: "application/json" },
      body: storyId ? JSON.stringify({ generation, document: JSON.parse(savedDocument) }) : savedDocument,
    });
  } catch (error) {
    if (storyId && error.status === 409) error.code = 'DRAFT_SAVE_CONFLICT';
    throw error;
  }
  if (payload.storyId && draft === importedDraft && draft.key === importedKey && base === els.runtimeUrl.value.replace(/\/$/, "")) {
    bindDraftStory(payload.storyId, savedDocument, payload.draftRevision, payload.generation);
  }
  await loadAuthorHome();
  return payload;
}

function showDraftSaveConflict() {
  els.apiResult.replaceChildren();
  const message = document.createElement('span'); message.textContent = t('draftSaveConflict');
  const reload = document.createElement('button'); reload.type = 'button'; reload.className = 'secondary'; reload.textContent = t('reloadServerDraft');
  reload.onclick = async () => {
    const id = getDraftStoryId(); if (!id) return;
    reload.disabled = true;
    try { await openAuthorStory(id); }
    catch (error) { message.textContent = error.message; }
    finally { reload.disabled = false; }
  };
  els.apiResult.append(message, document.createElement('br'), reload);
}

async function runtimeCall(action) {
  if(publishedView())return;
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
          ensureDraftKey();
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
            const submitted = await authorFetch(`/api/author/collections/${encodeURIComponent(workId)}/chapters/review`, {method:"POST",body:JSON.stringify({storyId:imported.storyId,storyGeneration:imported.generation,generation:parent.generation,replaceReview:true})});
            for (const item of submitted.items || []) acceptOwnGeneration(item);
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
    if (['DRAFT_SAVE_CONFLICT', 'DRAFT_GENERATION_REQUIRED'].includes(error.code)) showDraftSaveConflict();
    else els.apiResult.textContent = error.message;
  } finally {
    builderWorkflowBusy = false;
    updateAuthorGate();
  }
}

async function fetchJson(url, options) {
  return fetchJsonAttempt(url, options, true);
}

async function fetchJsonAttempt(url, options, allowRefresh) {
  // Use the initiating request's runtime even if the runtime field changes
  // while an upload/save is pending.
  const base = new URL(url, window.location.href).origin;
  const response = await fetchWithSession(url, { credentials: "include", cache: "no-store", ...options }, { base, refresh: allowRefresh });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(["REVIEW_LIMIT_REACHED", "REVIEW_DAILY_LIMIT_REACHED"].includes(payload.code) ? reviewLimitMessage(currentLanguage, payload) : payload.message || payload.detail || payload.error || `HTTP ${response.status}`);
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
