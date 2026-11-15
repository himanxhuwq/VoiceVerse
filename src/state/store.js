// App state: one mutable session object plus a tiny subscribe/notify store,
// read by React components through useSyncExternalStore.
import { useSyncExternalStore } from 'react';
import { DEFAULT_ELEVEN_MODEL } from '../data/constants';
import { detectLanguage } from '../lib/language';
import { detectProvider, providerById } from '../ai/providers';

const storage = (() => {
  try {
    localStorage.setItem('_t', '1');
    localStorage.removeItem('_t');
    return localStorage;
  } catch {
    return null;
  }
})();

/**
 * The working session.
 * an    = the story analysis: { title, genre, style, arc, scenes[], chars[], lines[], engine }
 * cast  = voice settings per character name: { voice, speed, tone, emotion }
 * aiCast = AI voice recommendations: { status: 'idle'|'working'|'done'|'error', picks: { [name]: { voice, reason } }, error }
 *
 * Only API keys are kept between visits (see KEYS); the story itself resets on refresh.
 */
export const S = {
  view: 'home',
  title: '',
  text: '',
  lang: 'auto', // 'auto' = detect from the story's script, or a language code
  genreHint: 'auto',
  tab: 'paste',
  an: null,
  cast: {},
  sel: null,
  built: false,
  fmt: 'mp3',
  selBlock: null,
  settingsOpen: false,
  aiCast: { status: 'idle', picks: {}, error: '' },
};

let version = 0;
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Re-render every component that reads the store. */
export function notify() {
  version++;
  listeners.forEach((fn) => fn());
}

/** React hook: returns the session and re-renders when it changes. */
export function useAppState() {
  useSyncExternalStore(subscribe, () => version);
  return S;
}

/** Re-render after any change to S. The story lives in memory only, so a page refresh starts fresh. */
export function commit() {
  notify();
}

/** Remove the story saved by earlier versions of the app (they kept it across refreshes). */
export function clearSavedStory() {
  try {
    storage?.removeItem('vv-state');
  } catch {
    /* ignore */
  }
}

/* ---------- API keys (kept in this browser only) ---------- */

export const KEYS = {
  get(k) {
    try {
      return sessionStorage.getItem(k) || storage?.getItem(k) || '';
    } catch {
      return '';
    }
  },
  set(k, v, remember) {
    try {
      sessionStorage.setItem(k, v);
      if (remember && v) storage?.setItem(k, v);
      else storage?.removeItem(k);
    } catch {
      /* ignore */
    }
  },
  remembered() {
    return !!storage?.getItem('vv-ai-key') || !!storage?.getItem('vv-el');
  },
};

/** Keys saved by earlier versions (Gemini only) move to the new any-provider settings. */
(function migrateOldKeys() {
  try {
    const old = KEYS.get('vv-gem');
    if (old && !KEYS.get('vv-ai-key')) KEYS.set('vv-ai-key', old, !!storage?.getItem('vv-gem'));
    ['vv-gem', 'vv-gem-model'].forEach((k) => {
      sessionStorage.removeItem(k);
      storage?.removeItem(k);
    });
  } catch {
    /* ignore */
  }
})();

/**
 * The AI settings. The provider is chosen in settings or, by default, recognised from the key.
 * model: '' means "pick automatically from the provider's model list".
 */
export function aiConfig() {
  const key = KEYS.get('vv-ai-key').trim();
  const choice = KEYS.get('vv-ai-provider') || 'auto';
  return {
    key,
    choice,
    provider: choice === 'auto' ? detectProvider(key) : providerById(choice),
    model: KEYS.get('vv-ai-model').trim(),
    base: KEYS.get('vv-ai-base').trim().replace(/\/+$/, ''),
  };
}

export const cfg = () => ({
  el: KEYS.get('vv-el'),
  elModel: KEYS.get('vv-el-model') || DEFAULT_ELEVEN_MODEL,
});

export const hasAI = () => {
  const a = aiConfig();
  return !!(a.key && a.provider);
};
export const hasEleven = () => !!cfg().el;

/** The story's language: chosen on the Story step, or detected from its script. */
export const storyLang = () => (S.lang === 'auto' ? detectLanguage(S.text) : S.lang);
/** Language of the analysed story (what voices and audio should use). */
export const currentLang = () => S.an?.lang || storyLang();
