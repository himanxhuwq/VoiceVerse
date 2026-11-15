// Playback engine shared by the player and the timeline.
// Two modes:
//  - "mix":  ElevenLabs recordings exist, so the rendered mix plays as one track.
//  - "live": browser voices speak line by line while music and effects are
//            scheduled around them in real time.
import { useSyncExternalStore } from 'react';
import { GAP, SCENE_GAP } from '../data/constants';
import { clamp } from '../lib/utils';
import { S, hasEleven } from '../state/store';
import { toast } from '../state/toast';
import { speakBrowser } from '../ai/tts';
import { audio, layout, renderMix } from './mixer';
import { scheduleMusic } from './music';
import { scheduleSfx } from './sfx';
import { ac, gain } from './nodes';

const P = {
  playing: false,
  t: 0, // position in seconds when paused
  idx: 0, // current line
  token: 0, // bumps on every stop so stale callbacks are ignored
  src: null,
  startedAt: 0,
  offset: 0,
  master: null,
  mus: null,
  sfxBus: null,
  bed: null,
  bedScene: -1,
  cancel: null,
  lineAt: 0,
  raf: 0,
};

/* ---------- subscription (React reads a snapshot) ---------- */

let snapshot = { playing: false, t: 0, idx: 0 };
const listeners = new Set();
function emit() {
  const t = currentTime();
  snapshot = { playing: P.playing, t, idx: S.an ? lineAtTime(t) : 0 };
  listeners.forEach((fn) => fn());
}

/** React hook: { playing, t, idx }, updated every animation frame while playing. */
export function usePlayback() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => snapshot,
  );
}

/* ---------- engine ---------- */

export const engineMode = () => (hasEleven() && audio.mix ? 'mix' : 'live');
export const isPlaying = () => P.playing;

function stopAll() {
  P.token++;
  if (P.cancel) {
    P.cancel();
    P.cancel = null;
  }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (P.src) {
    try {
      P.src.onended = null;
      P.src.stop();
    } catch {
      /* already stopped */
    }
    P.src = null;
  }
  if (P.master) {
    const m = P.master;
    m.gain.setTargetAtTime(0, ac().currentTime, 0.15);
    setTimeout(() => m.disconnect(), 900);
    P.master = null;
  }
  P.bed = null;
  P.bedScene = -1;
}

export function lineAtTime(t) {
  const L = S.an.lines;
  let i = 0;
  for (let k = 0; k < L.length; k++) if (L[k].start <= t + 0.01) i = k;
  return i;
}

export async function play(from) {
  const an = S.an;
  if (!an) return;
  layout();
  if (from != null) P.t = from;
  if (P.t >= an.total - 0.5) P.t = 0;
  stopAll();
  P.playing = true;
  const ctx = ac();
  await ctx.resume();

  if (engineMode() === 'mix') {
    if (audio.dirty) {
      toast('Updating the mix…');
      audio.mix = await renderMix(true);
      audio.dirty = false;
    }
    const s = ctx.createBufferSource();
    s.buffer = audio.mix;
    s.connect(ctx.destination);
    s.start(0, P.t);
    P.src = s;
    P.startedAt = ctx.currentTime;
    P.offset = P.t;
    const tok = P.token;
    s.onended = () => {
      if (tok !== P.token) return;
      P.playing = false;
      P.t = 0;
      emit();
    };
  } else {
    P.master = gain(ctx, 1);
    P.master.connect(ctx.destination);
    P.mus = gain(ctx, 0.9);
    P.mus.connect(P.master);
    P.sfxBus = gain(ctx, 0.8);
    P.sfxBus.connect(P.master);
    startLine(lineAtTime(P.t), P.token);
  }
  tick();
}

function startLine(i, tok) {
  const an = S.an;
  const ctx = ac();
  if (tok !== P.token) return;
  if (i >= an.lines.length) {
    P.playing = false;
    P.t = 0;
    stopAll();
    emit();
    return;
  }
  const l = an.lines[i];
  P.idx = i;
  P.t = l.start;
  P.lineAt = ctx.currentTime;
  const sc = an.scenes[l.scene];

  // New scene: fade the old music bed out and start this scene's bed.
  if (P.bedScene !== l.scene) {
    if (P.bed) {
      P.bed.gain.cancelScheduledValues(ctx.currentTime);
      P.bed.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
    }
    P.bed = scheduleMusic(ctx, P.mus, sc.mood, ctx.currentTime, ctx.currentTime + (sc.end - l.start) * 1.8 + 6, sc.musVol ?? 1);
    P.bedScene = l.scene;
  }
  sc.sfx.forEach((x) => {
    if (x.line === i) scheduleSfx(ctx, P.sfxBus, x.type, ctx.currentTime + Math.max(0.1, (x.t ?? l.start) - l.start), x.vol);
  });
  P.mus.gain.setTargetAtTime(0.5, ctx.currentTime, 0.1); // duck under the voice
  P.cancel = speakBrowser(l, () => {
    if (tok !== P.token) return;
    P.mus.gain.setTargetAtTime(0.9, ac().currentTime, 0.2);
    const next = an.lines[i + 1];
    const gap = next && next.scene !== l.scene ? SCENE_GAP : GAP;
    setTimeout(() => startLine(i + 1, tok), gap * 1000);
  });
  emit();
}

export function pause() {
  if (!P.playing) return;
  P.t = currentTime();
  P.playing = false;
  stopAll();
  emit();
}

export function toggle() {
  if (P.playing) pause();
  else play();
}

/** Current position in seconds. */
export function currentTime() {
  const an = S.an;
  if (!P.playing || !an) return P.t;
  const ctx = ac();
  if (engineMode() === 'mix' && P.src) return clamp(P.offset + ctx.currentTime - P.startedAt, 0, an.total);
  const l = an.lines[P.idx];
  return l ? clamp(l.start + (ctx.currentTime - P.lineAt), l.start, l.start + l.dur + GAP) : P.t;
}

export function seek(t) {
  const was = P.playing;
  P.t = clamp(t, 0, S.an.total - 0.1);
  if (was) play(P.t);
  else {
    stopAll();
    emit();
  }
}

/** Reset the position (new story). */
export function resetPlayback() {
  stopAll();
  P.playing = false;
  P.t = 0;
  emit();
}

function tick() {
  cancelAnimationFrame(P.raf);
  const frame = () => {
    if (!P.playing) return;
    emit();
    P.raf = requestAnimationFrame(frame);
  };
  P.raf = requestAnimationFrame(frame);
}
