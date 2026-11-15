// Export: encode the mixed AudioBuffer as WAV or MP3, and build the plain-text script.
import { clamp, loadScript, sleep } from '../lib/utils';

const LAME_URL = 'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';

const toInt16 = (v) => {
  v = clamp(v, -1, 1);
  return v < 0 ? v * 0x8000 : v * 0x7fff;
};

/** 16-bit PCM WAV file from an AudioBuffer. */
export function toWav(buf) {
  const ch = buf.numberOfChannels;
  const sr = buf.sampleRate;
  const n = buf.length;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const writeStr = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));

  writeStr(0, 'RIFF');
  out.setUint32(4, 36 + n * ch * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, ch, true);
  out.setUint32(24, sr, true);
  out.setUint32(28, sr * ch * 2, true);
  out.setUint16(32, ch * 2, true);
  out.setUint16(34, 16, true);
  writeStr(36, 'data');
  out.setUint32(40, n * ch * 2, true);

  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      out.setInt16(o, toInt16(data[c][i]), true);
      o += 2;
    }
  }
  return out.buffer;
}

/** 128 kbps MP3 from an AudioBuffer (lamejs, loaded on demand). */
export async function toMp3(buf) {
  await loadScript(LAME_URL);
  const enc = new window.lamejs.Mp3Encoder(2, buf.sampleRate, 128);
  const asInt16 = (a) => {
    const o = new Int16Array(a.length);
    for (let i = 0; i < a.length; i++) o[i] = toInt16(a[i]);
    return o;
  };
  const left = asInt16(buf.getChannelData(0));
  const right = asInt16(buf.getChannelData(1));
  const parts = [];
  const BLOCK = 1152 * 20;
  for (let i = 0; i < left.length; i += BLOCK) {
    const m = enc.encodeBuffer(left.subarray(i, i + BLOCK), right.subarray(i, i + BLOCK));
    if (m.length) parts.push(new Uint8Array(m));
    if (i % (BLOCK * 40) === 0) await sleep(0); // keep the page responsive
  }
  const end = enc.flush();
  if (end.length) parts.push(new Uint8Array(end));
  return new Blob(parts, { type: 'audio/mpeg' });
}

/** The full script, scene by scene, every line labelled with its speaker. */
export function scriptText(an) {
  const scenes = an.scenes.map(
    (s, i) =>
      `SCENE ${i + 1}: ${s.title.toUpperCase()} (${s.mood})\n` +
      an.lines
        .filter((l) => l.scene === i)
        .map((l) => `${l.speaker.toUpperCase()}: ${l.text}`)
        .join('\n'),
  );
  return `${an.title}\n\n${scenes.join('\n\n')}`;
}
