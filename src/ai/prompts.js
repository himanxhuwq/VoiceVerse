// Prompt templates sent to the AI (any provider). Kept in one place so they can be read,
// reviewed and tuned without touching the app logic.
import { MOODS, SFX_TYPES } from '../data/constants';
import { langInfo } from '../lib/language';

/** Extra rules when the story is not in English. */
const languageRules = (lang) => {
  if (!lang || lang === 'en') return '';
  const L = langInfo(lang);
  return `\nLanguage: the story is in ${L.name} (${L.native}). Copy every line's text exactly as written, in ${L.name} and its own script; never translate or transliterate it. Write the title, character descriptions, scene titles and summaries in ${L.name} too. Keep JSON keys and the fixed values (mood, emotion, gender, age, role, sfx type) in English as listed.`;
};

/**
 * Story analysis: one call returns the whole structured breakdown
 * (characters, scenes, speaker-tagged lines with emotions, and sound-effect cues).
 */
export function analysisPrompt(text, title, lang = 'en') {
  return `You are the story analyst for an audio-drama studio. Read the story and return ONLY JSON with this shape:
{"title":string,"genre":string,"narration_style":string (max 8 words),
 "characters":[{"name":string,"role":"main"|"side","gender":"male"|"female"|"unknown","age":"child"|"young"|"adult"|"elder"|"ageless","description":string (max 8 words)}],
 "scenes":[{"title":string (2-4 words),"mood":one of ${JSON.stringify(MOODS)},"summary":string (one sentence),
   "lines":[{"speaker":"Narrator" or a character name,"text":string,"emotion":"calm"|"determined"|"afraid"|"joyful"|"whisper"|"sad"|"angry"}],
   "sfx":[{"type":one of ${JSON.stringify(Object.keys(SFX_TYPES))},"line_index":index into this scene's lines where the sound should start}]}]}
Rules: 2 to 5 scenes. The lines across all scenes must cover the WHOLE story in order, word for word, with dialogue split from narration and each dialogue line given to its speaker. Do not include dialogue tags like "she said" as separate lines. Narration lines at most 2 sentences. At most 3 sfx per scene, only sounds the text actually mentions or clearly implies. Do not list "Narrator" in characters.${languageRules(lang)}
${title ? `Title given by the writer: ${title}\n` : ''}STORY:
${text}`;
}

/** Story generation: a short original story written to suit audio drama. */
export function storyPrompt(genre, idea, lang = 'en') {
  const L = langInfo(lang);
  const inLang =
    lang === 'en'
      ? ''
      : ` Write it entirely in ${L.name} (${L.native}), in its own script, with natural dialogue a native speaker would use; Indian names and settings suit it.`;
  return `Write an original ${genre} story for an audio drama, 300 to 380 words.${inLang} ${idea ? 'Idea: ' + idea + '.' : ''} Use 2 or 3 named characters, put all dialogue in straight double quotes with clear tags like "said Mira", include sounds a listener can hear (rain, doors, footsteps, wind, birds, fire, bells, magic), and end warmly. Return the title on the first line, then a blank line, then the story. No markdown.`;
}

/**
 * Voice casting: given the characters (with their own lines) and the voice catalogue,
 * pick the best-fitting voice for each character and say why.
 */
export function castingPrompt(an, voices) {
  const characters = an.chars.map((c) => ({
    name: c.name,
    role: c.role,
    gender: c.gender,
    age: c.age,
    sample_lines: an.lines
      .filter((l) => l.speaker === c.name)
      .slice(0, 3)
      .map((l) => l.text.slice(0, 160)),
  }));
  const catalogue = voices.map((v) => ({
    id: v.id,
    name: v.name,
    gender: v.gender,
    age: v.age || '',
    about: [v.desc, v.use].filter(Boolean).join(' · '),
  }));
  return `You are the casting director for an audio drama.
Story: "${an.title}" (${an.genre}). Narration style: ${an.style}.${an.lang && an.lang !== 'en' ? ` The story is in ${langInfo(an.lang).name}: prefer voices that speak it naturally (an Indian accent where the catalogue has one).` : ''}

Pick the single best voice for every character from the catalogue. Match gender and age first, then personality, accent and the feel of their lines; the Narrator needs a clear, warm storytelling voice that suits the genre. Give each character a different voice when the catalogue allows it.

Return ONLY JSON: {"casting":[{"character":string,"voice_id":string (an id from the catalogue),"reason":string (max 14 words, why this voice fits)}]}

CHARACTERS:
${JSON.stringify(characters)}

VOICE CATALOGUE:
${JSON.stringify(catalogue)}`;
}
