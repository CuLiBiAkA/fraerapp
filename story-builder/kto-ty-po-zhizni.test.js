import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { validateStory as validateStoryDocument } from './core.js';

const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const story = read('./scenarios/kto-ty-po-zhizni.json');
const bundle = read('./scenarios/kto-ty-po-zhizni.package.json');
const routes = read('./fixtures/kto-ty-po-zhizni-routes.json');
const byId = new Map(story.scenes.map(scene => [scene.id, scene]));
const initial = () => Object.fromEntries(Object.entries(story.variables).map(([key, value]) =>
  [key, value && typeof value === 'object' ? value.value : value]));
const compare = (left, op, right) => ({'==':left === right, '!=':left !== right,
  '>':left > right, '>=':left >= right, '<':left < right, '<=':left <= right})[op];
const available = (scene, values) => scene.choices.filter(choice => choice.conditions.every(condition =>
  compare(values[condition.var], condition.op, condition.value)));
function advance(scene, values, choiceId) {
  const choice = available(scene, values).find(choice => choice.id === choiceId);
  assert.ok(choice, `unavailable ${scene.id}/${choiceId}`);
  for (const effect of choice.effects) {
    if (effect.inc) values[effect.inc] += effect.value;
    else values[effect.set] = effect.value;
  }
  for (const key of ['деньги', 'уважение', 'дела', 'долг']) assert.ok(values[key] >= 0, `${scene.id}/${choiceId}: negative ${key}`);
  return byId.get(choice.target);
}

test('native package and actual Builder import/export preserve the entire game', () => {
  assert.equal(bundle.kind, 'fraerapp-work-package');
  assert.equal(bundle.schemaVersion, 1);
  assert.equal(bundle.collections[0].schemaVersion, 2);
  assert.equal(bundle.collections[0].items[0].target.key, story.key);
  assert.deepEqual(bundle.scenarios, [story]);
  const context = vm.createContext({draft:{}, currentLanguage:'ru', validateStoryDocument,
    structuredClone, render(){}, t:key => key});
  const app = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
  for (const name of ['fromStoryJson','toStoryJson','serializeVariable','serializeConditions',
    'serializeEffects','variableType','variableValue','detectType','coerceValue',
    'parseMetadata','parseCondition','parseEffects','defaultValue','validateStory']) {
    const declaration = app.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));
    assert.ok(declaration, name);
    vm.runInContext(declaration[0], context);
  }
  context.fromStoryJson(structuredClone(story));
  assert.deepEqual(Array.from(context.validateStory(story)), []);
  assert.deepEqual(JSON.parse(JSON.stringify(context.toStoryJson())), story);
});

test('sixty scenes have sixty separate real JPEG illustrations and a valid cover', () => {
  assert.equal(story.scenes.length, 60);
  assert.equal(new Set(story.scenes.map(scene => scene.background)).size, 60);
  const urls = new Set();
  for (const scene of story.scenes) {
    const asset = story.assets.find(asset => asset.id === scene.background);
    assert.ok(asset, scene.id);
    const data = fs.readFileSync(new URL(`../frontend${asset.url}`, import.meta.url));
    assert.equal(data.readUInt16BE(0), 0xffd8, asset.url);
    assert.ok(data.length > 10000 && data.length <= 500000, asset.url);
    urls.add(asset.url);
  }
  assert.equal(urls.size, 60);
  assert.ok(urls.has(bundle.collections[0].coverUrl));
});

test('sixteen witnessed routes cover every scene and reach distinct earned endings', () => {
  const covered = new Set(), endings = new Set();
  for (const route of routes) {
    const values = initial();
    let scene = byId.get(story.startSceneId);
    const visited = [scene.id];
    for (const id of route.choices) { scene = advance(scene, values, id); visited.push(scene.id); }
    assert.equal(scene.id, route.ending);
    assert.ok(scene.ending);
    assert.deepEqual(visited, route.scenes);
    for (const [key, value] of Object.entries(route.expected)) assert.equal(values[key], value, `${route.ending}/${key}`);
    visited.forEach(id => covered.add(id)); endings.add(scene.id);
  }
  assert.equal(covered.size, 60);
  assert.equal(endings.size, 16);
});

test('every scene has an escape path that needs no resources, and all expenses have guards', () => {
  const finishable = new Set(story.scenes.filter(scene => scene.ending).map(scene => scene.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const scene of story.scenes) {
      if (!finishable.has(scene.id) && scene.choices.some(choice => !choice.conditions.length && finishable.has(choice.target))) {
        finishable.add(scene.id); changed = true;
      }
    }
  }
  assert.equal(finishable.size, story.scenes.length, 'a bankrupt player can always finish');
  for (const scene of story.scenes) for (const choice of scene.choices) {
    assert.equal(choice.fallbackTarget, null, 'cost guards must reject the action before applying effects');
    for (const effect of choice.effects) {
      if (effect.value < 0 && ['деньги','уважение','дела','долг'].includes(effect.inc)) {
        assert.ok(choice.conditions.some(c => c.var === effect.inc && ['>=','==','>'].includes(c.op) && c.value >= -effect.value), `${scene.id}/${choice.id}`);
      }
    }
  }
});

test('bounded random play preserves balances, locks repeat jobs and never strands the player', () => {
  let seed = 20261023;
  const random = () => { seed = (Math.imul(seed,1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let run = 0; run < 10000; run++) {
    const values = initial(); let scene = byId.get(story.startSceneId);
    const jobs = new Set();
    for (let step = 0; step < 180 && !scene.ending; step++) {
      const choices = available(scene, values);
      assert.ok(choices.length, scene.id);
      const selected = choices[Math.floor(random() * choices.length)];
      if (scene.id === 'morning' && ['work','load','delivery','cards','roof','neighbor','gym'].includes(selected.id)) {
        assert.ok(!jobs.has(selected.id), `repeated job ${selected.id}`); jobs.add(selected.id);
      }
      scene = advance(scene, values, selected.id);
      assert.ok(values.дела <= 5);
    }
  }
});
