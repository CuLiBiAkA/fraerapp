const els = {
  runtimeUrl: document.querySelector("#runtime-url"),
  adminToken: document.querySelector("#admin-token"),
  meta: [...document.querySelectorAll("[data-meta]")],
  variables: document.querySelector("#variables"),
  assets: document.querySelector("#assets"),
  scenes: document.querySelector("#scenes"),
  jsonPreview: document.querySelector("#json-preview"),
  validation: document.querySelector("#validation"),
  apiResult: document.querySelector("#api-result"),
  pasteDialog: document.querySelector("#paste-dialog"),
  pasteArea: document.querySelector("#paste-area"),
  authorName: document.querySelector("#author-name"),
  authorLogin: document.querySelector("#author-login"),
  authorLogout: document.querySelector("#author-logout"),
  refreshAuthor: document.querySelector("#refresh-author"),
  authorState: document.querySelector("#author-state"),
  authorStories: document.querySelector("#author-stories"),
  authorAnalytics: document.querySelector("#author-analytics"),
  langRu: document.querySelector("#lang-ru"),
  langEn: document.querySelector("#lang-en"),
};

const translations = {
  ru: {
    pageTitle: "FraerApp - Конструктор историй",
    builderTitle: "Конструктор историй",
    runtimeApiLabel: "API рантайма",
    adminTokenLabel: "Токен администратора",
    loadExample: "Загрузить пример",
    copyJson: "Копировать JSON",
    downloadJson: "Скачать JSON",
    importJsonFile: "Импорт JSON-файла",
    pasteJson: "Вставить JSON",
    clearDraft: "Очистить черновик",
    storyMetadata: "Метаданные истории",
    keyLabel: "Ключ",
    titleLabel: "Название",
    versionLabel: "Версия",
    startSceneLabel: "Стартовая сцена",
    descriptionLabel: "Описание",
    variablesTitle: "Переменные",
    addVariable: "Добавить переменную",
    assetsTitle: "Ассеты",
    addAsset: "Добавить ассет",
    scenesTitle: "Сцены",
    addScene: "Добавить сцену",
    runtimeActions: "Действия с runtime",
    importToRuntime: "Импортировать в Runtime",
    validateLastImport: "Проверить последний импорт",
    publishLastImport: "Опубликовать последний импорт",
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
    assetItem: "Ассет {index}",
    sceneItem: "Сцена {index}: {name}",
    newSceneFallback: "new_scene",
    choiceItem: "Выбор {index}",
    conditionItem: "Условие {index}",
    effectItem: "Эффект {index}",
    sceneEffects: "Эффекты сцены",
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
    idLabel: "Id",
    urlLabel: "URL",
    metadataJsonLabel: "JSON метаданных",
    textLabel: "Текст",
    backgroundLabel: "Фон",
    musicLabel: "Музыка",
    animationLabel: "Анимация",
    animationDurationLabel: "Длительность анимации, мс",
    labelLabel: "Подпись",
    targetSceneLabel: "Целевая сцена",
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
    assetSummary: "\u0442\u0438\u043f: {type}",
    variableSummary: "\u0442\u0438\u043f: {type}",
    boardView: "\u041a\u0430\u0440\u0442\u0430 \u0441\u0446\u0435\u043d\u0430\u0440\u0438\u044f",
  },
  en: {
    pageTitle: "FraerApp - Story Builder",
    builderTitle: "Story Builder",
    runtimeApiLabel: "Runtime API",
    adminTokenLabel: "Admin token",
    loadExample: "Load Example",
    copyJson: "Copy JSON",
    downloadJson: "Download JSON",
    importJsonFile: "Import JSON File",
    pasteJson: "Paste JSON",
    clearDraft: "Clear draft",
    storyMetadata: "Story metadata",
    keyLabel: "Key",
    titleLabel: "Title",
    versionLabel: "Version",
    startSceneLabel: "Start scene",
    descriptionLabel: "Description",
    variablesTitle: "Variables",
    addVariable: "Add variable",
    assetsTitle: "Assets",
    addAsset: "Add asset",
    scenesTitle: "Scenes",
    addScene: "Add scene",
    runtimeActions: "Runtime actions",
    importToRuntime: "Import to Runtime",
    validateLastImport: "Validate Last Import",
    publishLastImport: "Publish Last Import",
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
    idLabel: "Id",
    urlLabel: "URL",
    metadataJsonLabel: "Metadata JSON",
    textLabel: "Text",
    backgroundLabel: "Background",
    musicLabel: "Music",
    animationLabel: "Animation",
    animationDurationLabel: "Animation duration ms",
    labelLabel: "Label",
    targetSceneLabel: "Target scene",
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
    assetSummary: "type: {type}",
    variableSummary: "type: {type}",
    boardView: "Scenario map",
  },
};

