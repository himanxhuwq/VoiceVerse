// Small, dependency-free helpers shared across the app.

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const words = (t) => (t.trim().match(/\S+/g) || []).length;

/** Seconds → "mm:ss". */
export const fmtT = (x) => {
  x = Math.max(0, x || 0);
  return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(Math.floor(x % 60)).padStart(2, '0');
};

export const pad2 = (n) => String(n).padStart(2, '0');

/** Deterministic pseudo-random bar heights (0–1) for decorative waveforms. */
export function seededBars(n, seed, { lo = false, envelope = false } = {}) {
  let x = seed * 9301 + 49297;
  const r = () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
  return Array.from({ length: n }, (_, i) => {
    if (lo) return 0.35 + r() * 0.3;
    const e = envelope ? Math.sin((Math.PI * (i + 0.5)) / n) * 0.5 + 0.5 : 1;
    return envelope ? (0.18 + r() * 0.82) * (0.55 + e * 0.45) : 0.25 + r() * 0.75;
  });
}

export function slugify(title) {
  return (
    (title || 'story')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'story'
  );
}

export function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1500);
}

export function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error('could not load the MP3 encoder (offline?). Try WAV.'));
    document.head.appendChild(s);
  });
}
