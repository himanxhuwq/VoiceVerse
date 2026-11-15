// Built-in story reader: a rule-based analyser that runs fully offline.
// It splits a story into narration and dialogue lines, works out who is
// speaking, groups paragraphs into scenes, and guesses mood, genre and
// sound-effect cues. Used in demo mode and as a fallback if the AI fails.
import { clamp, cap1, words } from '../lib/utils';

const VERBS =
  'said|says|asked|told|whispered|shouted|called|cried|replied|answered|muttered|murmured|sang|yelled|hissed|laughed|added|warned|snapped|sighed|begged|growled|breathed|announced|declared|exclaimed|insisted|explained|demanded|screamed|roared|giggled|grumbled|admitted|promised|wondered';
const STOP = new Set(
  'The A An And But Then By At In On Of For From To It Its He She They We I You His Her Their Our My Your This That These Those When While After Before Far Below Above Inside Outside Somewhere Every Each All No Not Yes One Two Three Far Little Old Young There Here Who What Why How Where Mr Mrs Ms Dr Sir Lady Lord So Now Once Later Soon Suddenly Still Even Just Only As If Or Nor Yet With Without Through Across Over Under Into Onto Upon Around Behind Beside Between Beyond During Until Toward Towards Along Against Among'.split(
    ' ',
  ),
);
const SFX_WORDS = {
  rain: ['rain', 'raindrops', 'drizzle', 'downpour', 'rained', 'raining'],
  thunder: ['thunder', 'lightning'],
  wind: ['wind', 'gust', 'breeze', 'gale', 'winds'],
  door: ['door', 'gate', 'doors'],
  knock: ['knock', 'knocked', 'knocking'],
  steps: ['footsteps', 'footstep', 'stairs', 'stair', 'steps', 'walked', 'ran', 'climbed', 'crept', 'marched'],
  waves: ['waves', 'wave', 'sea', 'ocean', 'shore', 'tide', 'surf'],
  birds: ['birds', 'bird', 'gulls', 'gull', 'sparrow', 'crows', 'owl'],
  magic: ['magic', 'spell', 'glowed', 'glow', 'glowing', 'shimmer', 'sparkle', 'enchanted', 'wand', 'spark'],
  fire: ['fire', 'flame', 'flames', 'campfire', 'torch', 'hearth', 'fire-eaters', 'candle'],
  bell: ['bell', 'bells', 'chime', 'rang', 'ringing'],
  sword: ['sword', 'blade', 'clash', 'swords', 'steel'],
  crowd: ['crowd', 'market', 'cheering', 'people', 'crowds'],
  horse: ['horse', 'hooves', 'gallop', 'galloped', 'horses'],
  heartbeat: ['heartbeat', 'pounding'],
  clock: ['clock', 'tick', 'ticked', 'ticking'],
  horn: ['horn'],
};
const MOOD_WORDS = {
  tense: [
    'storm',
    'dark',
    'scream',
    'fear',
    'afraid',
    'danger',
    'chase',
    'shadow',
    'blood',
    'trembl',
    'panic',
    'crash',
    'monster',
    'attack',
    'shook',
    'angry',
    'lightning',
    'thunder',
    'hammer',
    'locked',
    'crept',
  ],
  mysterious: [
    'strange',
    'whisper',
    'voice',
    'magic',
    'fog',
    'mist',
    'secret',
    'hidden',
    'ancient',
    'sing',
    'sang',
    'glow',
    'spirit',
    'ghost',
    'moon',
    'silver',
    'exist',
  ],
  hopeful: ['dawn', 'morning', 'sun', 'smil', 'hope', 'safe', 'warm', 'bright', 'calm', 'answered', 'grew', 'remember'],
  sad: ['tears', 'cry', 'wept', 'alone', 'lost', 'grief', 'goodbye', 'died', 'sorrow', 'lonely'],
  happy: ['laugh', 'joy', 'danc', 'celebrat', 'happy', 'cheer', 'grin', 'delight'],
  epic: ['battle', 'army', 'king', 'dragon', 'war', 'charge', 'sword', 'roar', 'hero', 'legend'],
};
const GENRES = {
  Fantasy: [
    'magic',
    'dragon',
    'spell',
    'spirit',
    'kingdom',
    'wizard',
    'witch',
    'fairy',
    'enchant',
    'clockwork',
    'clockmaker',
    'glowed',
    'made of brass',
  ],
  'Sci-fi': ['spaceship', 'planet', 'robot', 'space', 'laser', 'galaxy', 'android'],
  Mystery: ['detective', 'clue', 'murder', 'suspect', 'missing'],
  Horror: ['ghost', 'corpse', 'haunt', 'scream', 'blood'],
  Adventure: ['map', 'treasure', 'journey', 'island', 'quest', 'pirate'],
  'Fairy tale': ['once upon', 'princess', 'prince', 'castle'],
};

