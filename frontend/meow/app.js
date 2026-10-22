import { NOTES } from './config.js';
import { MeowAudio, MIN_NOTE } from './audio.js?v=3';
import { NoteInput, bindInput } from './input.js';
import { CatScene } from './scene.js';
import { renderPiano } from './piano.js';

const piano = document.querySelector('#piano'), status = document.querySelector('#audio-status');
const audio = new MeowAudio(), scene = new CatScene(document.querySelector('#cats'), NOTES);
const showKey = renderPiano(piano, NOTES), entries = new Map();
let generation = 0, muted = false;
const timers = new Set();
function release(entry) {
  if (!entry.voice || entry.released) return;
  entry.released = true; entry.voice.release();
  const wait = Math.max(0, (entry.voice.startedAt + MIN_NOTE - audio.context.currentTime) * 1000);
  const timer = setTimeout(() => { entry.cat.release(); timers.delete(timer); }, wait);
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
      entry.cat = scene.start(NOTES[id]);
      entry.voice = audio.start(NOTES[id], () => entry.cat.end());
      status.textContent = muted ? 'Звук выключен — котики всё равно поют' : 'Играем! Можно нажать несколько клавиш сразу';
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
const volume = document.querySelector('#volume'), mute = document.querySelector('#mute');
function updateVolume() {
  audio.setVolume(Number(volume.value) / 100, muted);
  mute.setAttribute('aria-pressed', String(muted));
  mute.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
  mute.innerHTML = muted || Number(volume.value) === 0 ? '♪<span class="mute-slash">/</span>' : '♫';
  document.querySelector('#volume-value').textContent = `${muted ? 0 : volume.value}%`;
  status.textContent = muted || Number(volume.value) === 0 ? 'Звук выключен — котики всё равно поют' : 'Нажмите любую клавишу — звук включится';
}
mute.addEventListener('click', () => { muted = !muted; updateVolume(); });
volume.addEventListener('input', () => { muted = false; updateVolume(); });
// Native audio interruptions (e.g. a phone call) must not leave visual held notes.
audio.oninterrupt = reset;
