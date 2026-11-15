// App state: one mutable session object plus a tiny subscribe/notify store,
// read by React components through useSyncExternalStore.
import { useSyncExternalStore } from 'react';
import { DEFAULT_ELEVEN_MODEL, DEFAULT_GEMINI_MODEL } from '../data/constants';

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
 */
export const S = {
  view: 'home',
  title: '',
  text: '',
  lang: 'en',
  genreHint: 'auto',
  tab: 'paste',
  an: null,
  cast: {},
  sel: null,
  built: false,
  fmt: 'mp3',
  selBlock: null,
  settingsOpen: false,
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

const PERSISTED = ['view', 'title', 'text', 'lang', 'genreHint', 'an', 'cast', 'sel', 'fmt'];

export function save() {
  if (!storage) return;
  try {
    const snapshot = Object.fromEntries(PERSISTED.map((k) => [k, S[k]]));
    storage.setItem('vv-state', JSON.stringify(snapshot));
  } catch {
    /* storage full or blocked: the session still works, it just won't persist */
  }
}

/** Save and re-render. Call after any change to S. */
export function commit() {
  save();
  notify();
}

export function load() {
  try {
    const saved = JSON.parse(storage?.getItem('vv-state') || 'null');
    if (saved) Object.assign(S, saved);
  } catch {
    /* ignore a corrupt save */
  }
  S.view = 'home'; // always open on the home page; a saved story can be resumed from there
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
    return !!storage?.getItem('vv-gem') || !!storage?.getItem('vv-el');
  },
};

export const cfg = () => ({
  gem: KEYS.get('vv-gem'),
  gemModel: KEYS.get('vv-gem-model') || DEFAULT_GEMINI_MODEL,
  el: KEYS.get('vv-el'),
  elModel: KEYS.get('vv-el-model') || DEFAULT_ELEVEN_MODEL,
});

export const hasGemini = () => !!cfg().gem;
export const hasEleven = () => !!cfg().el;
