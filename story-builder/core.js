export const translations = {
  ru: {
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
  },
  en: {
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

export function emptyDraft(language) {
  return {
    key: translate(language, "newStoryKey"),
    title: translate(language, "newStoryTitle"),
    description: "",
    version: 1,
    startSceneId: "start",
    variables: [{ name: "score", type: "number", value: 0, showInStats: false }],
    assets: [{ id: "start_bg", type: "image", url: "/assets/platform.svg", metadata: "" }],
    scenes: [
      {
        id: "start",
        title: translate(language, "exampleStartTitle"),
        text: translate(language, "defaultSceneText"),
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

export function exampleDraft(language) {
  return {
    key: translate(language, "builderExampleKey"),
    title: translate(language, "builderExampleTitle"),
    description: translate(language, "builderExampleDescription"),
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
        title: translate(language, "exampleStartTitle"),
        text: translate(language, "exampleStartText"),
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
            label: translate(language, "takeKey"),
            target: "door",
            conditions: [],
            effects: [
              { kind: "set", variable: "hasKey", value: true },
              { kind: "inc", variable: "score", value: 1 },
            ],
          },
          {
            id: "go_without_key",
            label: translate(language, "goWithoutKey"),
            target: "door",
            conditions: [],
            effects: [],
          },
        ],
      },
      {
        id: "door",
        title: translate(language, "doorTitle"),
        text: translate(language, "doorText"),
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
            label: translate(language, "openDoor"),
            target: "good_end",
            conditions: [{ variable: "hasKey", op: "==", value: true }],
            effects: [{ kind: "inc", variable: "score", value: 5 }],
          },
          {
            id: "wait",
            label: translate(language, "waitOutside"),
            target: "bad_end",
            conditions: [],
            effects: [],
          },
        ],
      },
      endingScene(
        language,
        "good_end",
        "goodEndingTitle",
        "goodEndingText",
        "end_bg",
        "good",
        "goodEndingLabel",
      ),
      endingScene(
        language,
        "bad_end",
        "quietEndingTitle",
        "quietEndingText",
        "door_bg",
        "bad",
        "quietEndingLabel",
      ),
    ],
  };
}

function endingScene(language, id, titleKey, textKey, background, endingType, endingTitleKey) {
  return {
    id,
    title: translate(language, titleKey),
    text: translate(language, textKey),
    background,
    music: "",
    animationType: "fade-in",
    animationDurationMs: 600,
    effects: [],
    endingEnabled: true,
    endingType,
    endingTitle: translate(language, endingTitleKey),
    choices: [],
  };
}

export function localizeDraftDefaults(sourceDraft, language) {
  const draftCopy = structuredClone(sourceDraft);
  const mapValue = (value, ruValue, enValue) => {
    if (value === ruValue || value === enValue) {
      return normalizeLanguage(language) === "ru" ? ruValue : enValue;
    }
    return value;
  };
  const remapText = (value, ruValue, enValue) => mapValue(value, ruValue, enValue);

  draftCopy.title = [
    [translations.ru.newStoryTitle, translations.en.newStoryTitle],
    [translations.ru.builderExampleTitle, translations.en.builderExampleTitle],
  ].reduce((value, [ruValue, enValue]) => mapValue(value, ruValue, enValue), draftCopy.title);
  draftCopy.description = mapValue(draftCopy.description, translations.ru.builderExampleDescription, translations.en.builderExampleDescription);
  draftCopy.scenes = (draftCopy.scenes || []).map((scene) => ({
    ...scene,
    title: [
      [translations.ru.exampleStartTitle, translations.en.exampleStartTitle],
      [translations.ru.doorTitle, translations.en.doorTitle],
      [translations.ru.goodEndingTitle, translations.en.goodEndingTitle],
      [translations.ru.quietEndingTitle, translations.en.quietEndingTitle],
    ].reduce((value, [ruValue, enValue]) => mapValue(value, ruValue, enValue), scene.title),
    text: [
      [translations.ru.defaultSceneText, translations.en.defaultSceneText],
      [translations.ru.exampleStartText, translations.en.exampleStartText],
      [translations.ru.doorText, translations.en.doorText],
      [translations.ru.goodEndingText, translations.en.goodEndingText],
      [translations.ru.quietEndingText, translations.en.quietEndingText],
    ].reduce((value, [ruValue, enValue]) => remapText(value, ruValue, enValue), scene.text),
    endingTitle: [
      [translations.ru.goodEndingLabel, translations.en.goodEndingLabel],
      [translations.ru.quietEndingLabel, translations.en.quietEndingLabel],
    ].reduce((value, [ruValue, enValue]) => mapValue(value, ruValue, enValue), scene.endingTitle),
    choices: (scene.choices || []).map((choice) => ({
      ...choice,
      label: [
        [translations.ru.takeKey, translations.en.takeKey],
        [translations.ru.goWithoutKey, translations.en.goWithoutKey],
        [translations.ru.openDoor, translations.en.openDoor],
        [translations.ru.waitOutside, translations.en.waitOutside],
      ].reduce((value, [ruValue, enValue]) => mapValue(value, ruValue, enValue), choice.label),
    })),
  }));
  return draftCopy;
}