function countHits(text, list) {
  const t = text.toLowerCase();
  return list.reduce((n, w) => n + (t.split(w).length - 1), 0);
}
function guessMood(text) {
  let best = 'calm',
    bs = 1;
  for (const m in MOOD_WORDS) {
    const s = countHits(text, MOOD_WORDS[m]);
    if (s > bs) {
      bs = s;
      best = m;
    }
  }
  return best;
}
function guessGenre(text) {
  let best = 'Drama',
    bs = 0;
  for (const g in GENRES) {
    const s = countHits(text, GENRES[g]);
    if (s > bs) {
      bs = s;
      best = g;
    }
  }
  return best;
}

export function localAnalyse(text, title) {
  const paras = text
    .replace(/\r/g, '')
    .split(/\n\s*\n|\n(?=\s*["“])/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const qre = /“([^”]+)”|"([^"]+)"/g,
    vre = new RegExp(`^(?:${VERBS})$`, 'i');
  // pass 1: segments + explicit speakers
  const segs = []; // {pi, kind:'q'|'n', text, speaker, pron}
  paras.forEach((p, pi) => {
    let last = 0,
      m;
    qre.lastIndex = 0;
    while ((m = qre.exec(p))) {
      if (m.index > last) segs.push({ pi, kind: 'n', text: p.slice(last, m.index).trim(), pos: last });
      segs.push({
        pi,
        kind: 'q',
        text: (m[1] || m[2]).trim(),
        after: p.slice(qre.lastIndex, qre.lastIndex + 90),
        before: p.slice(Math.max(0, m.index - 110), m.index),
        pos: m.index,
      });
      last = qre.lastIndex;
    }
    if (last < p.length) segs.push({ pi, kind: 'n', text: p.slice(last).trim(), pos: last });
  });
  const V = `(?:${VERBS})`;
  const named = new Map(); // name -> count
  const norm = (n) => {
    n = n.replace(/'s$/, '').trim();
    return n.split(' ').map(cap1).join(' ');
  };
  segs.forEach((s) => {
    if (s.kind !== 'q') return;
    const a = s.after,
      b = s.before;
    let r;
    if (
      (r = a.match(
        new RegExp(
          `^\\s*[,.!?]?\\s*(?:(?:old|young|little|poor|the)\\s+)?([A-Z][a-z]+(?:\\s[A-Z][a-z]+)?)\\s+(?:had\\s+|has\\s+)?${V}\\b`,
        ),
      ))
    )
      s.speaker = norm(r[1]);
    else if (
      (r = a.match(
        new RegExp(`^\\s*[,.!?]?\\s*${V}\\s+(?:old\\s+|young\\s+|little\\s+)?(?:the\\s+)?([A-Z][a-z]+(?:\\s[A-Z][a-z]+)?)\\b`),
      ))
    )
      s.speaker = norm(r[1]);
    else if ((r = a.match(new RegExp(`^\\s*[,.!?]?\\s*${V}\\s+the\\s+([a-z]+)\\b`)))) s.speaker = norm(r[1]);
    else if ((r = a.match(new RegExp(`^\\s*[,.!?]?\\s*the\\s+([a-z]+)\\s+${V}\\b`)))) s.speaker = norm(r[1]);
    else if ((r = a.match(new RegExp(`^\\s*[,.!?]?\\s*(he|she|they|i|it)\\s+${V}\\b`, 'i')))) s.pron = r[1].toLowerCase();
    else if ((r = b.match(new RegExp(`([A-Z][a-z]+(?:\\s[A-Z][a-z]+)?)\\s+${V}[,:.]?\\s*$`)))) s.speaker = norm(r[1]);
    else if ((r = b.match(new RegExp(`\\b(?:the|a|an)\\s+([a-z]+)\\b[^.!?"“”]{0,32}\\b${V}[,:.]?\\s*$`)))) s.speaker = norm(r[1]);
    if (s.speaker && STOP.has(s.speaker.split(' ')[0])) s.speaker = null;
    if (s.speaker) named.set(s.speaker, (named.get(s.speaker) || 0) + 1);
  });
  // gender + age per named speaker
  const lower = text.toLowerCase(),
    info = {};
  for (const n of named.keys()) {
    const nl = n.toLowerCase();
    let he = 0,
      she = 0,
      idx = -1;
    while ((idx = lower.indexOf(nl, idx + 1)) > -1) {
      const w = lower.slice(idx, idx + 120).replace(/[“"][^”"]*[”"]/g, '');
      he += (w.match(/\b(he|his|him|himself)\b/g) || []).length;
      she += (w.match(/\b(she|hers|herself)\b/g) || []).length + (w.match(/\bher\b/g) || []).length * 0.5;
    }
    const age = new RegExp(`\\b(old|elderly|aged)\\s+${n}`, 'i').test(text)
      ? 'elder'
      : new RegExp(`\\b(little|young|small)\\s+${n}|\\b${n}\\b[^.]{0,40}\\b(girl|boy|child|kid)\\b`, 'i').test(text)
        ? 'young'
        : 'adult';
    const eerie = /spirit|ghost|voice|bell|wind|shadow|witch|demon|dragon|monster/i.test(n);
    info[n] = { gender: she >= he + 1 ? 'female' : he >= she + 1 ? 'male' : 'unknown', age: eerie ? 'ageless' : age, eerie };
  }
  // pass 2: resolve remaining quotes
  let lastSpeakerInPara = {},
    lastNamedBefore = (pi, pos) => {
      const ctx = (paras.slice(Math.max(0, pi - 2), pi).join(' ') + ' ' + paras[pi].slice(0, pos)).replace(
        /“[^”]*”|"[^"]*"/g,
        ' ',
      );
      let best = null,
        bi = -1;
      for (const n of named.keys()) {
        const i = ctx.lastIndexOf(n.split(' ')[0]);
        if (i > bi) {
          bi = i;
          best = n;
        }
      }
      return best;
    };
  segs.forEach((s) => {
    if (s.kind !== 'q') {
      return;
    }
    if (!s.speaker) {
      if (s.pron) {
        const g = s.pron === 'she' ? 'female' : s.pron === 'he' ? 'male' : null;
        const ctx = (paras.slice(Math.max(0, s.pi - 2), s.pi).join(' ') + ' ' + paras[s.pi].slice(0, s.pos)).replace(
          /“[^”]*”|"[^"]*"/g,
          ' ',
        );
        let best = null,
          bi = -1;
        for (const n of named.keys()) {
          if (g && info[n].gender !== g && info[n].gender !== 'unknown') continue;
          const i = ctx.lastIndexOf(n.split(' ')[0]);
          if (i > bi) {
            bi = i;
            best = n;
          }
        }
        s.speaker = best || lastSpeakerInPara[s.pi];
      } else s.speaker = lastSpeakerInPara[s.pi] || lastNamedBefore(s.pi, s.pos);
    }
    if (!s.speaker) {
      s.speaker = 'Stranger';
      if (!info.Stranger) {
        info.Stranger = { gender: 'unknown', age: 'adult', eerie: false };
        named.set('Stranger', 0);
      }
    }
    lastSpeakerInPara[s.pi] = s.speaker;
  });
  // lines (drop tiny attribution-only narration)
  const tagRe = new RegExp(`^[,.\\s]*(?:[A-Za-z' ]{0,28})\\b${V}\\b[\\s,.!?]*(?:[a-z ]{0,20})?[.!?,]?\\s*$`, 'i');
  const lines = [];
  segs.forEach((s) => {
    let t = s.text.replace(/^[,.;:\s]+/, '').trim();
    if (!/[A-Za-z]/.test(t)) return;
    if (s.kind === 'n') {
      if (words(t) <= 5 && tagRe.test(t)) return;
      t = cap1(t); // split long narration into sentence groups ≤ 220 chars
      const sents = t.match(/[^.!?]+[.!?]+["”’]?|[^.!?]+$/g) || [t];
      let buf = '';
      sents.forEach((x) => {
        if ((buf + x).length > 220 && buf) {
          lines.push({ pi: s.pi, speaker: 'Narrator', text: buf.trim() });
          buf = '';
        }
        buf += x;
      });
      if (buf.trim()) lines.push({ pi: s.pi, speaker: 'Narrator', text: buf.trim() });
    } else lines.push({ pi: s.pi, speaker: s.speaker, text: t.replace(/,\s*$/, '.') });
  });
  // scenes: balanced paragraph groups, nudged to time-word paragraph starts
  const tw = words(text),
    nS = clamp(Math.round(tw / 90), 2, 5),
    target = tw / nS;
  const pw = paras.map(words),
    cum = [0];
  pw.forEach((w, i) => cum.push(cum[i] + w));
  const isTime = (p) =>
    /^(then|by |later|that night|at dawn|by morning|the next|suddenly|when |inside|far away|meanwhile|and from|the following)/i.test(
      p,
    );
  const cuts = [];
  let prev = 0;
  for (let k = 1; k < nS; k++) {
    const want = target * k;
    let best = -1,
      bs = 1e9;
    for (let i = prev + 1; i < paras.length; i++) {
      const d = Math.abs(cum[i] - want);
      if (d > target * 0.45) continue;
      const sc = d - (isTime(paras[i]) ? target * 0.3 : 0);
      if (sc < bs) {
        bs = sc;
        best = i;
      }
    }
    if (best < 0) {
      for (let i = prev + 1; i < paras.length; i++) {
        const d = Math.abs(cum[i] - want);
        if (d < bs) {
          bs = d;
          best = i;
        }
      }
    }
    if (best > prev && best < paras.length) {
      cuts.push(best);
      prev = best;
    }
  }
  const groups = [];
  let st0 = 0;
  [...cuts, paras.length].forEach((c) => {
    groups.push(paras.map((_, i) => i).slice(st0, c));
    st0 = c;
  });
  const allUsed = new Set(),
    usedTitles = new Set();
  const scenes = groups.map((g, si) => {
    const st = g.map((i) => paras[i]).join(' ');
    const mood = guessMood(st);
    // sfx: first line containing each keyword type, max 3 per scene
    const sceneLines = lines.map((l, li) => ({ l, li })).filter((o) => g.includes(o.l.pi));
    const sfx = [];
    for (const type in SFX_WORDS) {
      if (sfx.length >= 3) break;
      const hit = sceneLines.find((o) => new RegExp(`\\b(${SFX_WORDS[type].join('|')})\\b`, 'i').test(o.l.text));
      if (
        hit &&
        !(type === 'steps' && sfx.some((x) => x.type === 'door')) &&
        !(type === 'waves' && allUsed.has('waves') && si > 0 && mood !== 'tense')
      )
        sfx.push({ type, line: hit.li, vol: 1 });
    }
    sfx.forEach((x) => allUsed.add(x.type));
    sceneLines.forEach((o) => (o.l.scene = si));
    // title: the most used noun that follows "the/a/an" in this scene (skipping adjectives), not used by an earlier scene
    const ADJ =
      /^(last|great|dark|old|little|whole|single|very|long|same|first|next|small|tiny|bright|calm|angry|late|other|only|very|foot|colour|top|moment|way|morning|night|day|time)$/;
    const nf = {};
    (
      st
        .replace(/“[^”]*”|"[^"]*"/g, ' ')
        .toLowerCase()
        .match(/\b(?:the|a|an)\s+([a-z']{3,})(?:\s+([a-z']{3,}))?/g) || []
    ).forEach((m) => {
      const w = m.split(/\s+/);
      let n = w[1];
      if (ADJ.test(n) && w[2]) n = w[2];
      if (ADJ.test(n) || /'s$/.test(n)) return;
      nf[n] = (nf[n] || 0) + 1 + (st.toLowerCase().split(n).length - 2) * 0.5;
    });
    const top = Object.entries(nf)
      .filter(([w]) => !usedTitles.has(w))
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0];
    if (top) usedTitles.add(top[0]);
    const first = (st.match(/[^.!?]+[.!?]/) || [st])[0].replace(/[“”"]/g, '').trim();
    return {
      title: top ? 'The ' + top[0] : 'Scene ' + (si + 1),
      mood,
      summary: first.length > 110 ? first.slice(0, 107) + '…' : first,
      sfx,
    };
  });
  lines.forEach((l) => {
    if (l.scene == null) l.scene = 0;
    delete l.pi;
  });
  const chars = [{ name: 'Narrator', role: 'Tells the story', gender: 'male', age: 'adult', eerie: false }];
  [...named.keys()]
    .sort((a, b) => lines.filter((l) => l.speaker === b).length - lines.filter((l) => l.speaker === a).length)
    .forEach((n, i) => {
      const c = info[n];
      chars.push({
        name: n,
        role:
          (i === 0 ? 'Main' : 'Side') +
          (c.eerie ? ' · a voice from beyond' : c.age === 'elder' ? ' · older' : c.age === 'young' ? ' · young' : ''),
        ...c,
      });
    });
  const arc = [];
  scenes.forEach((s) => {
    if (arc[arc.length - 1] !== s.mood) arc.push(s.mood);
  });
  const first = /(^|\s)I\s/.test(text.replace(/“[^”]*”|"[^"]*"/g, '')) ? 'First person' : 'Third person';
  return {
    title: title || guessTitle(text),
    genre: guessGenre(text),
    style: `${first}, ${arc.length > 2 ? 'slow build' : 'steady'}, ${scenes.some((s) => s.mood === 'tense') ? 'dramatic' : 'warm'} narration`,
    arc,
    scenes,
    chars,
    lines,
    engine: 'Built-in reader',
  };
}
function guessTitle(t) {
  const m = t.match(/\b([A-Z][a-z]+)\b/g) || [];
  const f = {};
  m.forEach((w) => {
    if (!STOP.has(w)) f[w] = (f[w] || 0) + 1;
  });
  const top = Object.entries(f).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] + "'s Story" : 'Untitled story';
}