const storageKey = "fraerapp.storyBuilderDraft";
const languageKey = "fraerapp.storyBuilderLanguage";
const authorStorageKey = "fraerapp.storyBuilderAuthor";
const collapseStateKey = "fraerapp.storyBuilderCollapseState";
let lastImportedStoryId = localStorage.getItem("fraerapp.storyBuilderLastStoryId");
let currentLanguage = localStorage.getItem(languageKey) || "ru";
let collapseState = loadCollapseState();
let lastAppliedHash = "";

function t(key, params = {}) {
  const template = translations[currentLanguage]?.[key] ?? translations.ru[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
}

let draft = loadDraft() || emptyDraft();
draft = localizeDraftDefaults(draft);
let authorSession = loadAuthorSession();

function emptyDraft() {
  return {
    key: t("newStoryKey"),
    title: t("newStoryTitle"),
    description: "",
    version: 1,
    startSceneId: "start",
    variables: [{ name: "score", type: "number", value: 0 }],
    assets: [{ id: "start_bg", type: "image", url: "/assets/platform.svg", metadata: "" }],
    scenes: [
      {
        id: "start",
        title: t("exampleStartTitle"),
        text: t("defaultSceneText"),
        background: "start_bg",
        music: "",
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
      { name: "score", type: "number", value: 0 },
      { name: "hasKey", type: "boolean", value: false },
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
  localStorage.setItem(languageKey, currentLanguage);
  draft = localizeDraftDefaults(draft);
  applyTranslations();
  render();
}

function render() {
  applyTranslations();
  renderMeta();
  renderVariables();
  renderAssets();
  renderScenes();
  renderPreview();
  saveDraft();
  applyHashFocus();
}

function renderMeta() {
  for (const input of els.meta) {
    const key = input.dataset.meta;
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
    const item = collapsibleItem({
      title: t("variableItem", { index: index + 1 }),
      subtitle: `${variable.name || `${t("variablePrefix")}_${index + 1}`} · ${t("variableSummary", { type: variable.type || "string" })}`,
      key: collapseKey("variable", index),
      onRemove: () => removeAt(draft.variables, index),
      entityKind: "variable",
      entityId: variable.name || `${index}`,
    });
    item.append(
      field(t("nameLabel"), input(variable.name, (value) => (variable.name = value))),
      selectField(t("typeLabel"), ["string", "number", "boolean"], variable.type, (value) => {
        variable.type = value;
        variable.value = defaultValue(value);
        render();
      }),
      typedValueField(variable, (value) => (variable.value = value)),
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
    const item = collapsibleItem({
      title: t("assetItem", { index: index + 1 }),
      subtitle: `${asset.id || `${t("assetPrefix")}_${index + 1}`} · ${t("assetSummary", { type: asset.type || "image" })}`,
      key: collapseKey("asset", index),
      onRemove: () => removeAt(draft.assets, index),
      entityKind: "asset",
      entityId: asset.id || `${index}`,
    });
    item.append(
      field(t("idLabel"), input(asset.id, (value) => (asset.id = value))),
      selectField(t("typeLabel"), ["image", "music", "sound", "video", "sprite"], asset.type, (value) => (asset.type = value)),
      field(t("urlLabel"), input(asset.url, (value) => (asset.url = value))),
      field(t("metadataJsonLabel"), textarea(asset.metadata || "", (value) => (asset.metadata = value), 3)),
    );
    els.assets.append(item);
  });
}

function renderScenes() {
  els.scenes.replaceChildren();
  const assetIds = draft.assets.map((asset) => asset.id);
  appendCollectionToolbar(
    els.scenes,
    draft.scenes.map((scene, index) => collapseKey("scene", scene.id || index)),
  );
  draft.scenes.forEach((scene, sceneIndex) => {
    const item = collapsibleItem({
      title: t("sceneItem", { index: sceneIndex + 1, name: scene.id || t("newSceneFallback") }),
      subtitle: `${scene.title || t("sceneDefaultTitle")} · ${t(scene.endingEnabled ? "sceneSummaryEnding" : "sceneSummary", {
        choices: scene.choices.length,
        effects: scene.effects.length,
      })}`,
      key: collapseKey("scene", scene.id || sceneIndex),
      onRemove: () => removeAt(draft.scenes, sceneIndex),
      entityKind: "scene",
      entityId: scene.id || `${sceneIndex}`,
    });
    item.append(
      field(t("idLabel"), input(scene.id, (value) => (scene.id = value))),
      field(t("titleLabel"), input(scene.title, (value) => (scene.title = value))),
      field(t("textLabel"), textarea(scene.text, (value) => (scene.text = value), 4)),
      selectField(t("backgroundLabel"), ["", ...assetIds], scene.background || "", (value) => (scene.background = value)),
      selectField(t("musicLabel"), ["", ...assetIds], scene.music || "", (value) => (scene.music = value)),
      selectField(t("animationLabel"), ["none", "fade-in"], scene.animationType || "none", (value) => (scene.animationType = value)),
      field(t("animationDurationLabel"), input(scene.animationDurationMs || 600, (value) => (scene.animationDurationMs = Number(value || 0)), "number")),
      effectsEditor(scene.effects, t("sceneEffects")),
      endingEditor(scene),
      choicesEditor(scene),
    );
    els.scenes.append(item);
  });
}

function choicesEditor(scene) {
  const wrap = div("nested");
  const add = button(t("addChoice"), () => {
    scene.choices.push({
      id: `${t("choicePrefix")}_${scene.choices.length + 1}`,
      label: t("choiceDefaultLabel"),
      target: scene.id,
      conditions: [],
      effects: [],
    });
    render();
  });
  wrap.append(rowTitle(t("choicesTitle"), add));
  scene.choices.forEach((choice, index) => {
    const item = div("item");
    item.append(
      rowHead(t("choiceItem", { index: index + 1 }), () => removeAt(scene.choices, index)),
      field(t("idLabel"), input(choice.id, (value) => (choice.id = value))),
      field(t("labelLabel"), input(choice.label, (value) => (choice.label = value))),
      selectField(t("targetSceneLabel"), draft.scenes.map((candidate) => candidate.id), choice.target, (value) => (choice.target = value)),
      conditionsEditor(choice.conditions),
      effectsEditor(choice.effects, t("choiceEffects")),
    );
    wrap.append(item);
  });
  return wrap;
}

function conditionsEditor(conditions) {
  const wrap = div("nested");
  wrap.append(rowTitle(t("conditionsTitle"), button(t("addCondition"), () => {
    conditions.push({ variable: firstVariable(), op: "==", value: defaultValue(variableType(firstVariable())) });
    render();
  })));
  conditions.forEach((condition, index) => {
    const variableNames = draft.variables.map((variable) => variable.name);
    const item = div("item");
    item.append(
      rowHead(t("conditionItem", { index: index + 1 }), () => removeAt(conditions, index)),
      selectField(t("variableLabel"), variableNames, condition.variable, (value) => {
        condition.variable = value;
        condition.value = defaultValue(variableType(value));
        render();
      }),
      selectField(t("operatorLabel"), ["==", "!=", ">=", "<=", ">", "<"], condition.op, (value) => (condition.op = value)),
      typedValueField({ type: variableType(condition.variable), value: condition.value }, (value) => (condition.value = value)),
    );
    wrap.append(item);
  });
  return wrap;
}

function effectsEditor(effects, title) {
  const wrap = div("nested");
  wrap.append(rowTitle(title, button(t("addEffect"), () => {
    effects.push({ kind: "set", variable: firstVariable(), value: defaultValue(variableType(firstVariable())) });
    render();
  })));
  effects.forEach((effect, index) => {
    const variableNames = draft.variables.map((variable) => variable.name);
    const type = variableType(effect.variable);
    const item = div("item");
    item.append(
      rowHead(t("effectItem", { index: index + 1 }), () => removeAt(effects, index)),
      selectField(t("kindLabel"), ["set", "inc"], effect.kind, (value) => {
        effect.kind = value;
        if (value === "inc") {
          effect.value = Number(effect.value || 1);
        }
        render();
      }),
      selectField(t("variableLabel"), variableNames, effect.variable, (value) => {
        effect.variable = value;
        effect.value = effect.kind === "inc" ? 1 : defaultValue(variableType(value));
        render();
      }),
      effect.kind === "inc"
        ? field(t("valueLabel"), input(effect.value ?? 1, (value) => (effect.value = Number(value || 0)), "number"))
        : typedValueField({ type, value: effect.value }, (value) => (effect.value = value)),
    );
    wrap.append(item);
  });
  return wrap;
}

function endingEditor(scene) {
  const wrap = div("nested");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(scene.endingEnabled);
  checkbox.onchange = () => {
    scene.endingEnabled = checkbox.checked;
    render();
  };
  const label = document.createElement("label");
  label.append(t("endingEnabled"), checkbox);
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
  els.jsonPreview.textContent = JSON.stringify(story, null, 2);
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
    version: Number(draft.version || 1),
    startSceneId: draft.startSceneId,
    variables: Object.fromEntries(draft.variables.filter((variable) => variable.name).map((variable) => [variable.name, coerceValue(variable.type, variable.value)])),
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
      background: scene.background || null,
      music: scene.music || null,
      animation: scene.animationType === "fade-in" ? { type: "fade-in", durationMs: Number(scene.animationDurationMs || 600) } : {},
      effects: serializeEffects(scene.effects),
      ...(scene.endingEnabled ? { ending: { type: scene.endingType || "ending", title: scene.endingTitle || scene.title } } : {}),
      choices: scene.choices.map((choice) => ({
        id: choice.id,
        label: choice.label,
        target: choice.target,
        conditions: serializeConditions(choice.conditions),
        effects: serializeEffects(choice.effects),
      })),
    })),
  };
}

