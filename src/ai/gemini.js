// Google Gemini client: story analysis and story generation.
import { MOODS, SFX_TYPES } from '../data/constants';
import { cap1, clamp } from '../lib/utils';
import { KEYS, cfg } from '../state/store';
import { analysisPrompt, castingPrompt, storyPrompt } from './prompts';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Google retires model versions over time; these errors mean "this model name no longer works". */
const isRetiredModel = (status, msg) =>
  status === 404 || /no longer available|not found|deprecated|not supported/i.test(msg || '');

/**
 * Find the newest stable Flash model this API key can use, from Google's own model list.
 * Prefers stable over preview/experimental, full Flash over Flash-Lite, then the highest version.
 */
export async function findWorkingModel(key) {
  const res = await fetch(`${ENDPOINT}?pageSize=1000`, { headers: { 'x-goog-api-key': key } });
  if (!res.ok) throw new Error(`Gemini ${res.status}: could not list models`);
  const models = ((await res.json()).models || [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => /^gemini-.*flash/.test(n) && !/image|tts|audio|live|embed|vision|thinking/.test(n));
  const version = (n) => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  const score = (n) =>
    (/preview|exp/.test(n) ? 0 : 1000) + (/lite/.test(n) ? 0 : 100) + version(n) * 10 + (/latest/.test(n) ? 0 : 1);
  models.sort((a, b) => score(b) - score(a));
  if (!models.length) throw new Error('No Gemini Flash model is available for this key.');
  return models[0];
}

async function generate(model, key, prompt, json) {
  return fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: json ? 0.3 : 0.9,
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  });
}

async function errorMessage(res) {
  try {
    return (await res.json()).error?.message || res.statusText;
  } catch {
    return res.statusText;
  }
}

/**
 * Send one prompt to Gemini. With json=true the reply is parsed as JSON.
 * If the chosen model has been retired, it switches to the newest available Flash model,
 * remembers it, and retries once.
 */
export async function callGemini(prompt, json = true) {
  const { gem, gemModel } = cfg();
  let res = await generate(gemModel, gem, prompt, json);
  if (!res.ok) {
    let msg = await errorMessage(res);
    if (isRetiredModel(res.status, msg)) {
      const model = await findWorkingModel(gem);
      KEYS.set('vv-gem-model', model, KEYS.remembered());
      res = await generate(model, gem, prompt, json);
      if (!res.ok) msg = await errorMessage(res);
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${msg}`);
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

/**
 * Ask Gemini to cast the story: returns { [characterName]: { voice, reason } },
 * keeping only picks that name a real character and a voice from the list.
 */
export async function recommendVoices(an, voices) {
  const j = await callGemini(castingPrompt(an, voices), true);
  const ids = new Set(voices.map((v) => v.id));
  const names = new Set(an.chars.map((c) => c.name));
  const picks = {};
  (j.casting || []).forEach((p) => {
    if (names.has(p?.character) && ids.has(p?.voice_id)) picks[p.character] = { voice: p.voice_id, reason: p.reason || '' };
  });
  if (!Object.keys(picks).length) throw new Error('Gemini did not return a usable cast.');
  return picks;
}
