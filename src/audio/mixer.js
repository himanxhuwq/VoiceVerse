// Timeline layout and offline mixing.
// layout() places every line, music bed and effect on a shared clock;
// renderMix() bounces narration, dialogue, music and effects into one stereo track.
import { GAP, SCENE_GAP, SFX_DUR } from '../data/constants';
import { clamp } from '../lib/utils';
import { S } from '../state/store';
import { estimateDuration } from '../ai/voices';
import { scheduleMusic } from './music';
import { scheduleSfx } from './sfx';
import { gain } from './nodes';

/**
 * Recorded audio for the current story.
 * buffers: line index → AudioBuffer (ElevenLabs recordings)
 * mix:     the last rendered full mix (AudioBuffer)
 * dirty:   true when an edit means the mix must be rendered again
 */
export const audio = { buffers: {}, mix: null, dirty: true };

export function resetAudio() {
  audio.buffers = {};
  audio.mix = null;
  audio.dirty = true;
}

export function markDirty() {
  audio.dirty = true;
}

/** Give every line, scene and effect a start time and duration. */
export function layout() {
  const an = S.an;
  if (!an) return;
  let t = 0.8;
  an.scenes.forEach((sc, si) => {
    sc.start = t;
    an.lines.forEach((l, li) => {
      if (l.scene !== si) return;
      const b = audio.buffers[li];
      l.start = t;
      l.dur = b ? b.duration : estimateDuration(l);
      t += l.dur + GAP;
    });
    sc.end = Math.max(t, sc.start + 2);
    t = sc.end + SCENE_GAP;
  });
  an.total = t + 0.8;
  an.scenes.forEach((sc) => {
    const perLine = {};
    sc.sfx.forEach((x) => {
      const l = an.lines[x.line];
      const k = (perLine[x.line] = (perLine[x.line] || 0) + 1);
      x.t = (l ? l.start : sc.start) + 0.1 + (k - 1) * 1.6;
      x.dur = SFX_DUR[x.type] || 3;
    });
  });
}

/** Render the whole story offline into one stereo AudioBuffer. Music ducks under every voice. */
export async function renderMix(withVoices = true) {
  const an = S.an;
  layout();
  const sr = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil((an.total + 2) * sr), sr);

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  comp.connect(ctx.destination);
  const mus = gain(ctx, 0.9);
  const sfx = gain(ctx, 0.8);
  const vox = gain(ctx, 1);
  [mus, sfx, vox].forEach((bus) => bus.connect(comp));

  an.scenes.forEach((sc) =>
    scheduleMusic(ctx, mus, sc.mood, Math.max(0, sc.start - 0.6), sc.end + SCENE_GAP * 0.8, sc.musVol ?? 1),
  );
  an.scenes.forEach((sc) => sc.sfx.forEach((x) => scheduleSfx(ctx, sfx, x.type, x.t, x.vol)));
  if (withVoices) {
    an.lines.forEach((l, i) => {
      const b = audio.buffers[i];
      if (!b) return;
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(vox);
      s.start(l.start);
      mus.gain.setTargetAtTime(0.45, l.start - 0.05, 0.08); // duck the music…
      mus.gain.setTargetAtTime(0.9, l.start + l.dur, 0.25); // …and bring it back
    });
  }
  return ctx.startRendering();
}

/** Normalised peak levels of a buffer, for drawing a waveform with n bars. */
export function peaks(buf, n) {
  const d = buf.getChannelData(0);
  const step = Math.floor(d.length / n);
  const out = [];
  let max = 0;
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let j = i * step; j < (i + 1) * step; j += 16) m = Math.max(m, Math.abs(d[j]));
    out.push(m);
    max = Math.max(max, m);
  }
  return out.map((v) => clamp(v / (max || 1), 0.06, 1));
}

/** A plausible waveform from the timeline alone (when voices play live and there is no mix). */
export function estimatedPeaks(n) {
  const an = S.an;
  layout();
  let seed = 7;
  const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * an.total;
    const inLine = an.lines.some((l) => t >= l.start && t <= l.start + l.dur);
    return inLine ? 0.35 + r() * 0.65 : 0.08 + r() * 0.14;
  });
}

/** Lay sound effects out on two rows so overlapping cues stay readable on the timeline. */
export function effectRows() {
  const an = S.an;
  const T = an.total;
  const all = an.scenes
    .flatMap((s, si) => s.sfx.map((x, xi) => ({ x, id: si + '.' + xi, w: Math.max(Math.min(x.dur, 6), T / 50) })))
    .sort((a, b) => a.x.t - b.x.t);
  const ends = [-1, -1];
  all.forEach((o) => {
    const row = ends[0] <= o.x.t ? 0 : ends[1] <= o.x.t ? 1 : ends[0] < ends[1] ? 0 : 1;
    o.row = row;
    ends[row] = o.x.t + o.w + 0.3;
  });
  return all;
}