function serializeConditions(conditions) {
  return conditions.map((condition) => ({
    var: condition.variable,
    op: condition.op,
    value: coerceValue(variableType(condition.variable), condition.value),
  }));
}

function serializeEffects(effects) {
  return effects.map((effect) => effect.kind === "inc"
    ? { inc: effect.variable, value: Number(effect.value || 0) }
    : { set: effect.variable, value: coerceValue(variableType(effect.variable), effect.value) });
}

function validateStory(story) {
  const errors = [];
  const sceneIds = story.scenes.map((scene) => scene.id);
  const assetIds = story.assets.map((asset) => asset.id);
  const variableNames = Object.keys(story.variables);
  if (!story.key) errors.push(t("keyRequired"));
  if (!story.title) errors.push(t("titleRequired"));
  if (!story.startSceneId || !sceneIds.includes(story.startSceneId)) errors.push(t("startSceneMissing"));
  duplicates(sceneIds).forEach((id) => errors.push(t("duplicateSceneId", { id })));
  story.scenes.forEach((scene) => {
    if (scene.background && !assetIds.includes(scene.background)) errors.push(t("missingBackground", { scene: scene.id, asset: scene.background }));
    if (scene.music && !assetIds.includes(scene.music)) errors.push(t("missingMusic", { scene: scene.id, asset: scene.music }));
    duplicates(scene.choices.map((choice) => choice.id)).forEach((id) => errors.push(t("duplicateChoiceId", { scene: scene.id, id })));
    scene.choices.forEach((choice) => {
      if (!sceneIds.includes(choice.target)) errors.push(t("missingTarget", { choice: choice.id, scene: scene.id, target: choice.target }));
      choice.conditions.forEach((condition) => {
        if (!variableNames.includes(condition.var)) errors.push(t("missingConditionVariable", { choice: choice.id, variable: condition.var }));
      });
      choice.effects.forEach((effect) => {
        const name = effect.inc || effect.set;
        if (!variableNames.includes(name)) errors.push(t("missingEffectVariableChoice", { choice: choice.id, variable: name }));
        if (effect.inc && variableType(effect.inc) !== "number") errors.push(t("invalidIncChoice", { choice: choice.id, variable: effect.inc }));
      });
    });
    scene.effects.forEach((effect) => {
      const name = effect.inc || effect.set;
      if (!variableNames.includes(name)) errors.push(t("missingEffectVariableScene", { scene: scene.id, variable: name }));
      if (effect.inc && variableType(effect.inc) !== "number") errors.push(t("invalidIncScene", { scene: scene.id, variable: effect.inc }));
    });
  });
  return errors;
}

