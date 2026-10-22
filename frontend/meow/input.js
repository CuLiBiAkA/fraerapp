// Input ownership is independent of voices: a mouse release cannot stop a held key.
export class NoteInput {
  constructor(on, off) { this.on = on; this.off = off; this.sources = new Map(); }
  press(source, note) {
    if (this.sources.has(source)) return;
    const held = [...this.sources.values()].includes(note);
    this.sources.set(source, note);
    if (!held) this.on(note);
  }
  release(source) {
    if (!this.sources.has(source)) return;
    const note = this.sources.get(source);
    this.sources.delete(source);
    if (![...this.sources.values()].includes(note)) this.off(note);
  }
  reset() {
    const notes = new Set(this.sources.values());
    this.sources.clear();
    notes.forEach(note => this.off(note));
  }
}

export function bindInput(piano, notes, input, reset) {
  const codes = new Map(notes.map(n => [n.code, n.id]));
  const editable = el => el?.closest?.('input:not([type="range"]), textarea, select, [contenteditable="true"]');
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || editable(event.target)) return;
    let note = codes.get(event.code);
    if ((event.code === 'Space' || event.code === 'Enter') && event.target.matches?.('.piano-key')) note = Number(event.target.dataset.note);
    if (note === undefined) return;
    event.preventDefault();
    if (!event.repeat) input.press(event.code, note);
  });
  window.addEventListener('keyup', event => input.release(event.code));
  piano.addEventListener('pointerdown', event => {
    const key = event.target.closest('.piano-key');
    if (!key || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    key.setPointerCapture(event.pointerId);
    input.press(`pointer:${event.pointerId}`, Number(key.dataset.note));
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    piano.addEventListener(name, event => input.release(`pointer:${event.pointerId}`));
  }
  // Assistive technology can activate a button without pointer/key events.
  piano.addEventListener('click', event => {
    const key = event.target.closest('.piano-key');
    if (event.detail !== 0 || !key) return;
    const source = `assistive:${key.dataset.note}`;
    input.press(source, Number(key.dataset.note)); input.release(source);
  });
  window.addEventListener('blur', reset);
  window.addEventListener('pagehide', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
}
