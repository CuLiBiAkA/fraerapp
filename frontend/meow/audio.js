export const MIN_NOTE = .16;
export const RELEASE = .18;

export class MeowAudio {
  constructor() { this.voices = new Set(); this.volume = .65; this.muted = false; this.tone = .5; }
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
  setTone(value) {
    if (!Number.isFinite(value)) return;
    this.tone = Math.max(0, Math.min(1, value));
    for (const voice of this.voices) voice.setTone(this.tone);
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
    osc.detune.setValueAtTime(-140, now);
    osc.detune.linearRampToValueAtTime(35, now + .09);
    osc.detune.linearRampToValueAtTime(0, now + .18);
    vibrato.frequency.value = note.timbre.vibrato; depth.gain.value = 7;
    vibrato.connect(depth).connect(osc.detune);
    const envelope = c.createGain(), body = c.createGain();
    const nasal = c.createBiquadFilter(), nasalMix = c.createGain(), oral = c.createGain();
    envelope.gain.setValueAtTime(0, now); envelope.gain.linearRampToValueAtTime(.25, now + .025);
    envelope.gain.setTargetAtTime(.19, now + .045, .065);
    envelope.connect(this.compressor);
    // A closed-mouth hum precedes the vowels: no broadband/plosive onset.
    nasal.type = 'lowpass'; nasal.frequency.value = note.frequency * 1.6; nasal.Q.value = .6;
    body.gain.setValueAtTime(.6, now);
    body.gain.setTargetAtTime(note.timbre.breath, now + .035, .022);
    osc.connect(nasal).connect(body).connect(nasalMix).connect(envelope);
    nasalMix.gain.value = 1.8 - 1.6 * this.tone;
    oral.gain.setValueAtTime(0, now);
    oral.gain.setValueAtTime(0, now + .025);
    oral.gain.linearRampToValueAtTime(1, now + .085);
    oral.connect(envelope);
    // /m/ -> /i/ -> open /a/. The /u/ arrives early enough in the release to hear.
    const filters = [
      [350, 780, 620, 320, 3.8, .8],
      [2350, 1700, 1350, 720, 5, .36],
      [3100, 2800, 2500, 2050, 6, .12],
    ].map(([m, ya, a, u, q, gain]) => {
      const filter = c.createBiquadFilter(), level = c.createGain(), f = note.timbre.formant;
      filter.type = 'bandpass'; filter.Q.value = q; level.gain.value = gain;
      filter.detune.value = (this.tone - .5) * 900;
      filter.frequency.setValueAtTime(m * f, now);
      filter.frequency.setValueAtTime(m * f, now + .03);
      filter.frequency.exponentialRampToValueAtTime(ya * f, now + .105);
      filter.frequency.exponentialRampToValueAtTime(a * f, now + .2);
      osc.connect(filter).connect(level).connect(oral);
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
      setTone: value => {
        // Change vocal resonances and nasal balance, never the musical oscillator.
        filters.forEach(({ filter }) => filter.detune.setTargetAtTime((value - .5) * 900, c.currentTime, .025));
        nasalMix.gain.setTargetAtTime(1.8 - 1.6 * value, c.currentTime, .025);
      },
      release: () => {
        if (released || stopped) return;
        released = true;
        const at = Math.max(c.currentTime, now + MIN_NOTE);
        hold(envelope.gain, at);
        envelope.gain.linearRampToValueAtTime(.16, at + .055);
        envelope.gain.linearRampToValueAtTime(0, at + RELEASE);
        filters.forEach(({ filter, u }) => { hold(filter.frequency, at); filter.frequency.exponentialRampToValueAtTime(u, at + .055); });
        body.gain.setTargetAtTime(.12, at, .02);
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
      [osc, vibrato, depth, body, nasal, nasalMix, oral, envelope, ...filters.flatMap(f => [f.filter, f.level])].forEach(n => n.disconnect());
      ended();
    };
    this.voices.add(voice); osc.start(now); vibrato.start(now);
    return voice;
  }
  stopAll() { for (const voice of this.voices) voice.stop(); }
}
