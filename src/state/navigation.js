// Moving between the app's steps, plus the actions that start or reset a story.
import { S, commit, hasEleven, hasGemini, notify } from './store';
import { toast } from './toast';
import { localAnalyse } from '../ai/localReader';
import { analyseWithGemini } from '../ai/gemini';
import { autoCast, loadElevenVoices } from '../ai/voices';
import { pause, resetPlayback } from '../audio/playback';
import { resetAudio } from '../audio/mixer';
import { resetBuild } from './build';
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
 * Run the story through the AI (Gemini, or the built-in reader without a key),
 * cast the voices and move to the analysis step.
 * Returns an error message to show, or '' on success.
 */
export async function analyseStory() {
  let warning = '';
  let an;
  if (hasGemini()) {
    try {
      an = await analyseWithGemini(S.text, S.title);
    } catch (e) {
      warning = 'Gemini failed, so the built-in reader was used instead. (' + e.message + ')';
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
  autoCast(an);
  S.sel = an.chars[1]?.name || 'Narrator';
  go('analysis');
  if (warning) toast(warning.slice(0, 120));
  return warning;
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
  resetAudio();
  resetBuild();
  go('story');
}
