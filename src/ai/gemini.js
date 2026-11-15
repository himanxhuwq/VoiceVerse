// Google Gemini client: story analysis and story generation.
import { MOODS, SFX_TYPES } from '../data/constants';
import { cap1, clamp } from '../lib/utils';
import { cfg } from '../state/store';
import { analysisPrompt, storyPrompt } from './prompts';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Send one prompt to Gemini. With json=true the reply is parsed as JSON. */
export async function callGemini(prompt, json = true) {
  const { gem, gemModel } = cfg();
  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(gemModel)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': gem },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: json ? 0.3 : 0.9,
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  });
  if (!res.ok) {
    let msg = '';
    try {
      msg = (await res.json()).error?.message;
    } catch {
      /* no JSON body */
    }
    throw new Error(`Gemini ${res.status}: ${msg || res.statusText}`);
  }
  const body = await res.json();
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  if (!text) throw new Error('Gemini returned nothing. Try again.');
  return json ? JSON.parse(text.replace(/^```json|```$/g, '')) : text.trim();
}

/** Analyse a story with Gemini and normalise the reply into the app's analysis shape. */
export async function analyseWithGemini(text, title) {
  const j = await callGemini(analysisPrompt(text, title), true);

  const chars = [{ name: 'Narrator', role: 'Tells the story', gender: 'male', age: 'adult', eerie: false }];
  (j.characters || []).forEach((c) => {
    if (!c?.name || /^narrator$/i.test(c.name)) return;
    chars.push({
      name: c.name,
      role: cap1(c.role || 'side') + (c.description ? ' · ' + c.description : ''),
      gender: c.gender || 'unknown',
      age: c.age || 'adult',
      eerie: c.age === 'ageless',
    });
  });

  // Map every speaker onto a known character (case-insensitive), else the narrator.
  const names = new Set(chars.map((c) => c.name));
  const lines = [];
  const scenes = [];
  (j.scenes || []).forEach((s, si) => {
    const base = lines.length;
    (s.lines || []).forEach((l) => {
      if (!l?.text) return;
      let speaker = l.speaker || 'Narrator';
      if (!names.has(speaker)) speaker = [...names].find((n) => n.toLowerCase() === speaker.toLowerCase()) || 'Narrator';
      lines.push({ scene: si, speaker, text: l.text.trim(), emotion: l.emotion });
    });
    scenes.push({
      title: s.title || 'Scene ' + (si + 1),
      mood: MOODS.includes(s.mood) ? s.mood : 'calm',
      summary: s.summary || '',
      sfx: (s.sfx || [])
        .filter((x) => SFX_TYPES[x.type])
        .slice(0, 3)
        .map((x) => ({
          type: x.type,
          line: clamp(base + (+x.line_index || 0), base, Math.max(base, lines.length - 1)),
          vol: 1,
        })),
    });
  });
  if (!lines.length) throw new Error('Gemini could not split this story into lines.');

  const arc = [];
  scenes.forEach((s) => {
    if (arc[arc.length - 1] !== s.mood) arc.push(s.mood);
  });
  return {
    title: j.title || title || 'Untitled story',
    genre: j.genre || 'Drama',
    style: j.narration_style || 'Third person',
    arc,
    scenes,
    chars,
    lines,
    engine: 'Gemini',
  };
}

/** Write a fresh story. Returns { title, text }. */
export async function generateStory(genre, idea) {
  const reply = await callGemini(storyPrompt(genre, idea), false);
  const parts = reply.replace(/\*\*/g, '').split(/\n\s*\n/);
  return {
    title: parts[0]
      .replace(/^title:\s*/i, '')
      .replace(/^#+\s*/, '')
      .trim(),
    text: parts.slice(1).join('\n\n').trim(),
  };
}
