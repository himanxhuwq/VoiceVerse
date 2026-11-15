// Moving between the app's steps, plus the actions that start or reset a story.
import { S, commit, hasAI, hasEleven, notify } from './store';
import { toast } from './toast';
import { localAnalyse } from '../ai/localReader';
import { aiLabel, analyseWithAI, recommendVoices } from '../ai/llm';
import { autoCast, loadElevenVoices, voiceList } from '../ai/voices';
import { pause, resetPlayback } from '../audio/playback';
import { resetAudio } from '../audio/mixer';
import { isBuilding, resetBuild } from './build';
import { sleep } from '../lib/utils';

/** Which steps the user can open right now. */
export function reachable() {
  const has = !!S.an;
  const built = has && S.built;
  return { story: true, analysis: has, voices: has, build: has, timeline: built, player: built, export: built };
}

export function go(view) {
  if (view !== 'player' && view !== 'timeline') pause();
  if (view === 'home' || reachable()[view]) {
    S.view = view;
    commit();
    window.scrollTo(0, 0);
  }
}

export function openSettings() {
  S.settingsOpen = true;
  notify();
}

export function closeSettings() {
  S.settingsOpen = false;
  notify();
}

/**
 * Run the story through the AI (any supported provider, or the built-in reader without a key),
 * cast the voices and move to the analysis step.
 * Returns an error message to show, or '' on success.
 */
export async function analyseStory() {
  let warning = '';
  let an;
  if (hasAI()) {
    try {
      an = await analyseWithAI(S.text, S.title);
    } catch (e) {
      warning = `${aiLabel()} failed, so the built-in reader was used instead. (${e.message})`;
      an = localAnalyse(S.text, S.title);
    }
  } else {
    await sleep(700); // a beat so the "reading" state is visible
    an = localAnalyse(S.text, S.title);
  }
  if (S.genreHint !== 'auto') an.genre = S.genreHint;

  S.an = an;
  S.built = false;
  S.selBlock = null;
  resetAudio();
  resetBuild();
  resetPlayback();
  if (hasEleven()) {
    try {
      await loadElevenVoices();
    } catch (e) {
      warning = e.message;
    }
  }
  S.aiCast = { status: 'idle', picks: {}, error: '' };
  autoCast(an);
  S.sel = an.chars[1]?.name || 'Narrator';
  go('analysis');
  if (warning) toast(warning.slice(0, 120));
  castWithAI(); // runs in the background while the user reads the analysis
  return warning;
}

/**
 * Let the AI cast the story: it reads each character's role and lines and picks the
 * best-fitting voice from the available catalogue, with a one-line reason.
 * The rule-based auto-cast stays in place if the AI is unavailable or fails.
 */
export async function castWithAI({ force = false } = {}) {
  const an = S.an;
  const voices = voiceList();
  if (!an || !hasAI() || !voices.length) return;
  S.aiCast = { status: 'working', picks: {}, error: '' };
  notify();
  try {
    const picks = await recommendVoices(an, voices);
    if (S.an !== an) return; // a new story was started meanwhile
    // Apply the picks only before any audio exists, and never over a voice the user chose by hand.
    // Otherwise they stay as recommendations (badges) the user can click.
    if (!isBuilding() && (force || !S.built)) {
      let changed = false;
      Object.entries(picks).forEach(([name, pick]) => {
        const c = S.cast[name];
        if (c && (force || !c.manual) && c.voice !== pick.voice) {
          c.manual = false;
          c.voice = pick.voice;
          changed = true;
        }
      });
      if (changed) {
        resetAudio();
        S.built = false;
      }
    }
    S.aiCast = { status: 'done', picks, error: '' };
  } catch (e) {
    if (S.an !== an) return;
    S.aiCast = { status: 'error', picks: {}, error: e.message };
  }
  notify();
}

/** Throw the current story away and start again. */
export function newStory() {
  pause();
  S.an = null;
  S.text = '';
  S.title = '';
  S.built = false;
  S.cast = {};
  S.selBlock = null;
  S.aiCast = { status: 'idle', picks: {}, error: '' };
  resetAudio();
  resetBuild();
  go('story');
}
