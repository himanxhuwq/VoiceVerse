import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DEFAULT_ELEVEN_MODEL, DEFAULT_GEMINI_MODEL } from '../data/constants';
import { KEYS, S, cfg, commit, useAppState } from '../state/store';
import { closeSettings } from '../state/navigation';
import { toast } from '../state/toast';
import { autoCast, getElevenVoices, loadElevenVoices, resetElevenVoices } from '../ai/voices';
import { resetAudio } from '../audio/mixer';
import { Icon } from './ui';

function SettingsPanel() {
  const initial = cfg();
  const [form, setForm] = useState({ ...initial, remember: KEYS.remembered() });
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const firstInput = useRef(null);
  useEffect(() => firstInput.current?.focus(), []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  /** A new ElevenLabs key changes the voice list, so the cast and recordings start over. */
  const recast = () => {
    if (!S.an) return;
    autoCast(S.an);
    resetAudio();
    S.built = false;
  };

  const clear = () => {
    ['vv-gem', 'vv-el', 'vv-gem-model', 'vv-el-model'].forEach((k) => KEYS.set(k, '', false));
    resetElevenVoices();
    recast();
    closeSettings();
    commit();
    toast('Keys cleared: demo mode');
  };

  const saveKeys = async () => {
    const el = form.el.trim();
    const oldEl = initial.el;
    KEYS.set('vv-gem', form.gem.trim(), form.remember);
    KEYS.set('vv-gem-model', form.gemModel.trim() || DEFAULT_GEMINI_MODEL, form.remember);
    KEYS.set('vv-el', el, form.remember);
    KEYS.set('vv-el-model', form.elModel.trim() || DEFAULT_ELEVEN_MODEL, form.remember);
    if (el && el !== oldEl) {
      resetElevenVoices();
      setChecking(true);
      try {
        await loadElevenVoices();
        toast(`ElevenLabs connected: ${getElevenVoices().length} voices`);
      } catch (e) {
        setError(e.message);
        setChecking(false);
        return;
      }
    }
    if (el !== oldEl) recast();
    closeSettings();
    commit();
  };

  return (
    <motion.div
      className="panel"
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      onClick={(e) => e.stopPropagation()}
    >
      <h2 className="disp" id="setH">
        AI keys
      </h2>
      <p className="hint" style={{ fontSize: 15, marginBottom: 24 }}>
        Without keys VoiceVerse runs in demo mode: the built-in story reader and your browser's voices. Keys stay in this browser
        and are only sent to Google and ElevenLabs.
      </p>
      <div className="field">
        <label htmlFor="kGem">
          Gemini API key <span className="hint">· from Google AI Studio</span>
        </label>
        <input
          ref={firstInput}
          className="inp mono"
          id="kGem"
          type="password"
          autoComplete="off"
          value={form.gem}
          onChange={set('gem')}
          placeholder="Paste key"
        />
      </div>
      <div className="field">
        <label htmlFor="kGemM">Gemini model</label>
        <input className="inp mono" id="kGemM" value={form.gemModel} onChange={set('gemModel')} />
      </div>
      <div className="field">
        <label htmlFor="kEl">
          ElevenLabs API key <span className="hint">· from elevenlabs.io</span>
        </label>
        <input
          className="inp mono"
          id="kEl"
          type="password"
          autoComplete="off"
          value={form.el}
          onChange={set('el')}
          placeholder="Paste key"
        />
      </div>
      <div className="field">
        <label htmlFor="kElM">ElevenLabs model</label>
        <input className="inp mono" id="kElM" value={form.elModel} onChange={set('elModel')} />
      </div>
      <label className="check" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={form.remember} onChange={set('remember')} /> Remember on this laptop
      </label>
      {error && (
        <div className="err" style={{ marginTop: 12 }}>
          <Icon name="warning-circle" />
          <span>{error}</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button className="btn btn-g" onClick={closeSettings}>
          Cancel
        </button>
        <button className="btn btn-s" onClick={clear}>
          Clear keys
        </button>
        <button className="btn btn-p" onClick={saveKeys} disabled={checking}>
          {checking ? (
            <>
              <Icon name="circle-notch" spin />
              Checking…
            </>
          ) : (
            'Save'
          )}
        </button>
      </div>
    </motion.div>
  );
}

export default function SettingsModal() {
  const { settingsOpen } = useAppState();
  return (
    <AnimatePresence>
      {settingsOpen && (
        <motion.div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="setH"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeSettings}
        >
          <SettingsPanel />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
