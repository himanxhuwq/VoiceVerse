import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GENRE_OPTIONS } from '../data/constants';
import { SAMPLES } from '../data/samples';
import { clamp, words } from '../lib/utils';
import { S, commit, hasGemini, useAppState } from '../state/store';
import { analyseStory, openSettings } from '../state/navigation';
import { toast } from '../state/toast';
import { generateStory } from '../ai/gemini';
import { Icon } from '../components/ui';

/** Longest story the app accepts (longer stories take longer to analyse and record). */
const MAX_WORDS = 1000;

const TABS = [
  ['paste', 'text-aa', 'Paste text'],
  ['upload', 'upload-simple', 'Upload .txt'],
  ['gen', 'sparkle', 'Generate a story'],
];

function wordMessage(w) {
  if (w === 0) return `Up to ${MAX_WORDS} words`;
  if (w < 40) return 'A little more, please (40 words minimum)';
  if (w < 300) return 'Short and sweet, about ' + Math.max(1, Math.round(w / 150)) + ' min';
  if (w <= MAX_WORDS) return 'Good length for a ' + Math.round(w / 150) + '–' + Math.round(w / 120) + ' minute story';
  return `Too long: keep it under ${MAX_WORDS} words`;
}

function UploadTab() {
  const [over, setOver] = useState(false);
  const read = (file) => {
    if (!file) return;
    if (!/\.txt$/i.test(file.name) && file.type !== 'text/plain') return toast('Please choose a .txt file');
    if (file.size > 200000) return toast('That file is too big');
    const r = new FileReader();
    r.onload = () => {
      S.text = String(r.result);
      if (!S.title) S.title = file.name.replace(/\.txt$/i, '').replace(/[-_]+/g, ' ');
      S.tab = 'paste';
      commit();
      toast('Story loaded');
    };
    r.readAsText(file);
  };
  return (
    <label
      className={`drop ${over ? 'over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        read(e.dataTransfer.files[0]);
      }}
    >
      <motion.i className="ph ph-file-text" animate={{ y: over ? -6 : 0 }} />
      <b style={{ color: 'var(--tx)' }}>Drop a .txt file here</b>
      <span>or click to choose one. PDF comes after the MVP.</span>
      <input type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => read(e.target.files[0])} />
    </label>
  );
}

function GenerateTab({ busy, setBusy, setError }) {
  const [idea, setIdea] = useState('');
  const generate = async () => {
    if (!hasGemini()) {
      const next = SAMPLES[(SAMPLES.findIndex((x) => x.title === S.title) + 1) % SAMPLES.length];
      Object.assign(S, { title: next.title, text: next.text, tab: 'paste' });
      commit();
      toast('Loaded a sample story');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const story = await generateStory(S.genreHint === 'auto' ? 'fantasy' : S.genreHint, idea);
      Object.assign(S, { title: story.title, text: story.text, tab: 'paste' });
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
    commit();
  };
  return (
    <div className="drop" style={{ borderStyle: 'solid' }}>
      <motion.i
        className="ph ph-sparkle"
        style={{ color: 'var(--sfx)' }}
        animate={{ rotate: [0, 15, -10, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      />
      <b style={{ color: 'var(--tx)' }}>Generate a fantasy story</b>
      <span>
        {hasGemini()
          ? 'Gemini writes a fresh 300–400 word story you can edit.'
          : 'Without a Gemini key this loads one of the built-in sample stories.'}
      </span>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
        <input
          className="inp"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="Optional idea, e.g. a dragon who is afraid of the dark"
          style={{ width: 'min(420px,80vw)' }}
        />
        <button className="btn btn-p" onClick={generate} disabled={busy}>
          {busy ? (
            <>
              <Icon name="circle-notch" spin />
              Writing…
            </>
          ) : (
            <>
              <Icon name="sparkle" />
              Generate
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function Story() {
  const state = useAppState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const w = words(state.text);
  const meterClass = w > MAX_WORDS ? 'bad' : w > MAX_WORDS * 0.85 ? 'warn' : '';

  const update = (patch) => {
    Object.assign(S, patch);
    commit();
  };

  const analyse = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await analyseStory();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="wrap">
      <div className="split">
        <div className="editor" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h1 className="disp h1">Your story</h1>
            <p className="hint" style={{ fontSize: 16 }}>
              Paste it, upload a .txt, or let VoiceVerse write one to start from.
            </p>
          </div>
          <div className="tabs" role="tablist">
            {TABS.map(([key, icon, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={state.tab === key}
                className={state.tab === key ? 'on' : ''}
                onClick={() => update({ tab: key })}
              >
                <Icon name={icon} />
                {label}
              </button>
            ))}
          </div>
          <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 440 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={state.tab}
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                {state.tab === 'upload' ? (
                  <UploadTab />
                ) : state.tab === 'gen' ? (
                  <GenerateTab busy={busy} setBusy={setBusy} setError={setError} />
                ) : (
                  <textarea
                    aria-label="Story text"
                    placeholder="Once upon a time…  (Put dialogue in quote marks so each character gets a voice.)"
                    value={state.text}
                    onChange={(e) => update({ text: e.target.value })}
                  />
                )}
              </motion.div>
            </AnimatePresence>
            <div className="ft">
              <span className="mono" style={{ fontSize: 14 }}>
                <b>{w}</b> <span className="hint">/ {MAX_WORDS} words</span>
              </span>
              <span className={`meter ${meterClass}`}>
                <motion.i
                  animate={{ width: clamp((w / MAX_WORDS) * 100, 0, 100) + '%' }}
                  transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                />
              </span>
              <span className="hint">{wordMessage(w)}</span>
              {state.text && (
                <button
                  className="btn btn-g btn-sm"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => update({ text: '', title: '', tab: 'paste' })}
                >
                  <Icon name="eraser" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <aside className="side">
          <div className="panel">
            <div className="field">
              <label htmlFor="lang">Language</label>
              <select className="inp" id="lang" value={state.lang} onChange={(e) => update({ lang: e.target.value })}>
                <option value="en">English</option>
                <option disabled>Bengali (after the MVP)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="genre">Genre</label>
              <select className="inp" id="genre" value={state.genreHint} onChange={(e) => update({ genreHint: e.target.value })}>
                {GENRE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g === 'auto' ? 'Let the AI decide' : g}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="title">Story title</label>
              <input
                className="inp"
                id="title"
                value={state.title}
                placeholder="Optional"
                onChange={(e) => update({ title: e.target.value })}
              />
            </div>
          </div>
          <div className="panel" style={{ padding: '20px 24px' }}>
            <span className="cap">Works best with</span>
            <div style={{ marginTop: 12 }}>
              {['2–4 named characters', 'Dialogue in quote marks', 'Sounds you can hear: rain, doors, steps'].map((t) => (
                <div key={t} className="check">
                  <Icon name="check-circle" fill />
                  {t}
                </div>
              ))}
            </div>
          </div>
          {!hasGemini() && (
            <div className="note">
              <Icon name="info" />
              <span>
                Demo mode uses the built-in story reader.{' '}
                <button style={{ textDecoration: 'underline' }} onClick={openSettings}>
                  Add a Gemini key
                </button>{' '}
                for full AI analysis.
              </span>
            </div>
          )}
          <AnimatePresence>
            {error && (
              <motion.div
                className="err"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Icon name="warning-circle" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button
            whileHover={{ scale: busy ? 1 : 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn btn-p btn-l"
            style={{ marginTop: 'auto' }}
            disabled={w < 40 || w > MAX_WORDS || busy}
            onClick={analyse}
          >
            {busy ? (
              <>
                <Icon name="circle-notch" spin />
                Reading your story…
              </>
            ) : (
              <>
                Analyse story
                <Icon name="arrow-right" />
              </>
            )}
          </motion.button>
        </aside>
      </div>
    </div>
  );
}
