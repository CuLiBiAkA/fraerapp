import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { authoringPrompt, authoringContext, exampleChapter, examplePackage } from './authoring-prompt-template.js';
import { copyPromptText } from './authoring-prompts.js';
import { validateStory } from './core.js';

const app = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
function editor() {
  const context = vm.createContext({ draft: {}, structuredClone, render() {}, t: key => key });
  for (const name of ['fromStoryJson', 'toStoryJson', 'serializeVariable', 'serializeConditions', 'serializeEffects', 'variableType', 'variableValue', 'detectType', 'coerceValue', 'parseMetadata', 'parseCondition', 'parseEffects', 'defaultValue']) {
    vm.runInContext(app.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0], context);
  }
  return context;
}

test('both prompt languages generate valid chapter and serial package examples, preserved by actual Builder import/export', () => {
  for (const language of ['ru', 'en']) {
    const bundle = examplePackage(language);
    assert.equal(bundle.schemaVersion, 1); assert.equal(bundle.collections[0].schemaVersion, 2);
    assert.equal(bundle.collections[0].type, 'story'); assert.equal(bundle.root.key, bundle.collections[0].key);
    assert.deepEqual(bundle.collections[0].items.map(item => item.target.key), bundle.scenarios.map(chapter => chapter.key));
    const context = editor();
    for (const chapter of bundle.scenarios) {
      assert.deepEqual(validateStory(chapter, language), []);
      context.fromStoryJson(chapter);
      assert.deepEqual(JSON.parse(JSON.stringify(context.toStoryJson())), chapter);
    }
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(new URL('../docs/examples/serial-story-package.json', import.meta.url), 'utf8')), examplePackage());
});

test('all four author tasks carry the current contract and exact requested output format', () => {
  for (const language of ['ru', 'en']) for (const kind of ['chapter', 'package']) for (const mode of ['create', 'edit']) {
    const prompt = authoringPrompt({ language, kind, mode, brief: 'Make the last door blue.' });
    assert.ok(prompt.includes('Make the last door blue.'));
    for (const feature of ['showInStats', 'timer', '{{', 'fallbackTarget', 'durationMs', 'AND', 'stateTransfer', 'inputContract', 'allowIndependentStart', 'allowedValues', 'schemaVersion', 'scenarios', 'collections', 'metadata.coverUrl', 'collection.coverUrl', 'moderation']) {
      if (feature === 'moderation' && language === 'ru') { assert.match(prompt, /модераци/); continue; }
      assert.ok(prompt.includes(feature), `${language} ${kind} ${mode}: ${feature}`);
    }
    assert.ok(prompt.includes(kind === 'chapter' ? 'chapter scenario (scenes)' : 'fraerapp-work-package (scenarios + collections)'));
  }
});

test('prompt completion states exactly match the server collection validator', () => {
  const service = fs.readFileSync(new URL('../src/main/java/com/fraergod/fraerapp/game/CollectionService.java', import.meta.url), 'utf8');
  const declaration = service.match(/List\.of\(([^)]+)\)\.contains\(d\.completionStatus\(\)\)/);
  assert.ok(declaration, 'The server remains the authority for completion states');
  const accepted = [...declaration[1].matchAll(/"([^"]+)"/g)].map(match => match[1]).sort();
  for (const language of ['ru', 'en']) {
    const specified = authoringPrompt({ language }).match(/completionStatus \(([^)]+)\)/)[1].split('|').sort();
    assert.deepEqual(specified, accepted);
  }
});

test('explicit source export copies authored content without API account or moderation fields', () => {
  const source = { ...exampleChapter(), generation: 8, ownerEmail: 'private@example.test', reviewNote: 'Private review', runtimeStory: { token: 'not-exported' } };
  const exported = authoringContext(source, 'chapter');
  assert.deepEqual(exported, exampleChapter());
  const prompt = authoringPrompt({ kind: 'chapter', mode: 'edit', context: source });
  assert.ok(prompt.includes(source.scenes[0].text)); assert.doesNotMatch(prompt, /private@example|Private review|not-exported/);
  exported.scenes[0].text = 'Changed'; assert.notEqual(source.scenes[0].text, 'Changed');
  assert.throws(() => authoringContext({ user: source }, 'chapter'));
  assert.throws(() => authoringContext(source, 'package'));
});

test('standalone cover and existing links survive prompt export and actual chapter editing', () => {
  const source = exampleChapter();
  source.metadata = { schemaVersion: 1, coverUrl: '/uploads/owned-work/cover.png', relations: [{ id: 'sequel', type: 'related', target: { kind: 'scenario', key: 'other' }, stateTransfer: { mode: 'independent' } }] };
  const context = editor(); context.fromStoryJson(source);
  assert.deepEqual(authoringContext(JSON.parse(JSON.stringify(context.toStoryJson())), 'chapter').metadata, source.metadata);
  assert.match(authoringPrompt({ language: 'ru' }), /именно этой истории\/главе/);
  assert.match(authoringPrompt({ language: 'en' }), /this exact work, not even another work/);
});

test('clipboard denial selects the complete prompt for manual copying; success uses clipboard', async () => {
  const calls = []; const textarea = { focus() { calls.push('focus'); }, select() { calls.push('select'); }, setSelectionRange(start, end) { calls.push([start, end]); } };
  assert.equal(await copyPromptText('abc', textarea, { writeText: async () => { throw new Error('Denied'); } }), false);
  assert.deepEqual(calls, ['focus', 'select', [0, 3]]);
  let value; assert.equal(await copyPromptText('abc', textarea, { writeText: async text => { value = text; } }), true); assert.equal(value, 'abc');
});

test('AI chapter edits preserve the existing server identity and refuse whole packages without changing the draft', () => {
  const context = editor(); const chapter = exampleChapter(); context.fromStoryJson(chapter);
  context.draft.runtimeStory = { storyId: 'existing', key: chapter.key, savedDocument: JSON.stringify(chapter), revision: 2 };
  const changed = structuredClone(chapter); changed.title = 'A new title'; context.fromStoryJson(changed);
  assert.equal(context.draft.runtimeStory.storyId, 'existing'); assert.equal(context.draft.title, 'A new title');
  assert.equal(context.draft.runtimeStory.savedDocument, JSON.stringify(chapter));
  const before = JSON.stringify(context.draft); assert.throws(() => context.fromStoryJson(examplePackage()), /packageInChapter/); assert.equal(JSON.stringify(context.draft), before);
});
