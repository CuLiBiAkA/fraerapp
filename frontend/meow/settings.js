export const DEFAULT_SETTINGS = Object.freeze({ tone: 50, octave: 4, volume: 65, release: 180, muted: false });

export function normalizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  const number = (key, min, max) => typeof source[key] === 'number' && Number.isFinite(source[key])
    ? Math.round(Math.max(min, Math.min(max, source[key]))) : DEFAULT_SETTINGS[key];
  return {
    tone: number('tone', 0, 100), octave: [3, 4, 5].includes(source.octave) ? source.octave : 4,
    volume: number('volume', 0, 100), release: number('release', 80, 600), muted: source.muted === true,
  };
}

export function loadSettings() {
  try {
    const saved = localStorage.getItem('fraerapp.meow.settings');
    if (saved !== null) return normalizeSettings(JSON.parse(saved));
    const legacy = localStorage.getItem('fraerapp.meow.tone');
    return normalizeSettings({ tone: legacy !== null && legacy.trim() !== '' ? Number(legacy) : undefined });
  } catch { return { ...DEFAULT_SETTINGS }; }
}

function saveSettings(settings) {
  try {
    localStorage.setItem('fraerapp.meow.settings', JSON.stringify(settings));
    localStorage.removeItem('fraerapp.meow.tone');
  } catch { /* Disabled/full storage must not stop the instrument. */ }
}

export function mountSettings({ audio, onOctave, onPreview }) {
  let settings = loadSettings(), lastOctave;
  const toggle = document.querySelector('#settings-toggle'), panel = document.querySelector('#settings-panel');
  const mute = document.querySelector('#mute');
  const controls = Object.fromEntries(['tone', 'octave', 'volume', 'release'].map(key => [key, document.getElementById(key)]));
  const apply = () => {
    audio.setTone(settings.tone / 100); audio.setRelease(settings.release / 1000);
    audio.setVolume(settings.volume / 100, settings.muted);
    for (const [key, element] of Object.entries(controls)) element.value = settings[key];
    document.querySelector('#tone-value').textContent = `${settings.tone}%`;
    document.querySelector('#volume-value').textContent = `${settings.muted ? 0 : settings.volume}%`;
    document.querySelector('#release-value').textContent = `${settings.release} мс`;
    controls.tone.setAttribute('aria-valuetext', `${settings.tone}% открытости голоса`);
    controls.release.setAttribute('aria-valuetext', `${settings.release} миллисекунд`);
    mute.setAttribute('aria-pressed', String(settings.muted));
    mute.setAttribute('aria-label', settings.muted ? 'Включить звук' : 'Выключить звук');
    mute.innerHTML = settings.muted || settings.volume === 0 ? '♪<span class="mute-slash">/</span>' : '♫';
    if (lastOctave !== settings.octave) { lastOctave = settings.octave; onOctave(settings.octave); }
    saveSettings(settings);
  };
  for (const [key, element] of Object.entries(controls)) {
    element.addEventListener(key === 'octave' ? 'change' : 'input', () => {
      settings = normalizeSettings({ ...settings, [key]: Number(element.value), ...(key === 'volume' ? { muted: false } : {}) });
      apply();
    });
  }
  mute.addEventListener('click', () => { settings.muted = !settings.muted; apply(); });
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden; toggle.setAttribute('aria-expanded', String(!panel.hidden));
  });
  const close = () => { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); };
  panel.addEventListener('keydown', event => { if (event.code === 'Escape') { event.preventDefault(); close(); } });
  document.querySelector('#settings-close').addEventListener('click', close);
  document.querySelector('#settings-reset').addEventListener('click', () => { settings = { ...DEFAULT_SETTINGS }; apply(); });
  document.querySelector('#preview-note').addEventListener('click', onPreview);
  apply();
}
