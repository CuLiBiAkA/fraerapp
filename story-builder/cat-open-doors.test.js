import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const packageUrl = new URL('./scenarios/koshka-i-otkrytye-dveri.package.json', import.meta.url);
const bundle = JSON.parse(fs.readFileSync(packageUrl, 'utf8'));
const app = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');

// Exercise the functions used by the live editor, including its scope resolver.
function editor() {
  const context = vm.createContext({draft: {}, structuredClone, render() {}, t: key => key});
  for (const name of ['fromStoryJson', 'toStoryJson', 'serializeVariable', 'serializeConditions',
    'serializeEffects', 'variableType', 'variableValue', 'detectType', 'coerceValue',
    'parseMetadata', 'parseCondition', 'parseEffects', 'defaultValue', 'validateStory',
    'extractTextVariables', 'duplicates']) {
    const declaration = app.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));
    assert.ok(declaration, name);
    vm.runInContext(declaration[0], context);
  }
  return context;
}

test('the cat package contains one serial story, ordered seasons and portable chapters', () => {
  assert.equal(bundle.kind, 'fraerapp-work-package');
  assert.equal(bundle.schemaVersion, 1);
  assert.equal(bundle.collections.length, 1);
  const work = bundle.collections[0];
  assert.equal(work.schemaVersion, 2);
  assert.equal(work.completionStatus, 'completed');
  assert.equal(work.items.length, 3);
  assert.equal(new Set(work.items.map(item => item.season)).size, 2);
  assert.deepEqual(work.items.map(item => item.target.key), bundle.scenarios.map(chapter => chapter.key));
  bundle.scenarios.forEach((chapter, i) => {
    const standalone = JSON.parse(fs.readFileSync(new URL(`./scenarios/koshka-i-otkrytye-dveri-${i + 1}.json`, import.meta.url), 'utf8'));
    assert.deepEqual(standalone, chapter, 'package and individual import files must not drift');
    assert.equal(chapter.scenes.length, 10);
  });
});

test('every chapter survives actual Builder import, validation and JSON export without loss', () => {
  const context = editor();
  for (const chapter of bundle.scenarios) {
    context.fromStoryJson(structuredClone(chapter));
    assert.deepEqual(Array.from(context.validateStory(chapter)), [], chapter.key);
    assert.deepEqual(JSON.parse(JSON.stringify(context.toStoryJson())), chapter, chapter.key);
  }
});

test('media resolves to real local files and WAV cues have playable PCM headers', () => {
  const assets = bundle.scenarios.flatMap(chapter => [...chapter.assets, ...chapter.scenes.flatMap(scene => scene.assets)]);
  assets.push({url: bundle.collections[0].coverUrl, type: 'image'});
  for (const asset of assets) {
    assert.match(asset.url, /^\/assets\//);
    const content = fs.readFileSync(new URL(`../frontend${asset.url}`, import.meta.url));
    assert.ok(content.length > 40, asset.url);
    if (asset.type === 'music' || asset.type === 'sound') {
      assert.equal(content.toString('ascii', 0, 4), 'RIFF');
      assert.equal(content.toString('ascii', 8, 12), 'WAVE');
      assert.equal(content.readUInt16LE(20), 1, 'uncompressed PCM');
      assert.equal(content.readUInt16LE(22), 1, 'mono');
    }
  }
});

test('the fixture exercises the complete current declarative feature vocabulary', () => {
  const scenes = bundle.scenarios.flatMap(chapter => chapter.scenes);
  const choices = scenes.flatMap(scene => scene.choices);
  assert.deepEqual([...new Set(choices.flatMap(choice => choice.conditions.map(condition => condition.op)))].sort(), ['!=', '<', '<=', '==', '>', '>=']);
  assert.ok(choices.some(choice => choice.conditions.length > 1));
  assert.ok(choices.some(choice => choice.fallbackTarget));
  assert.ok(scenes.some(scene => scene.choices.some(choice => choice.target === scene.id)));
  assert.ok(scenes.some(scene => scene.animation.type === 'fade-in'));
  assert.ok(scenes.some(scene => !scene.animation.type && !scene.background && !scene.music));
  assert.deepEqual([...new Set(scenes.filter(scene => scene.ending).map(scene => scene.ending.type))].sort(), ['comic', 'good', 'neutral']);
  const relations = bundle.scenarios.flatMap(chapter => chapter.metadata.relations);
  assert.deepEqual([...new Set(relations.map(relation => relation.type))].sort(), ['branch', 'prequel', 'related', 'sequel']);
  for (const kind of ['set', 'inc']) {
    assert.ok(scenes.some(scene => scene.effects.some(effect => kind in effect)));
    assert.ok(choices.some(choice => choice.effects.some(effect => kind in effect)));
  }
  const scope = scenes.find(scene => scene.id === 'wardrobe');
  assert.notEqual(scope.assets.find(asset => asset.id === 'room').url, bundle.scenarios[0].assets.find(asset => asset.id === 'room').url);
  assert.notEqual(scope.assets.find(asset => asset.id === 'purr').url, bundle.scenarios[0].assets.find(asset => asset.id === 'purr').url);
  assert.equal(scope.variables.эхо, 'шкаф');
  assert.equal(bundle.scenarios[0].variables.эхо, 'дом');
});

test('each chapter has a connected graph and every scene can reach an ending', () => {
  for (const chapter of bundle.scenarios) {
    const byId = new Map(chapter.scenes.map(scene => [scene.id, scene]));
    assert.equal(byId.size, chapter.scenes.length);
    const targets = scene => scene.choices.flatMap(choice => [choice.target, choice.fallbackTarget].filter(Boolean));
    const seen = new Set();
    const pending = [chapter.startSceneId];
    while (pending.length) {
      const id = pending.pop();
      if (seen.has(id)) continue;
      assert.ok(byId.has(id), `missing ${id}`);
      seen.add(id);
      pending.push(...targets(byId.get(id)));
    }
    assert.equal(seen.size, chapter.scenes.length, chapter.key);
    const finishable = new Set(chapter.scenes.filter(scene => scene.ending).map(scene => scene.id));
    let changed;
    do {
      changed = false;
      for (const scene of chapter.scenes) {
        if (!finishable.has(scene.id) && targets(scene).some(id => finishable.has(id))) {
          finishable.add(scene.id); changed = true;
        }
      }
    } while (changed);
    assert.equal(finishable.size, chapter.scenes.length, 'no structural soft-locks');
  }
});
