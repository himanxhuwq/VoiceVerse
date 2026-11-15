// Text-to-speech: ElevenLabs (recorded MP3) or the browser's Web Speech API (live).
import { cfg, hasEleven } from '../state/store';
import { estimateDuration, getBrowserVoices, voiceParams } from './voices';

/**
 * Speak one line live with a browser voice. Calls onEnd when finished.
 * Returns a cancel function.
 */
export function speakBrowser(line, onEnd) {
  const voices = getBrowserVoices();
  if (!('speechSynthesis' in window) || !voices.length) {
    const t = setTimeout(onEnd, estimateDuration(line) * 1000);
    return () => clearTimeout(t);
  }
  const p = voiceParams(line.speaker, line.emotion);
  const u = new SpeechSynthesisUtterance(line.text);
  const v = voices.find((x) => x.name === p.c.voice) || voices[0];
  u.voice = v;
  u.lang = v.lang;
  u.rate = p.rate;
  u.pitch = p.pitch;
  u.volume = p.vol;

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onEnd();
  };
  // Safety net: some browsers never fire onend.
  const guard = setTimeout(finish, (estimateDuration(line) * 2.2 + 3) * 1000);
  u.onend = () => {
    clearTimeout(guard);
    finish();
  };
  u.onerror = finish;
  speechSynthesis.speak(u);
  return () => {
    done = true;
    clearTimeout(guard);
    speechSynthesis.cancel();
  };
}

/** Record one line with ElevenLabs. Returns the MP3 as an ArrayBuffer. */
export async function ttsEleven(line) {
  const p = voiceParams(line.speaker, line.emotion);
  const { el, elModel } = cfg();
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(p.c.voice)}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': el, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text: line.text,
        model_id: elModel,
        voice_settings: { stability: p.stab, similarity_boost: 0.75, style: p.style, use_speaker_boost: true, speed: p.speed },
      }),
    },
  );
  if (!res.ok) {
    let msg = '';
    try {
      const j = await res.json();
      msg = j.detail?.message || j.detail?.status || '';
    } catch {
      /* no JSON body */
    }
    const hint = res.status === 401 ? ' (check the key)' : res.status === 429 ? ' (rate or credit limit reached)' : '';
    throw new Error(`ElevenLabs ${res.status}${hint}${msg ? ': ' + msg : ''}`);
  }
  return res.arrayBuffer();
}

/* ---------- previews ---------- */

let previewAudio = null;

export function stopPreview() {
  if (previewAudio) {
    previewAudio.pause();
    previewAudio = null;
  }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

/** Play a stock preview clip (ElevenLabs voices have one). */
export function playPreviewUrl(url) {
  stopPreview();
  previewAudio = new Audio(url);
  previewAudio.play().catch(() => {});
}

/**
 * Speak a sample line in a character's voice.
 * onState receives 'loading' | 'playing' | 'idle'.
 */
export async function previewLine(name, text, onState = () => {}) {
  stopPreview();
  const line = { speaker: name, text };
  if (hasEleven()) {
    onState('loading');
    const ab = await ttsEleven(line);
    const url = URL.createObjectURL(new Blob([ab], { type: 'audio/mpeg' }));
    previewAudio = new Audio(url);
    previewAudio.onended = () => onState('idle');
    await previewAudio.play();
    onState('playing');
  } else {
    onState('playing');
    speakBrowser(line, () => onState('idle'));
  }
}
