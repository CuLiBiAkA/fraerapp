import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, DEFAULT_SETTINGS, loadSettings } from './settings.js';
import { notesForOctave, NOTES } from './config.js';

test('saved settings reject malformed values and bound audio controls', () => {
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({ tone: '100', octave: 10, volume: NaN, release: Infinity, muted: 'false' }), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({ tone: -50, octave: 3, volume: 150, release: 900, muted: true }),
    { tone: 0, octave: 3, volume: 100, release: 600, muted: true });
});

test('octave transposes all 13 voices and labels without mutating the base notes', () => {
  for (const octave of [3, 4, 5]) {
    const notes = notesForOctave(octave);
    assert.equal(notes[0].note, `C${octave}`); assert.equal(notes[12].note, `C${octave + 1}`);
    for (let i = 0; i < 13; i++) {
      assert.equal(notes[i].frequency, NOTES[i].frequency * 2 ** (octave - 4));
      assert.equal(notes[i].code, NOTES[i].code);
    }
  }
  assert.equal(NOTES[0].note, 'C4'); assert.equal(notesForOctave(99)[0].note, 'C4');
});

test('legacy tone zero survives migration; invalid or unavailable storage uses defaults', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => key.endsWith('.tone') ? '0' : null } });
    assert.equal(loadSettings().tone, 0);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => '{invalid' } });
    assert.deepEqual(loadSettings(), DEFAULT_SETTINGS);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('disabled'); } });
    assert.deepEqual(loadSettings(), DEFAULT_SETTINGS);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});
