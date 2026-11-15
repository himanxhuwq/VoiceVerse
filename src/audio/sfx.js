// Procedural sound effects: every cue (rain, thunder, doors, footsteps, magic…)
// is synthesised from noise and oscillators, so no audio files are needed.
import { SFX_DUR } from '../data/constants';
import { env, filt, gain, hit, noise, osc } from './nodes';

export function scheduleSfx(ctx, out, type, t, vol = 1, dur) {
  const d = dur || SFX_DUR[type] || 3;
  const o = gain(ctx, vol);
  o.connect(out);
  const E = t + d;
  const N = (f1, type1, q) => {
    const n = noise(ctx, t, E + 0.1),
      fl = filt(ctx, type1, f1, q);
    n.connect(fl);
    return fl;
  };
  switch (type) {
    case 'rain': {
      const a = N(5000, 'lowpass'),
        h = filt(ctx, 'highpass', 900),
        g = gain(ctx);
      a.connect(h);
      h.connect(g);
      env(g, t, 1.2, 0.32, d - 2.4, 1.2);
      g.connect(o);
      break;
    }
    case 'wind': {
      const n = noise(ctx, t, E + 0.1),
        bp = filt(ctx, 'bandpass', 500, 1.2),
        g = gain(ctx);
      const l = osc(ctx, 'sine', 0.17, t, E),
        lg = gain(ctx, 320);
      l.connect(lg);
      lg.connect(bp.frequency);
      n.connect(bp);
      bp.connect(g);
      env(g, t, 1.6, 0.7, d - 3.2, 1.6);
      g.connect(o);
      break;
    }
    case 'thunder': {
      const a = N(380, 'lowpass'),
        g = gain(ctx);
      a.connect(g);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1.2, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      g.connect(o);
      const b = N(1600, 'lowpass'),
        g2 = gain(ctx);
      b.connect(g2);
      hit(g2, t, 0.7, 0.5);
      g2.connect(o);
      const c = N(240, 'lowpass'),
        g3 = gain(ctx);
      c.connect(g3);
      g3.gain.setValueAtTime(0, t + 1.1);
      g3.gain.linearRampToValueAtTime(0.8, t + 1.4);
      g3.gain.exponentialRampToValueAtTime(0.001, t + d);
      g3.connect(o);
      break;
    }
    case 'door': {
      const s = osc(ctx, 'sawtooth', 190, t, t + 0.9);
      s.frequency.linearRampToValueAtTime(110, t + 0.8);
      const bp = filt(ctx, 'bandpass', 900, 6),
        g = gain(ctx);
      env(g, t, 0.06, 0.35, 0.6, 0.15);
      s.connect(bp);
      bp.connect(g);
      g.connect(o);
      const th = osc(ctx, 'sine', 95, t + 0.85, t + 1.4);
      th.frequency.exponentialRampToValueAtTime(42, t + 1.1);
      const g2 = gain(ctx);
      hit(g2, t + 0.85, 1, 0.4);
      th.connect(g2);
      g2.connect(o);
      break;
    }
    case 'knock': {
      [0, 0.22, 0.44].forEach((x) => {
        const s = osc(ctx, 'sine', 170, t + x, t + x + 0.2);
        s.frequency.exponentialRampToValueAtTime(80, t + x + 0.12);
        const g = gain(ctx);
        hit(g, t + x, 0.9, 0.15);
        s.connect(g);
        g.connect(o);
      });
      break;
    }
    case 'steps': {
      for (let x = 0; x < d - 0.2; x += 0.48) {
        const n = noise(ctx, t + x, t + x + 0.12),
          bp = filt(ctx, 'bandpass', 700 + Math.random() * 300, 1.4),
          g = gain(ctx);
        hit(g, t + x, 0.55, 0.1);
        n.connect(bp);
        bp.connect(g);
        g.connect(o);
      }
      break;
    }
    case 'waves': {
      const a = N(800, 'lowpass'),
        g = gain(ctx, 0),
        sw = gain(ctx, 0);
      a.connect(sw);
      sw.connect(g);
      const l = osc(ctx, 'sine', 0.16, t, E),
        lg = gain(ctx, 0.22);
      l.connect(lg);
      lg.connect(sw.gain);
      sw.gain.setValueAtTime(0.25, t);
      env(g, t, 1.5, 1, d - 3, 1.5);
      g.connect(o);
      break;
    }
    case 'birds': {
      for (let k = 0; k < d * 1.6; k++) {
        const tt = t + Math.random() * (d - 0.5);
        for (let c = 0; c < 2 + Math.floor(Math.random() * 3); c++) {
          const s = osc(ctx, 'sine', 2600 + Math.random() * 900, tt + c * 0.11, tt + c * 0.11 + 0.09);
          s.frequency.exponentialRampToValueAtTime(4200, tt + c * 0.11 + 0.06);
          const g = gain(ctx);
          hit(g, tt + c * 0.11, 0.1, 0.08);
          s.connect(g);
          g.connect(o);
        }
      }
      break;
    }
    case 'magic': {
      const sc = [1046, 1175, 1397, 1568, 1760, 2093, 2349];
      for (let k = 0; k < 12; k++) {
        const tt = t + k * 0.13;
        const s = osc(ctx, k % 2 ? 'triangle' : 'sine', sc[(k * 3) % sc.length], tt, tt + 1.1),
          g = gain(ctx);
        hit(g, tt, 0.16, 1);
        s.connect(g);
        g.connect(o);
      }
      const a = N(7000, 'highpass'),
        g = gain(ctx);
      a.connect(g);
      env(g, t, 0.8, 0.06, d - 1.6, 0.8);
      g.connect(o);
      break;
    }
    case 'fire': {
      const a = N(900, 'lowpass'),
        g = gain(ctx);
      a.connect(g);
      env(g, t, 1, 0.22, d - 2, 1);
      g.connect(o);
      for (let k = 0; k < d * 9; k++) {
        const tt = t + Math.random() * d,
          n = noise(ctx, tt, tt + 0.03),
          bp = filt(ctx, 'bandpass', 2500 + Math.random() * 2500, 2),
          gg = gain(ctx);
        hit(gg, tt, 0.35 * Math.random(), 0.025);
        n.connect(bp);
        bp.connect(gg);
        gg.connect(o);
      }
      break;
    }
    case 'bell': {
      [0, 1.4].forEach((x) =>
        [
          [1, 0.4],
          [2.76, 0.18],
          [5.4, 0.09],
          [8.93, 0.05],
        ].forEach(([m, a]) => {
          const s = osc(ctx, 'sine', 520 * m, t + x, t + x + 2.6),
            g = gain(ctx);
          hit(g, t + x, a, 2.4);
          s.connect(g);
          g.connect(o);
        }),
      );
      break;
    }
    case 'sword': {
      [1830, 2610, 3720, 5190].forEach((f) => {
        const s = osc(ctx, 'sine', f, t, t + 1),
          g = gain(ctx);
        hit(g, t, 0.12, 0.9);
        s.connect(g);
        g.connect(o);
      });
      const a = N(3000, 'highpass'),
        g = gain(ctx);
      a.connect(g);
      hit(g, t, 0.5, 0.12);
      g.connect(o);
      break;
    }
    case 'crowd': {
      [600, 1100, 1700].forEach((f, i) => {
        const n = noise(ctx, t, E + 0.1),
          bp = filt(ctx, 'bandpass', f, 0.9),
          g = gain(ctx),
          l = osc(ctx, 'sine', 0.3 + i * 0.21, t, E),
          lg = gain(ctx, 180);
        l.connect(lg);
        lg.connect(bp.frequency);
        n.connect(bp);
        bp.connect(g);
        env(g, t, 1.4, 0.22, d - 2.8, 1.4);
        g.connect(o);
      });
      break;
    }
    case 'horse': {
      for (let x = 0; x < d - 0.3; x += 0.55)
        [0, 0.09, 0.2].forEach((y) => {
          const s = osc(ctx, 'sine', 130, t + x + y, t + x + y + 0.15);
          s.frequency.exponentialRampToValueAtTime(60, t + x + y + 0.1);
          const g = gain(ctx);
          hit(g, t + x + y, 0.6, 0.1);
          s.connect(g);
          g.connect(o);
        });
      break;
    }
    case 'heartbeat': {
      for (let x = 0; x < d - 0.3; x += 0.9)
        [0, 0.24].forEach((y, j) => {
          const s = osc(ctx, 'sine', 62, t + x + y, t + x + y + 0.22);
          s.frequency.exponentialRampToValueAtTime(38, t + x + y + 0.15);
          const g = gain(ctx);
          hit(g, t + x + y, j ? 0.6 : 0.9, 0.18);
          s.connect(g);
          g.connect(o);
        });
      break;
    }
    case 'clock': {
      for (let x = 0; x < d; x += 0.5) {
        const s = osc(ctx, 'square', x % 1 ? 2400 : 2000, t + x, t + x + 0.03),
          hp = filt(ctx, 'highpass', 1500),
          g = gain(ctx);
        hit(g, t + x, 0.12, 0.025);
        s.connect(hp);
        hp.connect(g);
        g.connect(o);
      }
      break;
    }
    case 'horn': {
      [110, 165, 220].forEach((f) => {
        const s = osc(ctx, 'sawtooth', f, t, E),
          lp = filt(ctx, 'lowpass', 700),
          g = gain(ctx);
        env(g, t, 0.4, 0.12, d - 1.4, 1);
        s.connect(lp);
        lp.connect(g);
        g.connect(o);
      });
      break;
    }
  }
  return o;
}
