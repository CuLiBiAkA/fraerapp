import test from 'node:test';
import assert from 'node:assert/strict';
import { CatGame, LEVELS, BOWL, STEP } from './model.js';
const advance = (g, seconds) => { for (let i = 0; i < Math.ceil(seconds / STEP); i++) g.advance(STEP); };
function pair(a, b = a) {
  const g = new CatGame(); g.status = 'playing';
  g.cats = [g.makeCat(a, 210, 330), g.makeCat(b, 220, 330)]; return g;
}
test('exactly three choices, aim clamps, one drop per cooldown, no drops after end', () => {
  const g = new CatGame(() => .6); g.select(2); g.setAim(-1000);
  assert.equal(g.aim, BOWL.x - BOWL.neck + LEVELS[1].radius + 3);
  assert.equal(g.select(3), false); assert.ok(g.drop()); assert.equal(g.drop(), false);
  assert.equal(g.cats[0].level, 1); assert.deepEqual(g.offers, [1, 1, 1]);
  advance(g, .8); assert.ok(g.drop()); assert.equal(g.drops, 2);
  g.status = 'lost'; assert.equal(g.drop(), false);
});
test('equal cats merge once and score; unequal cats collide without merging', () => {
  const g = pair(0); g.advance(STEP); assert.equal(g.cats.length, 1);
  assert.equal(g.cats[0].level, 1); assert.equal(g.merges, 1); assert.equal(g.score, 20);
  const h = pair(0, 1); h.advance(STEP); assert.equal(h.cats.length, 2); assert.equal(h.score, 0);
});
test('a newly merged cat cannot be consumed twice in the same step', () => {
  const g = pair(0); g.cats.push(g.makeCat(1, 215, 330)); g.advance(STEP);
  assert.equal(g.merges, 1);
  g.cats[1].x = g.cats[0].x + 47; g.cats[1].y = g.cats[0].y;
  g.advance(STEP); assert.equal(g.merges, 2);
  assert.equal(g.cats.length, 1); assert.equal(g.cats[0].level, 2);
});
test('the ninth cat wins and terminal state never changes', () => {
  const g = pair(7); g.advance(STEP); assert.equal(g.status, 'won');
  const score = g.score; advance(g, 10); assert.equal(g.score, score); assert.equal(g.drop(), false);
});
test('rim grace, continuous three-second warning, reset when clear and pause', () => {
  const g = new CatGame(); g.status = 'playing';
  const c = g.makeCat(0, 240, 110); g.cats = [c];
  const hold = (seconds) => { for (let i = 0; i < seconds / STEP; i++) { c.y = 110; c.vy = 0; g.advance(STEP); } };
  hold(1.5); assert.equal(g.danger, 0); hold(2); assert.ok(g.danger > 1);
  g.pause(); const time = g.time; g.advance(100); assert.equal(g.time, time);
  g.resume(); c.y = 350; g.advance(STEP); assert.equal(g.danger, 0);
  hold(3.1); assert.equal(g.status, 'lost');
});
test('long frame capped and fixed timestep independent of normal frame rate', () => {
  const a = new CatGame(() => .2), b = new CatGame(() => .2); a.drop(); b.drop();
  for (let i = 0; i < 120; i++) a.advance(1 / 60);
  for (let i = 0; i < 60; i++) b.advance(1 / 30);
  assert.ok(Math.abs(a.cats[0].y - b.cats[0].y) < .001);
  const t = a.time; a.advance(30); assert.ok(a.time - t <= .101);
});
test('repeated centred drops spread across the bowl rather than balancing in a tower', () => {
  for (const seed of [1, 5]) {
    let value = seed;
    const g = new CatGame(() => ((value = (1664525 * value + 1013904223) >>> 0) / 2 ** 32));
    for (let i = 0; i < 250 && ['ready', 'playing'].includes(g.status); i++) {
      g.select(i % 3); g.drop(); advance(g, .75); g.takeEvents();
    }
    assert.ok(g.drops > 40, 'Default aim must not lose to an artificial balanced tower');
    assert.ok(Math.max(...g.cats.map(c => c.x)) - Math.min(...g.cats.map(c => c.x)) > 120);
    assert.ok(['lost', 'won'].includes(g.status));
  }
});
test('seeded full games stay finite, bounded, playable and terminate on crowding', () => {
  let seed = 42; const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32);
  for (let run = 0; run < 10; run++) {
    const g = new CatGame(random);
    for (let i = 0; i < 600 && ['ready', 'playing'].includes(g.status); i++) {
      g.select(Math.floor(random() * 3)); g.setAim(170 + random() * 140); g.drop(); advance(g, 1.2);
      for (const c of g.cats) {
        assert.ok([c.x, c.y, c.vx, c.vy].every(Number.isFinite));
        assert.ok(c.y + c.r <= BOWL.y + BOWL.radius + .01);
        assert.ok(c.x - c.r >= BOWL.x - BOWL.radius - .01 && c.x + c.r <= BOWL.x + BOWL.radius + .01);
      }
      g.takeEvents();
    }
    assert.ok(['won', 'lost'].includes(g.status)); assert.ok(g.drops >= 10); assert.ok(g.merges > 0);
  }
});
