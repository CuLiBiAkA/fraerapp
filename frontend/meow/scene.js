import { catSVG } from './cats.js';

export class CatScene {
  constructor(element, notes) {
    this.element = element; this.notes = notes; this.active = new Map(); this.serial = 0;
    const idle = document.querySelector('.idle-cats');
    idle.innerHTML = [notes[4], notes[0], notes[2]].map(n => `<div class="idle-cat">${catSVG(n.cat, `idle-${n.id}`)}</div>`).join('');
  }
  start(note) {
    const previous = this.active.get(note.id);
    if (previous) { previous.remove(); this.active.delete(note.id); }
    const el = document.createElement('div'); el.className = 'cat singing entering';
    el.dataset.note = note.id;
    el.innerHTML = `<div class="cat-illustration">${catSVG(note.cat, ++this.serial)}</div><span class="cat-name">${note.cat.name} <b>${note.note}</b></span>`;
    el.style.setProperty('--sway', `${.65 + note.id % 4 * .13}s`);
    this.element.append(el); this.active.set(note.id, el); this.layout();
    el.addEventListener('animationend', event => { if (event.animationName === 'arrive') el.classList.remove('entering'); });
    return {
      release: () => el.classList.add('leaving'),
      end: () => {
        el.classList.remove('singing'); el.remove();
        if (this.active.get(note.id) === el) this.active.delete(note.id);
        this.layout();
      },
    };
  }
  layout() {
    const count = this.active.size;
    this.element.parentElement.classList.toggle('has-cats', count > 0);
    this.element.dataset.count = count;
    const columns = Math.min(count, matchMedia('(max-width: 600px)').matches ? 5 : 7);
    this.element.style.setProperty('--columns', Math.max(1, columns));
    this.element.dataset.rows = columns ? Math.ceil(count / columns) : 0;
    [...this.active].sort((a, b) => a[0] - b[0]).forEach(([, el]) => this.element.append(el));
  }
  reset() { this.active.clear(); this.element.replaceChildren(); this.layout(); }
}
