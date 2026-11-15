// Procedural music: each mood has a chord progression and texture
// (arpeggios, melody, plinks, kick, drone) synthesised live with Web Audio.
import { env, filt, gain, hit, mf, noise, osc } from './nodes';

const CH = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  add9: [0, 4, 7, 14],
  sus2: [0, 2, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
};
const MUSIC = {
  calm: {
    prog: [
      [60, 'maj7'],
      [57, 'm7'],
      [65, 'maj7'],
      [67, 'add9'],
    ],
    len: 4,
    wave: 'triangle',
    cut: 1300,
    lvl: 0.05,
    mel: 2,
  },
  hopeful: {
    prog: [
      [62, 'maj'],
      [69, 'maj'],
      [71, 'min'],
      [67, 'maj'],
    ],
    len: 3.2,
    wave: 'triangle',
    cut: 1800,
    lvl: 0.045,
    arp: 0.4,
  },
  happy: {
    prog: [
      [60, 'maj'],
      [67, 'maj'],
      [69, 'min'],
      [65, 'maj'],
    ],
    len: 2.4,
    wave: 'triangle',
    cut: 2200,
    lvl: 0.04,
    arp: 0.2,
    pulse: 0.6,
  },
  sad: {
    prog: [
      [57, 'min'],
      [53, 'maj'],
      [60, 'maj'],
      [52, 'min'],
    ],
    len: 5,
    wave: 'triangle',
    cut: 1000,
    lvl: 0.05,
    mel: 2.5,
  },
  tense: {
    prog: [
      [45, 'min'],
      [46, 'maj'],
      [45, 'min'],
      [44, 'dim'],
    ],
    len: 3,
    wave: 'sawtooth',
    cut: 520,
    lvl: 0.04,
    kick: 0.5,
    drone: 33,
  },
  mysterious: {
    prog: [
      [50, 'min'],
      [53, 'aug'],
      [55, 'sus2'],
      [49, 'dim'],
    ],
    len: 4,
    wave: 'sine',
    cut: 900,
    lvl: 0.06,
    plink: 1.3,
    vib: 1,
  },
  epic: {
    prog: [
      [50, 'min'],
      [46, 'maj'],
      [53, 'maj'],
      [48, 'maj'],
    ],
    len: 2.4,
    wave: 'sawtooth',
    cut: 1500,
    lvl: 0.035,
    kick: 0.4,
    drone: 38,
  },
};

export function scheduleMusic(ctx, out, mood, t0, t1, level = 1) {
  const m = MUSIC[mood] || MUSIC.calm;
  const bed = gain(ctx, 0);
  const lp = filt(ctx, 'lowpass', m.cut);
  lp.connect(bed);
  bed.connect(out);
  const fade = Math.min(2, (t1 - t0) / 4);
  bed.gain.setValueAtTime(0, t0);
  bed.gain.linearRampToValueAtTime(level, t0 + fade);
  bed.gain.setValueAtTime(level, t1 - fade);
  bed.gain.linearRampToValueAtTime(0, t1);
  let k = 0;
  for (let t = t0; t < t1; t += m.len, k++) {
    const [root, q] = m.prog[k % m.prog.length];
    const end = Math.min(t1, t + m.len + 0.6);
    CH[q].forEach((iv, j) => {
      const f = mf(root + iv);
      [0, m.wave === 'sawtooth' ? 7 : 0].forEach((det, d) => {
        if (d && !det) return;
        const o = osc(ctx, m.wave, f, t, end);
        o.detune.value = det * (d ? 1 : 0);
        const g = gain(ctx);
        env(g, t, Math.min(0.9, m.len * 0.3), m.lvl / (d ? 2 : 1), m.len - 1.1, 1);
        if (m.vib) {
          const l = osc(ctx, 'sine', 4.5, t, end),
            lg = gain(ctx, 4);
          l.connect(lg);
          lg.connect(o.frequency);
        }
        o.connect(g);
        g.connect(lp);
      });
    });
    if (m.drone) {
      const o = osc(ctx, 'sawtooth', mf(m.drone), t, end),
        g = gain(ctx);
      env(g, t, 0.5, m.lvl * 1.3, m.len - 0.9, 0.6);
      o.connect(g);
      g.connect(lp);
    }
    if (m.arp) {
      const notes = CH[q].map((iv) => mf(root + 12 + iv));
      for (let a = 0, tt = t; tt < Math.min(t1, t + m.len) - 0.05; tt += m.arp, a++) {
        const o = osc(ctx, 'triangle', notes[a % notes.length], tt, tt + 0.5),
          g = gain(ctx);
        hit(g, tt, m.lvl * 2.2, 0.45);
        o.connect(g);
        g.connect(bed);
      }
    }
    if (m.mel) {
      for (let tt = t + 0.5; tt < Math.min(t1, t + m.len); tt += m.mel) {
        const iv = CH[q][Math.floor(Math.random() * CH[q].length)];
        const o = osc(ctx, 'sine', mf(root + 24 + iv), tt, tt + 1.6),
          g = gain(ctx);
        hit(g, tt, m.lvl * 1.4, 1.5);
        o.connect(g);
        g.connect(bed);
      }
    }
    if (m.plink) {
      for (let tt = t + 0.3; tt < Math.min(t1, t + m.len); tt += m.plink * (0.6 + Math.random() * 0.8)) {
        const f = [1046, 1175, 1397, 1568, 1760, 2093][Math.floor(Math.random() * 6)];
        const o = osc(ctx, 'sine', f, tt, tt + 1.3),
          g = gain(ctx);
        hit(g, tt, m.lvl * 0.9, 1.2);
        o.connect(g);
        g.connect(bed);
      }
    }
    if (m.kick) {
      for (let tt = t; tt < Math.min(t1, t + m.len) - 0.02; tt += m.kick) {
        const o = osc(ctx, 'sine', 110, tt, tt + 0.35);
        o.frequency.exponentialRampToValueAtTime(42, tt + 0.25);
        const g = gain(ctx);
        hit(g, tt, m.lvl * 7, 0.3);
        o.connect(g);
        g.connect(bed);
      }
    }
    if (m.pulse) {
      for (let tt = t; tt < Math.min(t1, t + m.len) - 0.02; tt += m.pulse) {
        const n = noise(ctx, tt, tt + 0.06),
          hp = filt(ctx, 'highpass', 7000),
          g = gain(ctx);
        hit(g, tt, m.lvl * 1.6, 0.05);
        n.connect(hp);
        hp.connect(g);
        g.connect(bed);
      }
    }
  }
  return bed;
}
