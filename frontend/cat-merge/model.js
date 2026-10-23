// All positions are logical pixels: resizing the page never changes the physics.
export const BOWL = Object.freeze({ x: 240, y: 320, radius: 210, neck: 74, top: 22, line: 154 });
export const LEVELS = Object.freeze([
  { name: 'Персик', radius: 18, note: 0 }, { name: 'Ночка', radius: 24, note: 1 },
  { name: 'Облачко', radius: 31, note: 2 }, { name: 'Мокко', radius: 39, note: 3 },
  { name: 'Плюш', radius: 49, note: 4 }, { name: 'Ириска', radius: 60, note: 5 },
  { name: 'Луна', radius: 73, note: 9 }, { name: 'Булочка', radius: 88, note: 11 },
  { name: 'Фисташка', radius: 105, note: 12 },
]);
export const STEP = 1 / 120, DANGER_SECONDS = 3, DROP_DELAY = .65;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class CatGame {
  constructor(random = Math.random) {
    this.random = random; this.cats = []; this.selected = 0;
    this.aim = BOWL.x; this.score = 0; this.merges = 0; this.drops = 0;
    this.highest = 0; this.time = 0; this.cooldown = 0; this.danger = 0;
    this.status = 'ready'; this.nextId = 1; this.accumulator = 0; this.events = [];
    this.offers = this.deal();
  }
  select(index) {
    if (!Number.isInteger(index) || index < 0 || index > 2 || !['ready', 'playing'].includes(this.status)) return false;
    this.selected = index; this.setAim(this.aim); return true;
  }
  setAim(x) {
    if (!Number.isFinite(x)) return;
    const r = LEVELS[this.offers[this.selected]].radius;
    this.aim = clamp(x, BOWL.x - BOWL.neck + r + 3, BOWL.x + BOWL.neck - r - 3);
  }
  canDrop() {
    if (!['ready', 'playing'].includes(this.status) || this.cooldown > 0) return false;
    const r = LEVELS[this.offers[this.selected]].radius;
    return this.cats.every(c => Math.hypot(c.x - this.aim, c.y - 64) >= c.r + r + 1);
  }
  drop() {
    if (!this.canDrop()) return false;
    const level = this.offers[this.selected];
    // A tiny alternating hop breaks the artificial perfect vertical symmetry:
    // round cats roll off one another instead of balancing in an empty bottle.
    this.cats.push(this.makeCat(level, this.aim, 64, Math.sin(this.nextId * 2.399963) * 14, 50));
    this.status = 'playing'; this.drops++; this.cooldown = DROP_DELAY;
    this.highest = Math.max(this.highest, level);
    this.events.push({ type: 'drop', level });
    this.offers = this.deal();
    this.setAim(this.aim); return true;
  }
  deal() {
    return Array.from({ length: 3 }, () => {
      const pick = this.random();
      return pick < .45 ? 0 : pick < .8 ? 1 : pick < .96 || this.highest < 4 ? 2 : 3;
    });
  }
  makeCat(level, x, y, vx = 0, vy = 0) {
    return { id: this.nextId++, level, r: LEVELS[level].radius, x, y, vx, vy, age: 0 };
  }
  pause() { if (this.status === 'playing') { this.status = 'paused'; this.accumulator = 0; } }
  resume() { if (this.status === 'paused') this.status = 'playing'; }
  advance(seconds) {
    if (this.status !== 'playing' || !Number.isFinite(seconds) || seconds <= 0) return;
    // A stalled/hidden tab cannot fast-forward through an entire losing countdown.
    this.accumulator += Math.min(seconds, .1);
    while (this.accumulator >= STEP && this.status === 'playing') {
      this.tick(STEP); this.accumulator -= STEP;
    }
  }
  tick(dt) {
    this.time += dt; this.cooldown = Math.max(0, this.cooldown - dt);
    for (const c of this.cats) {
      c.age += dt; c.vy += 420 * dt;
      const friction = Math.exp(-.24 * dt);
      c.vx *= friction; c.vy *= friction;
      c.x += clamp(c.vx, -550, 550) * dt; c.y += clamp(c.vy, -550, 550) * dt;
      this.confine(c);
    }
    // Resolve overlaps several times, but allow each body to merge only once per step.
    const merged = new Set();
    for (let pass = 0; pass < 6; pass++) {
      for (let i = 0; i < this.cats.length; i++) {
        const a = this.cats[i];
        for (let j = i + 1; j < this.cats.length; j++) {
          const b = this.cats[j];
          const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
          if (distance > a.r + b.r) continue;
          if (a.level === b.level && a.level < LEVELS.length - 1 && !merged.has(a.id) && !merged.has(b.id)) {
            const c = this.makeCat(a.level + 1, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.vx + b.vx) / 2, (a.vy + b.vy) / 2 - 35);
            // Merges near the rim do not grant an unlimited new-drop grace period.
            c.age = Math.max(a.age, b.age); this.confine(c);
            this.cats.splice(j, 1); this.cats.splice(i, 1, c); merged.add(c.id);
            this.merges++; this.score += 10 * 2 ** c.level; this.highest = Math.max(this.highest, c.level);
            this.events.push({ type: 'merge', level: c.level, x: c.x, y: c.y });
            if (c.level === LEVELS.length - 1) { this.status = 'won'; return; }
            // a was replaced: resolve its new neighbours on the next solver pass.
            break;
          }
          const nx = distance > .001 ? dx / distance : 1, ny = distance > .001 ? dy / distance : 0;
          const invA = 1 / (a.r * a.r), invB = 1 / (b.r * b.r), sum = invA + invB;
          const overlap = a.r + b.r - distance;
          a.x -= nx * overlap * invA / sum; a.y -= ny * overlap * invA / sum;
          b.x += nx * overlap * invB / sum; b.y += ny * overlap * invB / sum;
          const speed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (speed < 0) {
            const impulse = -(1 + (speed < -45 ? .42 : 0)) * speed / sum;
            a.vx -= impulse * invA * nx; a.vy -= impulse * invA * ny;
            b.vx += impulse * invB * nx; b.vy += impulse * invB * ny;
          }
        }
      }
      for (const c of this.cats) this.confine(c);
    }
    const overflowing = this.cats.some(c => c.age > 1.6 && c.y - c.r < BOWL.line);
    this.danger = overflowing ? this.danger + dt : 0;
    if (this.danger >= DANGER_SECONDS) this.status = 'lost';
  }
  confine(c) {
    if (c.y - c.r < BOWL.top) { c.y = BOWL.top + c.r; c.vy = Math.abs(c.vy) * .3; }
    const dx = c.x - BOWL.x, dy = c.y - BOWL.y;
    const inNeck = Math.abs(dx) + c.r <= BOWL.neck && c.y < BOWL.y;
    if (inNeck) return;
    if (c.y < 124 && c.r <= BOWL.neck) {
      const x = clamp(c.x, BOWL.x - BOWL.neck + c.r, BOWL.x + BOWL.neck - c.r);
      if (x !== c.x) c.vx *= -.4;
      c.x = x; return;
    }
    const distance = Math.hypot(dx, dy), limit = BOWL.radius - c.r;
    if (distance > limit) {
      const nx = dx / distance, ny = dy / distance;
      c.x = BOWL.x + nx * limit; c.y = BOWL.y + ny * limit;
      const outward = c.vx * nx + c.vy * ny;
      if (outward > 0) {
        c.vx -= (1 + (outward > 40 ? .45 : 0)) * outward * nx;
        c.vy -= (1 + (outward > 40 ? .45 : 0)) * outward * ny;
        c.vx *= .985;
      }
    }
  }
  takeEvents() { return this.events.splice(0); }
}