function fromStoryJson(story) {
  draft = {
    key: story.key || t("newStoryKey"),
    title: story.title || t("newStoryTitle"),
    description: story.description || "",
    version: story.version || 1,
    startSceneId: story.startSceneId || "",
    variables: Object.entries(story.variables || {}).map(([name, value]) => ({ name, type: detectType(value), value })),
    assets: (story.assets || []).map((asset) => ({ id: asset.id, type: asset.type || "image", url: asset.url || "", metadata: asset.metadata ? JSON.stringify(asset.metadata, null, 2) : "" })),
    scenes: (story.scenes || []).map((scene) => ({
      id: scene.id,
      title: scene.title || "",
      text: scene.text || "",
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
        conditions: (choice.conditions || []).map((condition) => ({ variable: condition.var, op: condition.op, value: condition.value })),
        effects: parseEffects(choice.effects || []),
      })),
    })),
  };
  render();
}

function parseEffects(effects) {
  return effects.map((effect) => effect.inc
    ? { kind: "inc", variable: effect.inc, value: effect.value ?? 1 }
    : { kind: "set", variable: effect.set, value: effect.value });
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

function field(labelText, control) {
  const label = document.createElement("label");
  label.append(labelText, control);
  return label;
}

function input(value, onChange, type = "text") {
  const el = document.createElement("input");
  el.type = type;
  el.value = value ?? "";
  el.oninput = () => {
    onChange(type === "number" ? Number(el.value || 0) : el.value);
    renderPreview();
    saveDraft();
  };
  return el;
}

function textarea(value, onChange, rows = 3) {
  const el = document.createElement("textarea");
  el.rows = rows;
  el.value = value ?? "";
  el.oninput = () => {
    onChange(el.value);
    renderPreview();
    saveDraft();
  };
  return el;
}

function selectField(labelText, options, selected, onChange) {
  const select = document.createElement("select");
  fillSelect(select, options, false);
  select.value = selected ?? "";
  select.onchange = () => {
    onChange(select.value);
    render();
  };
  return field(labelText, select);
}

function typedValueField(variable, onChange) {
  if (variable.type === "boolean") {
    return selectField(t("valueLabel"), ["false", "true"], String(Boolean(variable.value)), (value) => onChange(value === "true"));
  }
  return field(t("valueLabel"), input(variable.value ?? "", (value) => onChange(coerceValue(variable.type, value)), variable.type === "number" ? "number" : "text"));
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
  row.append(strong, button(t("removeButton"), () => { onRemove(); render(); }, "danger small"));
  return row;
}

function rowTitle(title, action) {
  const row = div("row-head");
  const strong = document.createElement("strong");
  strong.textContent = title;
  row.append(strong);
  if (action) row.append(action);
  return row;
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
  actions.append(state, summaryRemoveButton(onRemove));

  details.addEventListener("toggle", () => {
    state.textContent = details.open ? t("expandedHint") : t("collapsedHint");
  });

  summary.append(text, actions);
  details.append(summary);
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
    onRemove();
    render();
  };
  return el;
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

function firstVariable() {
  return draft.variables[0]?.name || "";
}

function variableType(name) {
  return draft.variables.find((variable) => variable.name === name)?.type || "string";
}

function defaultValue(type) {
  if (type === "number") return 0;
  if (type === "boolean") return false;
  return "";
}

function coerceValue(type, value) {
  if (type === "number") return Number(value || 0);
  if (type === "boolean") return value === true || value === "true";
  return value ?? "";
}

function detectType(value) {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "string";
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

function saveDraft() {
  localStorage.setItem(storageKey, JSON.stringify(draft));
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAuthorSession(session) {
  authorSession = session;
  if (session) {
    localStorage.setItem(authorStorageKey, JSON.stringify(session));
  } else {
    localStorage.removeItem(authorStorageKey);
  }
  renderAuthorWorkspace();
}

function loadAuthorSession() {
  try {
    const raw = localStorage.getItem(authorStorageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCollapseState() {
  localStorage.setItem(collapseStateKey, JSON.stringify(collapseState));
}

function loadCollapseState() {
  try {
    const raw = localStorage.getItem(collapseStateKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function authorHeaders(contentType = false) {
  const headers = {};
  if (authorSession?.playerId) {
    headers["X-Player-Id"] = authorSession.playerId;
  }
  if (contentType) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

async function authorFetch(path, options = {}) {
  const base = els.runtimeUrl.value.replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...authorHeaders(Boolean(options.body)),
      ...(options.headers || {}),
    },
    body: options.body,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function loginAuthor() {
  const username = els.authorName.value.trim();
  if (!username) {
    els.authorState.textContent = "Введите имя автора.";
    return;
  }
  const session = await authorFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  saveAuthorSession(session);
}

async function loadAuthorHome() {
  if (!authorSession?.playerId) {
    renderAuthorWorkspace();
    return null;
  }
  const home = await authorFetch("/api/author/home");
  renderAuthorWorkspace(home);
  return home;
}

function renderAuthorWorkspace(home = null) {
  const authorName = authorSession?.username || "не выбран";
  els.authorState.textContent = authorSession?.playerId
    ? `Автор: ${authorName}`
    : "Автор не вошел. Для product workflow войдите как автор.";
  els.authorStories.replaceChildren();
  if (!home?.stories?.length) {
    els.authorAnalytics.textContent = authorSession?.playerId
      ? "У автора пока нет сценариев. Импортируйте текущий draft."
      : "";
    return;
  }
  els.authorAnalytics.textContent = home.stats
    ? JSON.stringify(home.stats, null, 2)
    : "";
  for (const story of home.stories) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.textContent = `${story.title} [${story.status}]`;
    button.onclick = async () => {
      lastImportedStoryId = story.storyId;
      localStorage.setItem("fraerapp.storyBuilderLastStoryId", lastImportedStoryId);
      const analytics = await authorFetch(`/api/author/stories/${story.storyId}/analytics`);
      els.authorAnalytics.textContent = JSON.stringify(analytics, null, 2);
    };
    els.authorStories.append(button);
  }
}

document.querySelector("#add-variable").onclick = () => {
  draft.variables.push({ name: `${t("variablePrefix")}_${draft.variables.length + 1}`, type: "string", value: "" });
  render();
};

document.querySelector("#add-asset").onclick = () => {
  draft.assets.push({ id: `${t("assetPrefix")}_${draft.assets.length + 1}`, type: "image", url: "", metadata: "" });
  render();
};

document.querySelector("#add-scene").onclick = () => {
  draft.scenes.push({
    id: `${t("scenePrefix")}_${draft.scenes.length + 1}`,
    title: t("sceneDefaultTitle"),
    text: "",
    background: draft.assets[0]?.id || "",
    music: "",
    animationType: "fade-in",
    animationDurationMs: 600,
    effects: [],
    endingEnabled: false,
    endingType: "",
    endingTitle: "",
    choices: [],
  });
  render();
};

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
  fromStoryJson(JSON.parse(await file.text()));
};

document.querySelector("#paste-json").onclick = () => {
  els.pasteArea.value = JSON.stringify(toStoryJson(), null, 2);
  els.pasteDialog.showModal();
};

document.querySelector("#apply-paste").onclick = () => {
  fromStoryJson(JSON.parse(els.pasteArea.value));
  els.pasteDialog.close();
};

document.querySelector("#clear-draft").onclick = () => {
  localStorage.removeItem(storageKey);
  draft = emptyDraft();
  render();
};

document.querySelector("#import-runtime").onclick = () => runtimeCall("import");
document.querySelector("#validate-runtime").onclick = () => runtimeCall("validate");
document.querySelector("#publish-runtime").onclick = () => runtimeCall("publish");

async function runtimeCall(action) {
  try {
    const base = els.runtimeUrl.value.replace(/\/$/, "");
    if (authorSession?.playerId) {
      let path = `${base}/api/author/stories/import`;
      let options = {
        method: "POST",
        headers: {
          ...authorHeaders(true),
          Accept: "application/json",
        },
        body: JSON.stringify(toStoryJson()),
      };
      if (action === "validate" || action === "publish") {
        if (!lastImportedStoryId) throw new Error(t("importFirst"));
        path = `${base}/api/author/stories/${lastImportedStoryId}/${action}`;
        options = {
          method: "POST",
          headers: {
            ...authorHeaders(false),
            Accept: "application/json",
          },
        };
      }
      const payload = await fetchJson(path, options);
      if (payload.storyId) {
        lastImportedStoryId = payload.storyId;
        localStorage.setItem("fraerapp.storyBuilderLastStoryId", lastImportedStoryId);
      }
      els.apiResult.textContent = JSON.stringify(payload, null, 2);
      await loadAuthorHome();
      return;
    }

    const token = els.adminToken.value || "dev-admin-token";
    let url = `${base}/api/admin/stories/import`;
    let options = { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": token }, body: JSON.stringify(toStoryJson()) };
    if (action === "validate" || action === "publish") {
      if (!lastImportedStoryId) throw new Error(t("importFirst"));
      url = `${base}/api/admin/stories/${lastImportedStoryId}/${action}`;
      options = { method: "POST", headers: { "X-Admin-Token": token } };
    }
    const payload = await fetchJson(url, options);
    if (payload.storyId) {
      lastImportedStoryId = payload.storyId;
      localStorage.setItem("fraerapp.storyBuilderLastStoryId", lastImportedStoryId);
    }
    els.apiResult.textContent = JSON.stringify(payload, null, 2);
  } catch (error) {
    els.apiResult.textContent = error.message;
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

els.langRu.onclick = () => setLanguage("ru");
els.langEn.onclick = () => setLanguage("en");
els.authorLogin.onclick = () => loginAuthor().catch((error) => {
  els.authorState.textContent = error.message;
});
els.authorLogout.onclick = () => {
  saveAuthorSession(null);
  els.authorAnalytics.textContent = "";
};
els.refreshAuthor.onclick = () => {
  loadAuthorHome().catch((error) => {
    els.authorState.textContent = error.message;
  });
};
if (authorSession?.username) {
  els.authorName.value = authorSession.username;
}

window.addEventListener("hashchange", () => {
  lastAppliedHash = "";
  applyHashFocus();
});

render();
loadAuthorHome().catch(() => {
  renderAuthorWorkspace();
});
