import test from "node:test";
import assert from "node:assert/strict";

import {
  coerceValue,
  emptyDraft,
  exampleDraft,
  localizeDraftDefaults,
  serializeConditions,
  serializeEffects,
  validateStory,
} from "./core.js";

test("emptyDraft is localized", () => {
  const ruDraft = emptyDraft("ru");
  const enDraft = emptyDraft("en");

  assert.equal(ruDraft.title, "Новая история");
  assert.equal(ruDraft.scenes[0].text, "История начинается.");
  assert.equal(enDraft.title, "New Story");
  assert.equal(enDraft.scenes[0].text, "The story begins.");
});

test("exampleDraft stays valid in both locales", () => {
  const ruStory = toStoryJson(exampleDraft("ru"));
  const enStory = toStoryJson(exampleDraft("en"));

  assert.deepEqual(validateStory(ruStory, "ru"), []);
  assert.deepEqual(validateStory(enStory, "en"), []);
});

test("localizeDraftDefaults remaps default text but preserves custom text", () => {
  const englishDraft = exampleDraft("en");
  englishDraft.scenes[0].text = "Custom intro";
  const localized = localizeDraftDefaults(englishDraft, "ru");

  assert.equal(localized.title, "Пример конструктора");
  assert.equal(localized.scenes[1].title, "Дверь");
  assert.equal(localized.scenes[0].text, "Custom intro");
});

test("validateStory catches missing targets and invalid inc targets", () => {
  const story = {
    key: "broken",
    title: "Broken story",
    description: "",
    version: 1,
    startSceneId: "start",
    variables: {
      hasKey: false,
    },
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

  const errors = validateStory(story, "en");

  assert.match(errors.join("\n"), /missing target missing/i);
  assert.match(errors.join("\n"), /references missing variable unknown/i);
  assert.match(errors.join("\n"), /must target number variable hasKey/i);
});

test("serialize helpers preserve expected story-engine contract", () => {
  const variableTypes = {
    score: "number",
    hasKey: "boolean",
    note: "string",
  };
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
  assert.equal(coerceValue("string", "hi"), "hi");
});

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
