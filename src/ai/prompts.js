// Prompt templates sent to Gemini. Kept in one place so they can be read,
// reviewed and tuned without touching the app logic.
import { MOODS, SFX_TYPES } from '../data/constants';

/**
 * Story analysis: one call returns the whole structured breakdown
 * (characters, scenes, speaker-tagged lines with emotions, and sound-effect cues).
 */
export function analysisPrompt(text, title) {
  return `You are the story analyst for an audio-drama studio. Read the story and return ONLY JSON with this shape:
{"title":string,"genre":string,"narration_style":string (max 8 words),
 "characters":[{"name":string,"role":"main"|"side","gender":"male"|"female"|"unknown","age":"child"|"young"|"adult"|"elder"|"ageless","description":string (max 8 words)}],
 "scenes":[{"title":string (2-4 words),"mood":one of ${JSON.stringify(MOODS)},"summary":string (one sentence),
   "lines":[{"speaker":"Narrator" or a character name,"text":string,"emotion":"calm"|"determined"|"afraid"|"joyful"|"whisper"|"sad"|"angry"}],
   "sfx":[{"type":one of ${JSON.stringify(Object.keys(SFX_TYPES))},"line_index":index into this scene's lines where the sound should start}]}]}
Rules: 2 to 5 scenes. The lines across all scenes must cover the WHOLE story in order, word for word, with dialogue split from narration and each dialogue line given to its speaker. Do not include dialogue tags like "she said" as separate lines. Narration lines at most 2 sentences. At most 3 sfx per scene, only sounds the text actually mentions or clearly implies. Do not list "Narrator" in characters.
${title ? `Title given by the writer: ${title}\n` : ''}STORY:
${text}`;
}

/** Story generation: a short original story written to suit audio drama. */
export function storyPrompt(genre, idea) {
  return `Write an original ${genre} story for an audio drama, 300 to 380 words. ${idea ? 'Idea: ' + idea + '.' : ''} Use 2 or 3 named characters, put all dialogue in straight double quotes with clear tags like "said Mira", include sounds a listener can hear (rain, doors, footsteps, wind, birds, fire, bells, magic), and end warmly. Return the title on the first line, then a blank line, then the story. No markdown.`;
}
