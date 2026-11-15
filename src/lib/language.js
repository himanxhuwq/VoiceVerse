// Story languages: English, Hindi and Bengali. A story's language is detected from its
// script (Devanagari or Bengali), so it needs no AI and works offline.

export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
];

export const langInfo = (code) => LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
export const langName = (code) => langInfo(code).name;

const SCRIPTS = [
  ['hi', /[\u0900-\u097F]/g], // Devanagari
  ['bn', /[\u0980-\u09FF]/g], // Bengali
  ['en', /[A-Za-z]/g],
];

const count = (text, re) => (text.match(re) || []).length;

/** The language a story is written in, from its script ('en' when unsure or another script). */
export function detectLanguage(text = '') {
  const t = text.slice(0, 4000);
  let best = 'en';
  let bestN = 0;
  for (const [code, re] of SCRIPTS) {
    const n = count(t, re);
    if (n > bestN) [best, bestN] = [code, n];
  }
  return bestN < 12 ? 'en' : best;
}

/** Sentence-ending marks: English . ! ? and the Indic danda । ॥ */
export const SENTENCE_END = '.!?।॥';
