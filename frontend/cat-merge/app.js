import { CatGame, LEVELS, BOWL, DANGER_SECONDS } from './model.js?v=1';
import { catSVG } from '../meow/cats.js';
import { NOTES } from '../meow/config.js?v=2';
import { MeowAudio } from '../meow/audio.js?v=6';
import { createAnalytics } from './analytics.js?v=1';

const $ = selector => document.querySelector(selector);
const board = $('#board'), bodies = $('#bodies'), offers = $('#offers'), dialog = $('#dialog');
const audio = new MeowAudio(), analytics = createAnalytics(), nodes = new Map();
audio.setTone(1); audio.setVolume(.4); analytics.visit();
let game = new CatGame(), best = 0, discovered = 0, muted = false, finished = false;
let dialogMode = '', previousFocus, last = 0, lastHUD = 0, lastSound = -1;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
try {
  const saved = JSON.parse(localStorage.getItem('fraerapp.cat-merge.settings'));
  if (Number.isSafeInteger(saved?.best) && saved.best >= 0) best = saved.best;
  if (Number.isInteger(saved?.discovered) && saved.discovered >= 0 && saved.discovered < LEVELS.length) discovered = saved.discovered;
  muted = saved?.muted === true;
} catch { /* Play without persistence. */ }
function save() {
  try { localStorage.setItem('fraerapp.cat-merge.settings', JSON.stringify({ best, discovered, muted })); } catch { /* Optional storage. */ }
}
function art(level, id) { return catSVG(NOTES[LEVELS[level].note].cat, 'merge-' + id); }
function soundLabel() {
  audio.setVolume(.4, muted);
  $('#sound').setAttribute('aria-pressed', String(!muted));
  $('#sound').setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
  $('#sound span').textContent = muted ? 'Звук выкл.' : 'Звук вкл.';
}
function prepareSound() {
  if (muted) return;
  try { void audio.prepare().catch(() => { $('#sound-status').textContent = 'Звук недоступен. Можно продолжать играть.'; }); }
  catch { $('#sound-status').textContent = 'Звук недоступен. Можно продолжать играть.'; }
}
function meow(level) {
  if (muted || audio.context?.state !== 'running' || game.time - lastSound < .09) return;
  lastSound = game.time;
  const voice = audio.start(NOTES[LEVELS[level].note]); voice.release();
}
function renderOffers() {
  offers.replaceChildren();
  game.offers.forEach((level, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'offer';
    button.dataset.index = index; button.setAttribute('aria-pressed', String(index === game.selected));
    button.setAttribute('aria-label', `Выбрать: ${LEVELS[level].name}, уровень ${level + 1}, клавиша ${index + 1}`);
    button.innerHTML = art(level, 'offer-' + index) + `<span class="offer-name">${LEVELS[level].name}<small>уровень ${level + 1}</small></span><span class="shortcut">${index + 1}</span>`;
    button.addEventListener('click', () => select(index)); offers.append(button);
  });
  renderAim();
}
function select(index) {
  if (!game.select(index)) return;
  for (const b of offers.children) b.setAttribute('aria-pressed', String(Number(b.dataset.index) === index));
  renderAim();
}
function renderAim() {
  const level = game.offers[game.selected], r = LEVELS[level].radius;
  const ghost = $('#ghost'); ghost.innerHTML = art(level, 'ghost');
  ghost.style.width = `${r * 2 / 480 * 100}%`; ghost.style.height = `${r * 2 / 560 * 100}%`;
  ghost.style.left = `${game.aim / 480 * 100}%`; ghost.style.top = `${64 / 560 * 100}%`; ghost.style.transform = 'translate(-50%,-50%)';
  $('#aim-line').setAttribute('d', `M${game.aim} 90V470`);
  $('#aim').min = BOWL.x - BOWL.neck + r + 3; $('#aim').max = BOWL.x + BOWL.neck - r - 3;
  $('#aim').value = game.aim;
}
function renderLevels() {
  $('#levels').innerHTML = LEVELS.map((level, i) => `<div class="level ${i <= discovered ? 'unlocked' : ''}" title="${level.name}, уровень ${i + 1}${i <= discovered ? ', открыт' : ''}">${art(i, 'level-' + i)}<span data-number="${i + 1}">${level.name}</span></div>`).join('');
  $('#discovered').textContent = `${discovered + 1} / ${LEVELS.length}`;
}
function drop() {
  if (dialog.open) return;
  prepareSound();
  if (!game.drop()) {
    if (game.status === 'playing' && game.cooldown <= 0) $('#play-status').textContent = 'Горлышко занято. Смести прицел или дай котикам улечься.';
    return;
  }
  if (game.drops === 1) analytics.start();
  $('#idle').hidden = true; renderOffers(); renderHUD();
}
function spark(event) {
  if (reducedMotion.matches) return;
  const el = document.createElement('span'); el.className = 'spark'; el.textContent = `+${10 * 2 ** event.level} ✧`;
  el.style.left = `${event.x / 480 * 100}%`; el.style.top = `${event.y / 560 * 100}%`;
  $('#sparks').append(el); el.addEventListener('animationend', () => el.remove(), { once: true });
  // A media-query change can cancel an animation before animationend.
  setTimeout(() => el.remove(), 1000);
}
function renderBodies() {
  const live = new Set(game.cats.map(c => c.id));
  for (const [id, el] of nodes) if (!live.has(id)) { el.remove(); nodes.delete(id); }
  for (const c of game.cats) {
    let el = nodes.get(c.id);
    if (!el) {
      el = document.createElement('div'); el.className = 'bubble'; el.dataset.level = c.level;
      el.style.width = `${c.r * 2 / 480 * 100}%`; el.style.height = `${c.r * 2 / 560 * 100}%`;
      el.style.setProperty('--fur', NOTES[LEVELS[c.level].note].cat.fur + '55');
      el.innerHTML = art(c.level, c.id); nodes.set(c.id, el); bodies.append(el);
    }
    el.style.left = `${c.x / 480 * 100}%`; el.style.top = `${c.y / 560 * 100}%`;
    el.style.transform = `translate(-50%,-50%) rotate(${Math.max(-15, Math.min(15, c.vx * .1))}deg)`;
  }
}
function renderHUD() {
  const playable = ['ready', 'playing'].includes(game.status);
  $('#score').textContent = game.score.toLocaleString('ru-RU'); $('#best').textContent = best.toLocaleString('ru-RU');
  $('#drop').disabled = !game.canDrop(); $('#pause').disabled = game.status !== 'playing'; $('#restart').disabled = game.drops === 0;
  $('#aim').disabled = !playable;
  for (const button of offers.children) button.disabled = !playable;
  $('#ghost').hidden = !playable; $('#aim-line').toggleAttribute('hidden', !playable);
  const danger = game.danger > 0;
  $('.board-wrap').classList.toggle('danger', danger); $('#warning').hidden = !danger;
  const warning = `Тесно! Освободи место · ${Math.max(1, Math.ceil(DANGER_SECONDS - game.danger))} с`;
  if ($('#warning').textContent !== warning) $('#warning').textContent = warning;
  if (game.drops && playable) $('#play-status').textContent = danger ? 'Одинаковые котики помогут освободить место.' : 'Выбирай одного из трёх. Нажми на колбу или «Бросить котика».';
}
function openDialog(mode) {
  if (!dialog.open) previousFocus = document.activeElement;
  dialogMode = mode;
  if (mode === 'pause' || mode === 'restart') { game.pause(); audio.stopAll(); }
  $('#dialog-cat').innerHTML = art(game.highest, 'dialog'); $('#result-metrics').replaceChildren();
  const content = mode === 'pause' ? ['ТИХИЙ ЧАС', 'Котики отдыхают', 'Всё на своих местах. Продолжим, когда будешь готов.', 'Продолжить', 'Начать заново']
    : mode === 'restart' ? ['НОВЫЙ ПРЫЖОК', 'Начнём заново?', 'Текущая партия закончится. Твой рекорд останется.', 'Начать заново', 'Вернуться в игру']
      : game.status === 'won' ? ['ДЕВЯТЬ ЖИЗНЕЙ — ОДНА ПОБЕДА', 'Вот это кот!', 'Фисташка выросла. Ты собрал всю кошачью компанию!', 'Ещё раз', 'Посмотреть колбу']
        : ['КАЖЕТСЯ, МЫ НЕ ПОМЕСТИЛИСЬ', 'Котикам тесно', 'Колба переполнилась. Попробуй соединять крупных котиков пораньше.', 'Попробовать ещё', 'Посмотреть колбу'];
  for (const [id, text] of [['dialog-eyebrow', content[0]], ['dialog-title', content[1]], ['dialog-copy', content[2]], ['dialog-primary', content[3]], ['dialog-secondary', content[4]]]) $('#' + id).textContent = text;
  if (mode === 'result') $('#result-metrics').innerHTML = `<div><strong>${game.score.toLocaleString('ru-RU')}</strong><span>очков</span></div><div><strong>${game.merges}</strong><span>слияний</span></div>`;
  if (!dialog.open) dialog.showModal();
  $('#dialog-primary').focus(); renderHUD();
}
function closeDialog(resume = false) {
  dialog.close(); if (resume) { game.resume(); last = performance.now(); }
  if (previousFocus?.isConnected && !previousFocus.disabled && !dialog.contains(previousFocus)) previousFocus.focus(); else board.focus();
  renderHUD();
}
function restart() {
  if (!finished && game.drops > 0) analytics.finish(game, 'restarted');
  audio.stopAll(); if (dialog.open) dialog.close();
  game = new CatGame(); finished = false; lastSound = -1;
  bodies.replaceChildren(); nodes.clear(); $('#sparks').replaceChildren(); $('#idle').hidden = false;
  $('#play-status').textContent = 'Новая компания ждёт первого прыжка.';
  renderOffers(); renderHUD(); board.focus();
}
$('#dialog-primary').onclick = () => dialogMode === 'pause' ? closeDialog(true) : restart();
$('#dialog-secondary').onclick = () => dialogMode === 'pause' ? openDialog('restart') : closeDialog(dialogMode === 'restart');
dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(dialogMode !== 'result'); });
$('#drop').onclick = drop; $('#pause').onclick = () => openDialog('pause');
$('#restart').onclick = () => finished ? restart() : openDialog('restart');
$('#sound').onclick = () => { muted = !muted; soundLabel(); save(); if (muted) audio.stopAll(); else prepareSound(); };
$('#aim').oninput = event => { game.setAim(Number(event.target.value)); renderAim(); };
let down;
board.addEventListener('pointerdown', event => { if (event.isPrimary && event.button === 0) down = { x: event.clientX, y: event.clientY }; });
board.addEventListener('pointercancel', () => { down = null; });
board.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || !['ready', 'playing'].includes(game.status)) return;
  const rect = board.getBoundingClientRect(); game.setAim((event.clientX - rect.left) / rect.width * 480); renderAim();
});
board.addEventListener('pointerup', event => {
  if (!down || !event.isPrimary) return;
  const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y); down = null;
  if (moved > 18) return; // A vertical scroll is never a drop.
  const rect = board.getBoundingClientRect(); game.setAim((event.clientX - rect.left) / rect.width * 480); renderAim(); drop();
});
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || dialog.open) return;
  if (event.target.matches('input, select, textarea')) return;
  if (/^Digit[123]$/.test(event.code)) { event.preventDefault(); if (!event.repeat) select(Number(event.code.at(-1)) - 1); }
  else if (['ArrowLeft', 'ArrowRight'].includes(event.code)) { event.preventDefault(); game.setAim(game.aim + (event.code === 'ArrowLeft' ? -8 : 8)); renderAim(); }
  else if ((event.code === 'Space' && !event.target.closest('button,a')) || (event.code === 'Enter' && event.target === board)) { event.preventDefault(); if (!event.repeat) drop(); }
  else if (event.code === 'Escape' && game.status === 'playing') openDialog('pause');
});
function backgroundPause() { audio.stopAll(); if (game.status === 'playing') openDialog('pause'); }
document.addEventListener('visibilitychange', () => { if (document.hidden) backgroundPause(); });
window.addEventListener('pagehide', backgroundPause);
function frame(now) {
  game.advance(last ? (now - last) / 1000 : 0); last = now;
  for (const event of game.takeEvents()) { meow(event.level); if (event.type === 'merge') spark(event); }
  if (game.score > best || game.highest > discovered) { best = Math.max(best, game.score); discovered = Math.max(discovered, game.highest); save(); renderLevels(); }
  renderBodies();
  if (!finished && ['lost', 'won'].includes(game.status)) { finished = true; analytics.finish(game, game.status); openDialog('result'); }
  if (now - lastHUD > 100) { renderHUD(); lastHUD = now; }
  requestAnimationFrame(frame);
}
soundLabel(); renderOffers(); renderLevels(); renderHUD(); requestAnimationFrame(frame);
