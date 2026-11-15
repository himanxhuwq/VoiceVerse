// The audio build pipeline: script → voices → music → effects → mix.
// Progress is published to the Build screen through useBuild().
import { useSyncExternalStore } from 'react';
import { S, commit, hasEleven } from './store';
import { cap1, fmtT, sleep } from '../lib/utils';
import { ttsEleven } from '../ai/tts';
import { audio, layout, renderMix } from '../audio/mixer';
import { ac } from '../audio/nodes';
import { go } from './navigation';

export const BUILD_STEPS = [
  { key: 'script', icon: 'scroll', label: 'Writing the script' },
  { key: 'voices', icon: 'microphone', label: 'Recording voices' },
  { key: 'music', icon: 'music-notes', label: 'Scoring the music' },
  { key: 'sfx', icon: 'waveform', label: 'Placing sound effects' },
  { key: 'mix', icon: 'sliders-horizontal', label: 'Mixing it together' },
];
/** Share of the progress ring each step takes (recording voices is the slow part). */
const WEIGHTS = [0.08, 0.62, 0.1, 0.08, 0.12];
const startOf = (i) => WEIGHTS.slice(0, i).reduce((a, b) => a + b, 0);

let B = { running: false, step: 0, progress: 0, detail: {}, error: null };
const listeners = new Set();
function emit(patch) {
  B = { ...B, ...patch, detail: { ...B.detail, ...(patch?.detail || {}) } };
  listeners.forEach((fn) => fn());
}

export function useBuild() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => B,
  );
}

/** True while the pipeline is recording or mixing. */
export const isBuilding = () => B.running;

export function resetBuild() {
  B = { running: false, step: 0, progress: 0, detail: {}, error: null };
}

/** Record every line with ElevenLabs, two at a time (the most a free ElevenLabs plan allows). */
async function recordVoices(i) {
  const an = S.an;
  const todo = an.lines.map((_, j) => j).filter((j) => !audio.buffers[j]);
  let done = an.lines.length - todo.length;
  const ctx = ac();
  const worker = async () => {
    while (todo.length) {
      const j = todo.shift();
      const l = an.lines[j];
      emit({ detail: { voices: `${l.speaker} · line ${done + 1} of ${an.lines.length}` } });
      try {
        audio.buffers[j] = await ctx.decodeAudioData(await ttsEleven(l));
      } catch (e) {
        todo.length = 0; // stop the other worker too; lines already recorded are kept for "Retry"
        throw new Error(`Line ${j + 1} (${l.speaker}): ${e.message}`);
      }
      done++;
      emit({ progress: startOf(i) + (WEIGHTS[i] * done) / an.lines.length });
    }
  };
  await Promise.all([worker(), worker()]);
  emit({ detail: { voices: `${an.lines.length} lines recorded` } });
}

/** Browser voices play live, so this step only prepares them. */
async function prepareLiveVoices(i) {
  const an = S.an;
  for (let j = 0; j < an.lines.length; j++) {
    emit({
      detail: { voices: `${an.lines[j].speaker} · line ${j + 1} of ${an.lines.length}` },
      progress: startOf(i) + (WEIGHTS[i] * (j + 1)) / an.lines.length,
    });
    await sleep(Math.min(60, 1800 / an.lines.length));
  }
  emit({ detail: { voices: `${an.chars.length} voices ready (they play live)` } });
}

export async function runBuild(from = 0) {
  if (B.running) return;
  const an = S.an;
  emit({ running: true, error: null, step: from, progress: startOf(from) });
  try {
    for (let i = from; i < BUILD_STEPS.length; i++) {
      const key = BUILD_STEPS[i].key;
      emit({ step: i, progress: startOf(i) });
      if (key === 'script') {
        emit({ detail: { script: `${an.lines.length} lines, each tagged to a speaker` } });
        await sleep(500);
      }
      if (key === 'voices') await (hasEleven() ? recordVoices(i) : prepareLiveVoices(i));
      if (key === 'music') {
        layout();
        emit({ detail: { music: an.scenes.map((s) => cap1(s.mood)).join(' → ') } });
        await sleep(450);
      }
      if (key === 'sfx') {
        const n = an.scenes.reduce((a, s) => a + s.sfx.length, 0);
        emit({ detail: { sfx: `${n} cue${n === 1 ? '' : 's'} across ${an.scenes.length} scenes` } });
        await sleep(450);
      }
      if (key === 'mix') {
        layout();
        if (hasEleven()) {
          emit({ detail: { mix: 'Voices on top, music underneath' } });
          audio.mix = await renderMix(true);
          audio.dirty = false;
        } else {
          emit({ detail: { mix: `${fmtT(an.total)} long` } });
          await sleep(400);
        }
      }
    }
    S.built = true;
    commit();
    emit({ progress: 1, step: BUILD_STEPS.length - 1, running: false });
    if (S.view === 'build') {
      await sleep(900);
      if (S.view === 'build') go('timeline');
    }
  } catch (e) {
    emit({ running: false, error: e.message || String(e) });
  }
}
