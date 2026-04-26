import test from "node:test";
import assert from "node:assert/strict";

import {
  endingLabel,
  normalizeLanguage,
  sessionStatusLabel,
  soundLabel,
  translate,
} from "./engine.i18n.js";

test("normalizeLanguage falls back to ru", () => {
  assert.equal(normalizeLanguage("ru"), "ru");
  assert.equal(normalizeLanguage("en"), "en");
  assert.equal(normalizeLanguage("de"), "ru");
});

test("translate interpolates params in both locales", () => {
  assert.equal(translate("ru", "errorPrefix", { message: "boom" }), "Ошибка: boom");
  assert.equal(translate("en", "errorPrefix", { message: "boom" }), "Error: boom");
});

test("soundLabel matches state", () => {
  assert.equal(soundLabel("ru", true), "Звук: включен");
  assert.equal(soundLabel("ru", false), "Звук: выключен");
  assert.equal(soundLabel("en", true), "Sound: on");
  assert.equal(soundLabel("en", false), "Sound: off");
});

test("sessionStatusLabel returns localized gameplay status", () => {
  assert.equal(sessionStatusLabel("ru", "active"), "Прогресс сохранен");
  assert.equal(sessionStatusLabel("ru", "finished"), "Сессия завершена");
  assert.equal(sessionStatusLabel("en", "active"), "Progress saved");
  assert.equal(sessionStatusLabel("en", "finished"), "Session finished");
});

test("endingLabel uses ending title and fallback", () => {
  assert.equal(endingLabel("ru", { title: "Победа" }), "Финал: Победа");
  assert.equal(endingLabel("en", { type: "victory" }), "Ending: victory");
  assert.equal(endingLabel("ru", null), "Финал: завершено");
});
