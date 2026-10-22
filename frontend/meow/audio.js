export const MIN_NOTE = .16;
export const RELEASE = .18;

export class MeowAudio {
  constructor() { this.voices = new Set(); this.volume = .65; this.muted = false; }
  prepare() {
    if (!this.context) {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) throw new Error('В этом браузере нет Web Audio. Попробуйте другой браузер.');
      this.attach(new Audio({ latencyHint: 'interactive' }));
    }
    // Called synchronously from a gesture; never behind a fetch or timer.
    return this.context.state === 'running' ? Promise.resolve() : this.context.resume();
  }
  attach(context) {
    this.context = context;
    let wasRunning = false;
    context.addEventListener('statechange', () => {
      if (context.state === 'running') wasRunning = true;
      else if (wasRunning) this.oninterrupt?.();
    });
    this.master = context.createGain(); this.master.gain.value = this.muted ? 0 : this.volume;
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -16; this.compressor.knee.value = 16;
    this.compressor.ratio.value = 6; this.compressor.attack.value = .003; this.compressor.release.value = .12;
    this.compressor.connect(this.master).connect(context.destination);
    const real = new Float32Array(48), imag = new Float32Array(48);
    for (let i = 1; i < imag.length; i++) imag[i] = 1 / i ** 1.15;
    this.wave = context.createPeriodicWave(real, imag);
  }
  setVolume(volume, muted = this.muted) {
    this.volume = volume; this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : volume, this.context.currentTime, .012);
  }
  start(note, ended = () => {}) {
    const c = this.context, now = c.currentTime;
    // Bound retrigger release tails without restricting the 13-note keyboard.
    if (this.voices.size >= 32) {
      const tail = [...this.voices].find(voice => voice.releasing);
      (tail || this.voices.values().next().value).stop();
    }
    const osc = c.createOscillator(), vibrato = c.createOscillator(), depth = c.createGain();
    osc.setPeriodicWave(this.wave); osc.frequency.value = note.frequency;
    osc.detune.setValueAtTime(-85, now); osc.detune.linearRampToValueAtTime(0, now + .065);
    vibrato.frequency.value = note.timbre.vibrato; depth.gain.value = 7;
    vibrato.connect(depth).connect(osc.detune);
    const envelope = c.createGain(), body = c.createGain();
    envelope.gain.setValueAtTime(0, now); envelope.gain.linearRampToValueAtTime(.25, now + .018);
    envelope.gain.setTargetAtTime(.19, now + .045, .065);
    envelope.connect(this.compressor);
    body.gain.value = note.timbre.breath; osc.connect(body).connect(envelope);
    // Parallel vocal resonances: /m/ -> /ia/ -> sustained /a/, release /u/.
    const filters = [
      [320, 820, 650, 340, 3.8, .8],
      [1900, 1550, 1280, 780, 5, .36],
      [2900, 2700, 2500, 2100, 6, .12],
    ].map(([m, ya, a, u, q, gain]) => {
      const filter = c.createBiquadFilter(), level = c.createGain(), f = note.timbre.formant;
      filter.type = 'bandpass'; filter.Q.value = q; level.gain.value = gain;
      filter.frequency.setValueAtTime(m * f, now);
      filter.frequency.exponentialRampToValueAtTime(ya * f, now + .09);
      filter.frequency.exponentialRampToValueAtTime(a * f, now + .23);
      osc.connect(filter).connect(level).connect(envelope);
      return { filter, level, u: u * f };
    });
    let released = false, stopped = false;
    const hold = (param, time) => {
      if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(time);
      else { const value = param.value; param.cancelScheduledValues(time); param.setValueAtTime(value, time); }
    };
    const voice = {
      startedAt: now,
      get releasing() { return released || stopped; },
      release: () => {
        if (released || stopped) return;
        released = true;
        const at = Math.max(c.currentTime, now + MIN_NOTE);
        hold(envelope.gain, at); envelope.gain.linearRampToValueAtTime(0, at + RELEASE);
        filters.forEach(({ filter, u }) => { hold(filter.frequency, at); filter.frequency.exponentialRampToValueAtTime(u, at + .12); });
        osc.stop(at + RELEASE + .01); vibrato.stop(at + RELEASE + .01);
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        this.voices.delete(voice);
        hold(envelope.gain, c.currentTime); envelope.gain.linearRampToValueAtTime(0, c.currentTime + .015);
        osc.stop(c.currentTime + .02); vibrato.stop(c.currentTime + .02);
      },
    };
    osc.onended = () => {
      this.voices.delete(voice);
      [osc, vibrato, depth, body, envelope, ...filters.flatMap(f => [f.filter, f.level])].forEach(n => n.disconnect());
      ended();
    };
    this.voices.add(voice); osc.start(now); vibrato.start(now);
    return voice;
  }
  stopAll() { for (const voice of this.voices) voice.stop(); }
}
