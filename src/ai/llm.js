// The AI client: one entry point (callAI) for every supported provider, plus the three
// jobs the AI does in VoiceVerse: story analysis, story writing and voice casting.
import { MOODS, SFX_TYPES } from '../data/constants';
import { cap1, clamp } from '../lib/utils';
import { KEYS, aiConfig } from '../state/store';
import { analysisPrompt, castingPrompt, storyPrompt } from './prompts';
import { readError } from './providers';

/** Give up on an AI call after this long, so a slow or stuck request can never freeze the app. */
export const AI_TIMEOUT_MS = 90_000;

/** Name of the AI in use, for labels and messages ("Gemini", "OpenAI", "Claude"...). */
export const aiLabel = () => aiConfig().provider?.label || 'AI';

/**
 * Request options each provider accepts. They start on; if a model rejects one
 * (e.g. JSON mode or "thinking off"), it is switched off for that provider and the call retried.
 */
const accepted = {};
const optionsFor = (p) => (accepted[p.id] ||= { json: true, temperature: true, thinkingOff: p.id === 'gemini', maxTokens: 8192 });

const isMissingModel = (status, msg) =>
  status === 404 ||
  /model.{0,80}(not found|does not exist|no longer|deprecated|decommissioned|not supported|invalid|unknown)|no such model|model_not_found/i.test(
    msg,
  );

/** Pick a model from the provider's own list and remember it, so it is only looked up once. */
async function autoPickModel(p, key, base, signal, exclude) {
  if (p.fixedModel) return p.fixedModel;
  const ids = (await p.models(key, signal, base || undefined)).filter((id) => id !== exclude);
  const model = p.pick(ids);
  if (!model) throw new Error(`No suitable ${p.label} model is available for this key.`);
  KEYS.set('vv-ai-auto', `${p.id}|${model}`, KEYS.remembered());
  return model;
}

function cachedModel(p) {
  const [id, model] = (KEYS.get('vv-ai-auto') || '').split('|');
  return id === p.id ? model : '';
}

/** A message a person can act on, for the errors people actually hit. */
function friendlyError(p, status, msg) {
  const who = p.label;
  if (/quota|credit|billing|insufficient|balance|payment/i.test(msg) || status === 402)
    return `${who}: your account is out of credits or quota.`;
  if (status === 401 || status === 403 || /api key|invalid.{0,20}key|unauthori/i.test(msg))
    return `${who} rejected the API key (or it has no access). Check it in AI keys settings.`;
  if (status === 429) return `${who} rate limit reached. Wait a minute and try again.`;
  if (status >= 500) return `${who} had a server problem (${status}). Try again.`;
  return `${who} ${status}: ${msg}`;
}

