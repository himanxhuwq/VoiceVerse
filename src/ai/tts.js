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

/** How long one ElevenLabs request may take, and how many times a failed line is retried. */
const TTS_TIMEOUT_MS = 30_000;
const TTS_ATTEMPTS = 4;

/** Turn an ElevenLabs error into a message a person can act on; `retry` marks temporary problems. */
function elevenError(status, detail) {
  const code = String(detail?.status || detail?.code || '');
  const msg = detail?.message || '';
  // ElevenLabs reports an empty balance as 401 "quota_exceeded", so check credits before the key itself.
  if (/quota|credit/i.test(code + msg) || status === 402)
    return { retry: false, text: "Your ElevenLabs credits have run out (or hit the key's credit limit)." };
  if (status === 401 && /permission|missing/i.test(code + msg))
    return {
      retry: false,
      text: 'Your ElevenLabs key is missing a permission. Give it Text to Speech: Access and Voices: Read.',
    };
  if (status === 401) return { retry: false, text: 'ElevenLabs rejected the API key. Check it in AI keys settings.' };
  if (status === 429) return { retry: true, text: 'ElevenLabs is busy (too many requests at once).' };
  if (status === 404)
    return { retry: false, text: 'ElevenLabs could not find this voice. Pick another voice for this character.' };
  if (status >= 500) return { retry: true, text: `ElevenLabs had a server problem (${status}).` };
  return { retry: false, text: `ElevenLabs ${status}${msg ? ': ' + msg : ''}` };
}

async function ttsOnce(line, p) {
  const { el, elModel } = cfg();
  let res;
  try {
    res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(p.c.voice)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
        headers: { 'xi-api-key': el, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({
          text: line.text,
          model_id: elModel,
          voice_settings: { stability: p.stab, similarity_boost: 0.75, style: p.style, use_speaker_boost: true, speed: p.speed },
        }),
      },
    );
  } catch (e) {
    // timeouts and dropped connections are worth another try
    const slow = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    throw Object.assign(
      new Error(slow ? 'ElevenLabs took too long to answer.' : 'Could not reach ElevenLabs (network problem).'),
      { retry: true },
    );
  }
  if (!res.ok) {
    let detail = {};
    try {
      detail = (await res.json()).detail || {};
    } catch {
      /* no JSON body */
    }
    const err = elevenError(res.status, detail);
    throw Object.assign(new Error(err.text), { retry: err.retry });
  }
  return res.arrayBuffer();
}

/**
 * Record one line with ElevenLabs. Returns the MP3 as an ArrayBuffer.
 * Temporary problems (busy, timeouts, server errors) are retried with a growing pause;
 * permanent ones (bad key, no credits, missing voice) fail at once with a clear message.
 */
export async function ttsEleven(line) {
  const p = voiceParams(line.speaker, line.emotion);
  if (!p.c.voice) throw new Error(`No voice is chosen for ${line.speaker}. Pick one on the Voices step.`);
  for (let attempt = 1; ; attempt++) {
    try {
      return await ttsOnce(line, p);
    } catch (e) {
      if (!e.retry || attempt >= TTS_ATTEMPTS) throw e;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** (attempt - 1) + Math.random() * 500));
    }
  }
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
