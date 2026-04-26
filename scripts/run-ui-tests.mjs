import assert from "node:assert/strict";

import {
  endingLabel,
  normalizeLanguage,
  sessionStatusLabel,
  soundLabel,
  translate as translateEngine,
} from "../frontend/engine.i18n.js";
import {
  coerceValue,
  emptyDraft,
  exampleDraft,
  localizeDraftDefaults,
  serializeConditions,
  serializeEffects,
  validateStory,
} from "../story-builder/core.js";

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test("frontend normalizeLanguage falls back to ru", () => {
  assert.equal(normalizeLanguage("ru"), "ru");
  assert.equal(normalizeLanguage("en"), "en");
  assert.equal(normalizeLanguage("de"), "ru");
});

test("frontend translations interpolate params", () => {
  assert.equal(translateEngine("ru", "errorPrefix", { message: "boom" }), "Ошибка: boom");
  assert.equal(translateEngine("en", "errorPrefix", { message: "boom" }), "Error: boom");
});

test("frontend sound and status labels are localized", () => {
  assert.equal(soundLabel("ru", true), "Звук: включен");
  assert.equal(soundLabel("en", false), "Sound: off");
  assert.equal(sessionStatusLabel("ru", "finished"), "Сессия завершена");
  assert.equal(sessionStatusLabel("en", "active"), "Progress saved");
});

test("frontend ending label uses localized fallback", () => {
  assert.equal(endingLabel("ru", { title: "Победа" }), "Финал: Победа");
  assert.equal(endingLabel("en", null), "Ending: finished");
});

test("story-builder empty draft is localized", () => {
  const ruDraft = emptyDraft("ru");
  const enDraft = emptyDraft("en");
  assert.equal(ruDraft.title, "Новая история");
  assert.equal(ruDraft.scenes[0].text, "История начинается.");
  assert.equal(enDraft.title, "New Story");
  assert.equal(enDraft.scenes[0].text, "The story begins.");
});

test("story-builder example draft validates in both locales", () => {
  assert.deepEqual(validateStory(toStoryJson(exampleDraft("ru")), "ru"), []);
  assert.deepEqual(validateStory(toStoryJson(exampleDraft("en")), "en"), []);
});

test("story-builder localizeDraftDefaults remaps defaults but keeps custom text", () => {
  const englishDraft = exampleDraft("en");
  englishDraft.scenes[0].text = "Custom intro";
  const localized = localizeDraftDefaults(englishDraft, "ru");
  assert.equal(localized.title, "Пример конструктора");
  assert.equal(localized.scenes[1].title, "Дверь");
  assert.equal(localized.scenes[0].text, "Custom intro");
});

test("story-builder validateStory catches missing links and wrong inc targets", () => {
  const story = {
    key: "broken",
    title: "Broken story",
    description: "",
    version: 1,
    startSceneId: "start",
    variables: { hasKey: false },
    assets: [],
    scenes: [
      {
        id: "start",
        title: "Start",
        text: "Text",
        background: null,
        music: null,
        animation: {},
        effects: [{ inc: "hasKey", value: 1 }],
        choices: [
          {
            id: "go",
            label: "Go",
            target: "missing",
            conditions: [{ var: "unknown", op: "==", value: true }],
            effects: [{ inc: "hasKey", value: 1 }],
          },
        ],
      },
    ],
  };
  const errors = validateStory(story, "en").join("\n");
  assert.match(errors, /missing target missing/i);
  assert.match(errors, /references missing variable unknown/i);
  assert.match(errors, /must target number variable hasKey/i);
});

test("story-builder serialize helpers preserve engine contract", () => {
  const variableTypes = { score: "number", hasKey: "boolean", note: "string" };
  const typeOf = (name) => variableTypes[name] || "string";

  assert.deepEqual(
    serializeConditions([{ variable: "hasKey", op: "==", value: "true" }], typeOf),
    [{ var: "hasKey", op: "==", value: true }],
  );
  assert.deepEqual(
    serializeEffects(
      [
        { kind: "inc", variable: "score", value: "2" },
        { kind: "set", variable: "note", value: "ok" },
      ],
      typeOf,
    ),
    [
      { inc: "score", value: 2 },
      { set: "note", value: "ok" },
    ],
  );
  assert.equal(coerceValue("number", "3"), 3);
  assert.equal(coerceValue("boolean", "true"), true);
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`All UI tests passed: ${tests.length}`);
}

function toStoryJson(draft) {
  const typeOf = (name) => draft.variables.find((variable) => variable.name === name)?.type || "string";
  return {
    key: draft.key,
    title: draft.title,
    description: draft.description,
    version: draft.version,
    startSceneId: draft.startSceneId,
    variables: Object.fromEntries(draft.variables.map((variable) => [variable.name, coerceValue(variable.type, variable.value)])),
    assets: draft.assets.map((asset) => ({
      id: asset.id,
      type: asset.type,
      url: asset.url,
    })),
    scenes: draft.scenes.map((scene) => ({
      id: scene.id,
      title: scene.title,
      text: scene.text,
      background: scene.background || null,
      music: scene.music || null,
      animation: scene.animationType === "fade-in"
        ? { type: "fade-in", durationMs: Number(scene.animationDurationMs || 600) }
        : {},
      effects: serializeEffects(scene.effects || [], typeOf),
      ...(scene.endingEnabled
        ? { ending: { type: scene.endingType || "ending", title: scene.endingTitle || scene.title } }
        : {}),
      choices: (scene.choices || []).map((choice) => ({
        id: choice.id,
        label: choice.label,
        target: choice.target,
        conditions: serializeConditions(choice.conditions || [], typeOf),
        effects: serializeEffects(choice.effects || [], typeOf),
      })),
    })),
  };
}