/** Parse a JSON reply, tolerating code fences or a sentence around the object. */
function parseJSON(text) {
  const t = text.replace(/```(?:json)?/g, '').trim();
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error('The AI reply was not valid JSON. Try again.');
  }
}

async function attempt(p, model, key, base, prompt, json, signal) {
  const res = await p.send({ model, key, prompt, json, signal, opts: optionsFor(p), baseUrl: base || undefined });
  if (res.ok) return { ok: true, res };
  return { ok: false, status: res.status, msg: await readError(res) };
}

async function request(prompt, json, signal) {
  const { key, provider: p, model: chosen, base } = aiConfig();
  if (!key) throw new Error('Add an AI API key in AI keys settings.');
  if (!p) throw new Error('Choose your AI provider in AI keys settings (the key type was not recognised).');
  if (p.id === 'custom' && !base) throw new Error('Add the base URL for your custom AI provider in AI keys settings.');

  let model = chosen || cachedModel(p) || (await autoPickModel(p, key, base, signal));
  let r = await attempt(p, model, key, base, prompt, json, signal);
  let repicked = false;
  for (let fixes = 0; !r.ok && fixes < 5; fixes++) {
    const o = optionsFor(p);
    if (r.status === 400 && o.thinkingOff && /thinking/i.test(r.msg)) o.thinkingOff = false;
    else if (r.status === 400 && o.json && /response_format|json_object|json mode|response_?mime/i.test(r.msg)) o.json = false;
    else if (r.status === 400 && o.temperature && /temperature/i.test(r.msg)) o.temperature = false;
    else if (r.status === 400 && o.maxTokens > 2048 && /max_tokens/i.test(r.msg)) o.maxTokens = Math.floor(o.maxTokens / 2);
    else if (!repicked && isMissingModel(r.status, r.msg)) {
      // the model was retired or isn't available to this key: pick another from the provider's list
      model = await autoPickModel(p, key, base, signal, model);
      repicked = true;
    } else break;
    r = await attempt(p, model, key, base, prompt, json, signal);
  }
  if (!r.ok) throw new Error(friendlyError(p, r.status, r.msg));
  const text = p.text(await r.res.json());
  if (!text) throw new Error(`${p.label} returned nothing. Try again.`);
  return json ? parseJSON(text) : text.trim();
}

/**
 * Send one prompt to whichever AI provider the user's key belongs to.
 * With json=true the reply is parsed as JSON. The whole call is cut off after timeoutMs.
 */
export async function callAI(prompt, json = true, timeoutMs = AI_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await request(prompt, json, ctrl.signal);
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error(`${aiLabel()} took longer than ${timeoutMs / 1000} seconds`);
    if (e instanceof TypeError)
      throw new Error(`Could not reach ${aiLabel()} (network problem, or this provider blocks requests from web pages).`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Analyse a story with the AI and normalise the reply into the app's analysis shape. */
export async function analyseWithAI(text, title) {
  const j = await callAI(analysisPrompt(text, title), true);

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
  if (!lines.length) throw new Error(`${aiLabel()} could not split this story into lines.`);

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
    engine: aiLabel(),
  };
}

/** Write a fresh story. Returns { title, text }. */
export async function generateStory(genre, idea) {
  const reply = await callAI(storyPrompt(genre, idea), false);
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
 * Ask the AI to cast the story: returns { [characterName]: { voice, reason } },
 * keeping only picks that name a real character and a voice from the list.
 */
export async function recommendVoices(an, voices) {
  const j = await callAI(castingPrompt(an, voices), true, 45_000);
  const ids = new Set(voices.map((v) => v.id));
  const names = new Set(an.chars.map((c) => c.name));
  const picks = {};
  (j.casting || []).forEach((p) => {
    if (names.has(p?.character) && ids.has(p?.voice_id)) picks[p.character] = { voice: p.voice_id, reason: p.reason || '' };
  });
  if (!Object.keys(picks).length) throw new Error(`${aiLabel()} did not return a usable cast.`);
  return picks;
}

/**
 * Check the AI key works (it can list models, so the key, the provider and browser access are all fine)
 * and choose the model now. Returns { label, model }.
 */
export async function connectAI() {
  const { key, provider: p, model, base } = aiConfig();
  if (!p) throw new Error('This key type was not recognised. Choose the provider from the list.');
  if (p.id === 'custom' && !base) throw new Error('Add the base URL for your custom provider.');
  const signal = AbortSignal.timeout(20_000);
  try {
    if (p.fixedModel) {
      const res = await fetch(`${p.base}/models`, { headers: { Authorization: `Bearer ${key}` }, signal });
      if (!res.ok) throw Object.assign(new Error(await readError(res)), { status: res.status });
      return { label: p.label, model: model || p.fixedModel };
    }
    KEYS.set('vv-ai-auto', '', false);
    const picked = model || (await autoPickModel(p, key, base, signal));
    return { label: p.label, model: picked };
  } catch (e) {
    if (e.name === 'TimeoutError') throw new Error(`${p.label} did not answer within 20 seconds.`);
    if (e instanceof TypeError)
      throw new Error(`Could not reach ${p.label} from this page (network problem, or ${p.label} blocks browser requests).`);
    throw new Error(e.status ? friendlyError(p, e.status, e.message) : e.message);
  }
}

/** Forget the auto-picked model (after the key or provider changes). */
export const resetAIChoice = () => KEYS.set('vv-ai-auto', '', false);
