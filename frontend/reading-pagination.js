// Presentation limits shared by the reader and Builder; story text stays intact.
export const READING_PAGE_CHARACTERS = 500;
export const READING_PAGE_CHOICES = 4;
export const CHOICE_LABEL_GUIDANCE = 100;

export function splitReadingText(value, { fits = () => true, limit = READING_PAGE_CHARACTERS } = {}) {
  const text = String(value ?? '');
  const characters = Array.from(text);
  const pages = [];
  let index = 0, offset = 0;
  const cap = Math.max(1, Math.floor(Number(limit) || READING_PAGE_CHARACTERS));
  while (index < characters.length) {
    const remaining = characters.slice(index, index + cap);
    let low = 1, high = remaining.length, count = 1;
    // When one line cannot fit (e.g. extreme zoom), retain accessible scrolling.
    if (!fits(remaining[0].trim())) count = high;
    else {
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        if (fits(remaining.slice(0, middle).join('').trim())) { count = middle; low = middle + 1; }
        else high = middle - 1;
      }
    }
    let chunk = remaining.slice(0, count).join('');
    if (index + count < characters.length) {
      const floor = Math.floor(chunk.length * .5);
      const boundaries = [/\n\s*\n/g, /[.!?…][»”"')]*\s+/g, /\s+/g];
      for (const pattern of boundaries) {
        const candidates = [...chunk.matchAll(pattern)].map(match => match.index + match[0].length).filter(end => end >= floor);
        if (candidates.length) { chunk = chunk.slice(0, candidates.at(-1)); break; }
      }
    }
    pages.push({ text: chunk, start: offset, end: offset + chunk.length });
    index += Array.from(chunk).length;
    offset += chunk.length;
  }
  return pages.length ? pages : [{ text: '', start: 0, end: 0 }];
}
