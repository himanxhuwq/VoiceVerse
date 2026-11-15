// Voice casting: lists the available voices (ElevenLabs or the browser's own),
// picks a fitting voice for each character, and turns a character's settings
// plus a line's emotion into speech parameters.
import { EMO } from '../data/constants';
import { clamp, words } from '../lib/utils';
import { S, cfg, hasEleven, notify } from '../state/store';

const NOVELTY =
  /fred|junior|ralph|kathy|albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|pipe organ|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley/i;
const FEMALE =
  /samantha|karen|moira|tessa|fiona|victoria|allison|ava|susan|zoe|serena|kate|veena|nicky|female|zira|hazel|catherine|martha|sara|emma|olivia|amy|joanna|kimberly|salli|ivy|kendra|aria|jenny|libby|sonia|natasha|isla|mia/i;
const MALE =
  /daniel|alex|tom|oliver|rishi|fred|aaron|arthur|gordon|lee|evan|nathan|male|david|mark|george|james|ryan|guy|brian|matthew|joey|justin|thomas|rocko|ralph|junior/i;

const guessGender = (name) => (FEMALE.test(name) ? 'female' : MALE.test(name) ? 'male' : 'unknown');

/* ---------- browser voices (Web Speech API) ---------- */

let browserVoices = [];
export const getBrowserVoices = () => browserVoices;

function loadBrowserVoices() {
  if (!('speechSynthesis' in window)) return;
  const english = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang) && !NOVELTY.test(v.name));
  const seen = new Set();
  browserVoices = english
    .filter((v) => (seen.has(v.name) ? false : seen.add(v.name)))
    .sort((a, b) => b.localService - a.localService || a.name.localeCompare(b.name))
    .slice(0, 24);
}

if ('speechSynthesis' in window) {
  loadBrowserVoices();
  speechSynthesis.onvoiceschanged = () => {
    loadBrowserVoices();
    notify();
  };
}

/* ---------- ElevenLabs voices ---------- */

let elevenVoices = null;
export const getElevenVoices = () => elevenVoices;
export const resetElevenVoices = () => {
  elevenVoices = null;
};

export async function loadElevenVoices() {
  if (elevenVoices) return elevenVoices;
  const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': cfg().el } });
  if (!res.ok) {
    let msg = '';
    try {
      const j = await res.json();
      msg = j.detail?.message || j.detail?.status || JSON.stringify(j.detail || '');
    } catch {
      /* no JSON body */
    }
    throw new Error(`ElevenLabs ${res.status}: ${msg || res.statusText}`);
  }
  elevenVoices = ((await res.json()).voices || []).map((v) => ({
    id: v.voice_id,
    name: v.name,
    gender: v.labels?.gender || 'unknown',
    age: v.labels?.age || '',
    desc: [v.labels?.description, v.labels?.accent, v.labels?.age].filter(Boolean).join(' · '),
    use: v.labels?.use_case || v.labels?.['use case'] || '',
    preview: v.preview_url,
  }));
  return elevenVoices;
}

/** The voices the user can pick from right now, in one common shape. */
export function voiceList() {
  if (hasEleven()) return elevenVoices || [];
  return browserVoices.map((v) => ({
    id: v.name,
    name: v.name.replace(/\s*\(.*\)/, ''),
    gender: guessGender(v.name),
    desc: v.lang + (v.localService ? ' · on this laptop' : ' · online'),
  }));
}

/* ---------- casting ---------- */

/** Give every character a distinct, fitting voice (keeps choices the user already made). */
export function autoCast(an) {
  const list = voiceList();
  const used = {};
  const cast = {};
  an.chars.forEach((c, i) => {
    const prev = S.cast[c.name];
    const want = c.gender === 'female' ? 'female' : c.gender === 'male' ? 'male' : null;
    let pool = list.filter((v) => !want || v.gender === want || v.gender === 'unknown');
    if (!pool.length) pool = list;
    if (hasEleven() && c.name === 'Narrator') {
      const n = pool.find((v) => /narrat|audiobook/i.test(v.use + v.desc));
      if (n) pool = [n, ...pool];
    }
    if (hasEleven() && c.age === 'elder') {
      const o = pool.filter((v) => /old|middle/i.test(v.age));
      if (o.length) pool = [...o, ...pool];
    }
    if (hasEleven() && (c.age === 'young' || c.age === 'child')) {
      const o = pool.filter((v) => /young/i.test(v.age));
      if (o.length) pool = [...o, ...pool];
    }
    const pick = pool.find((v) => !used[v.id]) || pool[i % Math.max(1, pool.length)];
    if (pick) used[pick.id] = 1;
    const base = {
      speed: c.age === 'elder' ? 0.9 : c.eerie ? 0.85 : 1,
      tone: c.age === 'young' || c.age === 'child' ? 72 : c.age === 'elder' ? 30 : c.eerie ? 18 : 50,
      emotion: c.eerie ? 'whisper' : c.name === 'Narrator' ? 'calm' : 'determined',
    };
    const stillValid = prev && list.some((v) => v.id === prev.voice);
    cast[c.name] = stillValid ? prev : { voice: pick?.id || '', ...base };
  });
  S.cast = cast;
}

/** Speech parameters for one line, mixing the character's settings with the line's emotion. */
export function voiceParams(name, emotion) {
  const c = S.cast[name] || { speed: 1, tone: 50, emotion: 'calm' };
  const e = EMO[emotion || c.emotion] || EMO.calm;
  const ce = EMO[c.emotion] || EMO.calm;
  return {
    rate: clamp(c.speed * e.r, 0.5, 2),
    pitch: clamp(1 + ((c.tone - 50) / 100) * 0.8 + (e.p - 1), 0.1, 2),
    vol: e.vol || ce.vol || 1,
    stab: e.stab,
    style: e.style,
    speed: clamp(c.speed, 0.7, 1.2),
    c,
  };
}

/** Rough spoken length of a line in seconds (used until real audio exists). */
export function estimateDuration(line) {
  const p = voiceParams(line.speaker, line.emotion);
  return words(line.text) / (2.65 * p.rate) + 0.35;
}
