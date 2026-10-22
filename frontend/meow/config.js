// Equal temperament, A4 = 440 Hz. All art and timbres are original to this toy.
const cats = [
  ['Персик', '#e6a160', '#9c583a', 'tabby', 'round', 'point', 'happy'],
  ['Ночка', '#46454f', '#ddd6b9', 'star', 'slim', 'tall', 'wide'],
  ['Облачко', '#fffaf0', '#d1c5b6', 'fluff', 'fluffy', 'small', 'sleepy'],
  ['Мокко', '#d9c2a0', '#65504b', 'siamese', 'slim', 'tall', 'wide'],
  ['Плюш', '#aeb8bd', '#687b85', 'solid', 'round', 'fold', 'sleepy'],
  ['Ириска', '#f7e8d2', '#c98658', 'calico', 'pear', 'point', 'happy'],
  ['Пиксель', '#586575', '#f6eee1', 'tuxedo', 'slim', 'point', 'wide'],
  ['Пудра', '#ddb6b3', '#ab7a80', 'freckles', 'pear', 'small', 'happy'],
  ['Тигра', '#c78d58', '#6e4c38', 'tiger', 'tall', 'tall', 'wide'],
  ['Луна', '#c1bbd5', '#827591', 'moon', 'round', 'point', 'sleepy'],
  ['Клякса', '#f2eee2', '#656568', 'patch', 'pear', 'fold', 'wide'],
  ['Булочка', '#c8aa87', '#927150', 'fluff', 'fluffy', 'small', 'happy'],
  ['Фисташка', '#bcc7a8', '#798a68', 'tabby', 'tall', 'point', 'happy'],
];
const names = ['C4', 'C♯4', 'D4', 'D♯4', 'E4', 'F4', 'F♯4', 'G4', 'G♯4', 'A4', 'A♯4', 'B4', 'C5'];
const keys = ['A', 'W', 'S', 'E', 'D', 'F', 'T', 'G', 'Y', 'H', 'U', 'J', 'K'];
const positions = [0, .67, 1, 1.67, 2, 3, 3.67, 4, 4.67, 5, 5.67, 6, 7];
export const NOTES = cats.map(([name, fur, ink, pattern, shape, ears, eyes], index) => ({
  id: index, note: names[index], key: keys[index], code: `Key${keys[index]}`,
  frequency: 440 * 2 ** ((index - 9) / 12), black: names[index].includes('♯'), position: positions[index],
  cat: { name, fur, ink, pattern, shape, ears, eyes },
  timbre: { formant: .88 + index % 5 * .065, vibrato: 4.3 + index % 4 * .5, breath: .025 + index % 3 * .008 },
}));

export function notesForOctave(octave) {
  const base = [3, 4, 5].includes(octave) ? octave : 4;
  return NOTES.map(note => ({
    ...note,
    note: note.note.replace(/\d$/, String(base + (note.id === 12 ? 1 : 0))),
    frequency: note.frequency * 2 ** (base - 4),
  }));
}
