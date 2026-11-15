// Web Audio building blocks: the shared AudioContext plus small helpers for
// noise, oscillators, filters, gains and envelopes used by music and effects.

let audioCtx = null;

/** The app's live AudioContext (created on first use, resumed if suspended). */
export function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

const noiseCache = new WeakMap();
export function noiseBuf(ctx) {
  if (noiseCache.has(ctx)) return noiseCache.get(ctx);
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate),
    d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseCache.set(ctx, b);
  return b;
}
export function noise(ctx, t0, t1) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf(ctx);
  s.loop = true;
  s.start(t0, Math.random() * 1.5);
  s.stop(t1);
  return s;
}
export function osc(ctx, type, f, t0, t1) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  o.start(t0);
  o.stop(t1);
  return o;
}
export function filt(ctx, type, f, q = 0.7) {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}
export function gain(ctx, v = 0) {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}
export function env(g, t0, a, peak, hold, r) {
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + a);
  g.gain.setValueAtTime(peak, t0 + a + Math.max(0, hold));
  g.gain.linearRampToValueAtTime(0, t0 + a + Math.max(0, hold) + r);
}
export function hit(g, t, peak, dec) {
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
}
export const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