export function detectType(value) {
  if (value && typeof value === "object" && "value" in value) {
    return detectType(value.value);
  }
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "string";
}

export function variableValue(value) {
  return value && typeof value === "object" && "value" in value ? value.value : value;
}

export function parseEffects(effects) {
  return effects.map((effect) => effect.inc
    ? { kind: "inc", variable: effect.inc, value: effect.value ?? 1 }
    : { kind: "set", variable: effect.set, value: effect.value });
}

export function coerceValue(type, value) {
  if (type === "number") return Number(value || 0);
  if (type === "boolean") return value === true || value === "true";
  return value ?? "";
}

export function serializeConditions(conditions, variableTypeResolver) {
  return conditions.map((condition) => ({
    var: condition.variable,
    op: condition.op,
    value: coerceValue(variableTypeResolver(condition.variable), condition.value),
  }));
}

export function serializeEffects(effects, variableTypeResolver) {
  return effects.map((effect) => effect.kind === "inc"
    ? { inc: effect.variable, value: Number(effect.value || 0) }
    : { set: effect.variable, value: coerceValue(variableTypeResolver(effect.variable), effect.value) });
}

export function validateStory(story, language) {
  const errors = [];
  const sceneIds = story.scenes.map((scene) => scene.id);
  const assetIds = story.assets.map((asset) => asset.id);
  const variableNames = Object.keys(story.variables);
  const variableTypes = Object.fromEntries(Object.entries(story.variables).map(([name, value]) => [name, detectType(variableValue(value))]));
  if (!story.key) errors.push(translate(language, "keyRequired"));
  if (!story.title) errors.push(translate(language, "titleRequired"));
  if (!story.startSceneId || !sceneIds.includes(story.startSceneId)) errors.push(translate(language, "startSceneMissing"));
  duplicates(sceneIds).forEach((id) => errors.push(translate(language, "duplicateSceneId", { id })));
  story.scenes.forEach((scene) => {
    const sceneVariableNames = [...variableNames, ...Object.keys(scene.variables || {})];
    if (scene.background && !assetIds.includes(scene.background)) {
      errors.push(translate(language, "missingBackground", { scene: scene.id, asset: scene.background }));
    }
    if (scene.music && !assetIds.includes(scene.music)) {
      errors.push(translate(language, "missingMusic", { scene: scene.id, asset: scene.music }));
    }
    duplicates(scene.choices.map((choice) => choice.id)).forEach((id) => {
      errors.push(translate(language, "duplicateChoiceId", { scene: scene.id, id }));
    });
    extractTextVariables(scene.text).forEach((variable) => {
      if (!sceneVariableNames.includes(variable)) {
        errors.push(translate(language, "missingTextVariable", { scene: scene.id, variable }));
      }
    });
    scene.choices.forEach((choice) => {
      if (!sceneIds.includes(choice.target)) {
        errors.push(translate(language, "missingTarget", {
          choice: choice.id,
          scene: scene.id,
          target: choice.target,
        }));
      }
      choice.conditions.forEach((condition) => {
        if (!variableNames.includes(condition.var)) {
          errors.push(translate(language, "missingConditionVariable", {
            choice: choice.id,
            variable: condition.var,
          }));
        }
      });
      choice.effects.forEach((effect) => {
        const name = effect.inc || effect.set;
        if (!variableNames.includes(name)) {
          errors.push(translate(language, "missingEffectVariableChoice", {
            choice: choice.id,
            variable: name,
          }));
        }
        if (effect.inc && variableTypes[effect.inc] !== "number") {
          errors.push(translate(language, "invalidIncChoice", {
            choice: choice.id,
            variable: effect.inc,
          }));
        }
      });
    });
    scene.effects.forEach((effect) => {
      const name = effect.inc || effect.set;
      if (!variableNames.includes(name)) {
        errors.push(translate(language, "missingEffectVariableScene", {
          scene: scene.id,
          variable: name,
        }));
      }
      if (effect.inc && variableTypes[effect.inc] !== "number") {
        errors.push(translate(language, "invalidIncScene", {
          scene: scene.id,
          variable: effect.inc,
        }));
      }
    });
  });
  return errors;
}

export function extractTextVariables(text) {
  return [...new Set([...String(text || "").matchAll(/\{\{\s*([^{}\s]+)\s*}}/g)].map((match) => match[1]))];
}

export function duplicates(values) {
  const seen = new Set();
  const duplicate = new Set();
  values.filter(Boolean).forEach((value) => {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  });
  return [...duplicate];
}
