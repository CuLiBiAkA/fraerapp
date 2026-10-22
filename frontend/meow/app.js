import { NOTES, notesForOctave } from './config.js?v=2';
import { MeowAudio, MIN_NOTE } from './audio.js?v=6';
import { NoteInput, bindInput } from './input.js?v=2';
import { CatScene } from './scene.js?v=2';
import { renderPiano } from './piano.js';
import { mountSettings } from './settings.js';
import { recordVisit } from './visits.js';

recordVisit();

const piano = document.querySelector('#piano'), status = document.querySelector('#audio-status');
const audio = new MeowAudio(), scene = new CatScene(document.querySelector('#cats'), NOTES);
const showKey = renderPiano(piano, NOTES), entries = new Map();
let generation = 0, previewTimer, notes = NOTES;
const timers = new Set();
function release(entry) {
  if (!entry.voice || entry.released) return;
  entry.released = true; const duration = entry.voice.release();
  const wait = Math.max(0, (entry.voice.startedAt + MIN_NOTE - audio.context.currentTime) * 1000);
  const timer = setTimeout(() => { entry.cat.release(duration); timers.delete(timer); }, wait);
  timers.add(timer);
}
const input = new NoteInput(id => {
  showKey(id, true);
  const entry = { held: true }, epoch = generation;
  entries.set(id, entry);
  status.textContent = audio.context?.state === 'running' ? 'Играем! Можно нажать несколько клавиш сразу' : 'Включаем звук…';
  try {
    audio.prepare().then(() => {
      if (epoch !== generation) return;
      if (audio.context.state !== 'running') throw new Error('Нажмите клавишу ещё раз, чтобы включить звук.');
      entry.cat = scene.start(notes[id]);
      entry.voice = audio.start(notes[id], () => entry.cat.end());
      status.textContent = audio.muted || audio.volume === 0 ? 'Звук выключен — котики всё равно поют' : 'Играем! Можно нажать несколько клавиш сразу';
      if (!entry.held) release(entry);
    }).catch(error => { if (epoch === generation) fail(error); });
  } catch (error) { fail(error); }
}, id => {
  showKey(id, false);
  const entry = entries.get(id);
  if (entry) { entry.held = false; release(entry); entries.delete(id); }
});
function reset() {
  generation++; input.reset(); entries.clear();
  timers.forEach(clearTimeout); timers.clear(); audio.stopAll(); scene.reset();
}
function fail(error) {
  reset(); status.textContent = error.message || 'Звук не включился. Нажмите «Включить звук» и попробуйте снова.';
  document.querySelector('#enable-audio').hidden = false;
}
bindInput(piano, NOTES, input, reset);
window.addEventListener('resize', () => scene.layout());
document.querySelector('#enable-audio').addEventListener('click', async event => {
  try { await audio.prepare(); event.target.hidden = true; status.textContent = 'Звук готов. Нажимайте клавиши!'; }
  catch (error) { fail(error); }
});
mountSettings({
  audio,
  onOctave: octave => {
    reset(); notes = notesForOctave(octave); renderPiano(piano, notes);
    document.querySelector('#octave-label').textContent = `C${octave} — C${octave + 1}`;
    document.querySelector('.instrument').setAttribute('aria-label', `Пианино от C${octave} до C${octave + 1}`);
  },
  onPreview: () => {
    if (previewTimer) { clearTimeout(previewTimer); timers.delete(previewTimer); }
    input.press('preview', 0);
    previewTimer = setTimeout(() => { input.release('preview'); timers.delete(previewTimer); previewTimer = null; }, 350);
    timers.add(previewTimer);
  },
});
// Native audio interruptions (e.g. a phone call) must not leave visual held notes.
audio.oninterrupt = reset;
