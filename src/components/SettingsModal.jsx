import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DEFAULT_ELEVEN_MODEL } from '../data/constants';
import { KEYS, S, aiConfig, cfg, commit, useAppState } from '../state/store';
import { PROVIDERS, detectProvider, providerById } from '../ai/providers';
import { connectAI, resetAIChoice } from '../ai/llm';
import { closeSettings } from '../state/navigation';
import { toast } from '../state/toast';
import { autoCast, getElevenVoices, loadElevenVoices, resetElevenVoices } from '../ai/voices';
import { resetAudio } from '../audio/mixer';
import { Icon } from './ui';

const AUTO = 'auto';

function SettingsPanel() {
  const ai = aiConfig();
  const initialEl = cfg();
  const [form, setForm] = useState({
    aiKey: ai.key,
    aiProvider: ai.choice,
    aiModel: ai.model,
    aiBase: ai.base,
    el: initialEl.el,
    elModel: initialEl.elModel,
    remember: KEYS.remembered(),
  });
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const firstInput = useRef(null);
  useEffect(() => firstInput.current?.focus(), []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const detected = detectProvider(form.aiKey);
  const provider = form.aiProvider === AUTO ? detected : providerById(form.aiProvider);

  /** A new ElevenLabs key changes the voice list, so the cast and recordings start over. */
  const recast = () => {
    if (!S.an) return;
    autoCast(S.an);
    resetAudio();
    S.built = false;
  };

  const clear = () => {
    ['vv-ai-key', 'vv-ai-provider', 'vv-ai-model', 'vv-ai-base', 'vv-ai-auto', 'vv-el', 'vv-el-model'].forEach((k) =>
      KEYS.set(k, '', false),
    );
    resetElevenVoices();
    recast();
    closeSettings();
    commit();
    toast('Keys cleared: demo mode');
  };

  const saveKeys = async () => {
    setError('');
    const r = form.remember;
    const aiChanged =
      form.aiKey.trim() !== ai.key ||
      form.aiProvider !== ai.choice ||
      form.aiModel.trim() !== ai.model ||
      form.aiBase.trim() !== ai.base;
    KEYS.set('vv-ai-key', form.aiKey.trim(), r);
    KEYS.set('vv-ai-provider', form.aiProvider === AUTO ? '' : form.aiProvider, r);
    KEYS.set('vv-ai-model', form.aiModel.trim(), r);
    KEYS.set('vv-ai-base', form.aiBase.trim(), r);
    const el = form.el.trim();
    KEYS.set('vv-el', el, r);
    KEYS.set('vv-el-model', form.elModel.trim() || DEFAULT_ELEVEN_MODEL, r);

    setChecking(true);
    const problems = [];
    if (form.aiKey.trim() && aiChanged) {
      resetAIChoice();
      try {
        const { label, model } = await connectAI();
        toast(`${label} connected · ${model}`);
      } catch (e) {
        problems.push(e.message);
      }
    }
    if (el && el !== initialEl.el) {
      resetElevenVoices();
      try {
        await loadElevenVoices();
        toast(`ElevenLabs connected: ${getElevenVoices().length} voices`);
      } catch (e) {
        problems.push(e.message);
      }
    }
    setChecking(false);
    if (el !== initialEl.el) recast();
    commit();
    if (problems.length) return setError(problems.join(' '));
    closeSettings();
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
        and are only sent to the AI provider you choose and to ElevenLabs.
      </p>

      <span className="cap">Story AI</span>
      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="kAi">
          AI API key <span className="hint">· Gemini, OpenAI, Claude, Grok, Groq, OpenRouter, Mistral, DeepSeek…</span>
        </label>
        <input
          ref={firstInput}
          className="inp mono"
          id="kAi"
          type="password"
          autoComplete="off"
          value={form.aiKey}
          onChange={set('aiKey')}
          placeholder="Paste any supported key"
        />
        {form.aiKey.trim() && form.aiProvider === AUTO && (
          <small className="hint" style={{ display: 'block', marginTop: 8 }}>
            {detected
              ? `Recognised as ${/^[AEIOU]/.test(detected.label) ? 'an' : 'a'} ${detected.label} key.`
              : 'Key type not recognised: choose the provider below.'}
          </small>
        )}
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="kProv">Provider</label>
          <select className="inp" id="kProv" value={form.aiProvider} onChange={set('aiProvider')}>
            <option value={AUTO}>Detect from the key</option>
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === 'custom' ? 'Other (OpenAI-compatible)' : p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="kModel">Model</label>
          <input
            className="inp mono"
            id="kModel"
            value={form.aiModel}
            onChange={set('aiModel')}
            placeholder={provider?.fixedModel || 'Automatic (recommended)'}
          />
        </div>
      </div>
      {provider?.id === 'custom' && (
        <div className="field">
          <label htmlFor="kBase">Base URL</label>
          <input className="inp mono" id="kBase" value={form.aiBase} onChange={set('aiBase')} placeholder="https://…/v1" />
        </div>
      )}
      {provider?.keyUrl && (
        <p className="hint" style={{ marginTop: -8, marginBottom: 20 }}>
          Get a {provider.label} key at {provider.keyUrl}
        </p>
      )}

      <span className="cap">Voices</span>
      <div className="field-row" style={{ marginTop: 12 }}>
        <div className="field">
          <label htmlFor="kEl">
            ElevenLabs API key <span className="hint">· optional</span>
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
          {error ? 'Close' : 'Cancel'}
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
