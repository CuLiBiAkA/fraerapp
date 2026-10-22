import test from 'node:test';
import assert from 'node:assert/strict';
import { NoteInput } from './input.js';

test('a note is held until both keyboard and pointer release it', () => {
  const events = [];
  const input = new NoteInput(n => events.push(['on', n]), n => events.push(['off', n]));
  input.press('KeyA', 0); input.press('KeyA', 0); input.press('pointer:1', 0);
  input.release('KeyA'); assert.deepEqual(events, [['on', 0]]);
  input.release('pointer:1'); assert.deepEqual(events, [['on', 0], ['off', 0]]);
});

test('13 voices, cancellation, and a fresh retrigger after reset', () => {
  const active = new Set();
  const input = new NoteInput(n => active.add(n), n => active.delete(n));
  for (let i = 0; i < 13; i++) input.press(`pointer:${i}`, i);
  assert.equal(active.size, 13);
  input.reset(); assert.equal(active.size, 0);
  input.release('pointer:1'); input.press('KeyW', 1);
  assert.deepEqual([...active], [1]);
});
