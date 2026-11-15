import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { EMO } from '../data/constants';
import { cap1 } from '../lib/utils';
import { S, commit, hasEleven, hasGemini, useAppState } from '../state/store';
import { castWithAI, go } from '../state/navigation';
import { toast } from '../state/toast';
import { voiceList } from '../ai/voices';
import { playPreviewUrl, previewLine, stopPreview } from '../ai/tts';
import { resetAudio } from '../audio/mixer';
import { pause } from '../audio/playback';
import { Avatar, Icon, Range, rise, stagger } from '../components/ui';

const toneLabel = (t) => (t < 35 ? 'Deep' : t > 65 ? 'Bright' : 'Natural');

/** Any change to a voice means the recordings and the mix must be rebuilt. */
function voiceChanged() {
  resetAudio();
  S.built = false;
}

export default function Voices() {
  const { an, cast, sel: selected, aiCast } = useAppState();
  const [previewing, setPreviewing] = useState(null); // id of the button whose preview is playing
  const [, force] = useState(0);
  useEffect(() => () => stopPreview(), []);

  const sel = cast[selected] ? selected : an.chars[0].name;
  const charIndex = Math.max(
    0,
    an.chars.findIndex((c) => c.name === sel),
  );
  const c = an.chars[charIndex];
  const cc = cast[sel];
  const list = voiceList();
  const firstLine = an.lines.find((l) => l.speaker === sel);

  const preview = async (id, name, text) => {
    pause();
    try {
      await previewLine(name, text, (state) => setPreviewing(state === 'idle' ? null : id));
    } catch (e) {
      toast(e.message);
      setPreviewing(null);
    }
  };

  const pickVoice = (v, wantsPreview) => {
    cc.voice = v.id;
    cc.manual = true; // AI casting won't override a voice picked by hand
    voiceChanged();
    commit();
    if (!wantsPreview) return;
    if (hasEleven() && v.preview) playPreviewUrl(v.preview);
    else preview(v.id, sel, `Hello. I'm ${sel === 'Narrator' ? 'your narrator' : sel}, and this is how I sound.`);
  };

  const setControl = (patch) => {
    Object.assign(cc, patch);
    force((n) => n + 1);
  };

  return (
    <div className="vs">
      <div className="castlist">
        <span className="cap" style={{ margin: '0 8px 8px' }}>
          Cast · {an.chars.length} voices
        </span>
        {an.chars.map((x, i) => {
          const v = list.find((v) => v.id === cast[x.name]?.voice);
          const on = x.name === sel;
          return (
            <button
              key={x.name}
              className={`ci ${on ? 'on' : ''}`}
              onClick={() => {
                stopPreview();
                S.sel = x.name;
                commit();
              }}
            >
              {on && (
                <motion.span
                  layoutId="cast-pill"
                  className="ci-pill"
                  transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                />
              )}
              <Avatar name={x.name} index={i} />
              <div>
                <b>{x.name}</b>
                <small>{v ? v.name : 'Default voice'}</small>
              </div>
              <Icon name="check-circle" fill style={{ color: 'var(--mus)' }} />
            </button>
          );
        })}
        <div className="castfoot" style={{ marginTop: 'auto', padding: '16px 8px 0', borderTop: '1px solid var(--line)' }}>
          <p className="hint" style={{ marginBottom: 12 }}>
            VoiceVerse picked a voice for everyone. Change any you don't like.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn btn-p"
            style={{ width: '100%' }}
            onClick={() => {
              stopPreview();
              go('build');
            }}
          >
            Build the audio
            <Icon name="arrow-right" />
          </motion.button>
        </div>
      </div>

      <motion.div
        key={sel}
        className="vmain"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="head">
          <div className="who">
            <Avatar name={c.name} index={charIndex} />
            <div>
              <span className="cap">{c.role}</span>
              <h2 className="disp h1" style={{ marginTop: 8 }}>
                {c.name}
              </h2>
            </div>
          </div>
          <span className="chip">
            <Icon name={hasEleven() ? 'waveform' : 'desktop'} style={{ color: 'var(--sfx)' }} />
            {hasEleven() ? 'ElevenLabs voices' : 'Voices from this browser'}
          </span>
        </div>

        <AiCastPanel aiCast={aiCast} pick={aiCast.picks[sel]} voice={list.find((v) => v.id === aiCast.picks[sel]?.voice)} />

        {!list.length && (
          <div className="note">
            <Icon name="info" />
            <span>
              {hasEleven()
                ? 'No ElevenLabs voices loaded yet. Check your key in settings.'
                : 'This browser has no built-in English voices, so playback will run silently with music and effects. Try Chrome or Safari on a laptop, or add an ElevenLabs key.'}
            </span>
          </div>
        )}

        <motion.div className="voices" variants={stagger(0.025)} initial="hidden" animate="show">
          {list.map((v) => {
            const on = v.id === cc.voice;
            return (
              <motion.button
                key={v.id}
                variants={rise}
                layout
                whileHover={{ y: -2 }}
                className={`voice ${on ? 'on' : ''}`}
                onClick={(e) => pickVoice(v, !!e.target.closest('.play'))}
              >
                <span className="play" role="button" aria-label={`Preview ${v.name}`}>
                  <Icon name={previewing === v.id ? 'pause' : 'play'} fill />
                </span>
                {aiCast.picks[sel]?.voice === v.id && (
                  <span className="ai-badge" title={aiCast.picks[sel].reason}>
                    <Icon name="sparkle" fill />
                    AI pick
                  </span>
                )}
                <div style={{ minWidth: 0 }}>
                  <b>{v.name}</b>
                  <small>{[v.gender !== 'unknown' ? cap1(v.gender) : '', v.desc].filter(Boolean).join(' · ')}</small>
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        <div className="ctrls">
          <div className="panel ctrl">
            <div className="row">
              <b>Speed</b>
              <span className="mono">{cc.speed.toFixed(2)}×</span>
            </div>
            <Range
              label="Speed"
              min={0.7}
              max={1.3}
              step={0.05}
              value={cc.speed}
              onChange={(speed) => setControl({ speed })}
              onCommit={voiceChanged}
            />
            <div className="ends">
              <span>Slower</span>
              <span>Faster</span>
            </div>
          </div>
          <div className="panel ctrl">
            <div className="row">
              <b>Tone</b>
              <span className="mono">{toneLabel(cc.tone)}</span>
            </div>
            <Range
              label="Tone"
              min={0}
              max={100}
              step={1}
              value={cc.tone}
              onChange={(tone) => setControl({ tone })}
              onCommit={voiceChanged}
            />
            <div className="ends">
              <span>Deep</span>
              <span>Bright</span>
            </div>
          </div>
          <div className="panel ctrl">
            <div className="row">
              <b>Emotion</b>
              <span className="hint">default for this voice</span>
            </div>
            <div className="emo">
              {Object.keys(EMO).map((e) => (
                <motion.button
                  key={e}
                  whileTap={{ scale: 0.92 }}
                  className={`chip ${cc.emotion === e ? 'on' : ''}`}
                  onClick={() => {
                    setControl({ emotion: e });
                    voiceChanged();
                  }}
                >
                  {cap1(e)}
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        <div className="panel preview">
          <button
            className="play"
            aria-label="Hear this line"
            onClick={() => preview('line', sel, (firstLine?.text || 'This is how I will sound in your story.').slice(0, 240))}
          >
            <Icon name={previewing === 'line' ? 'pause' : 'play'} fill />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="cap">Hear it in the story{firstLine ? ' · scene ' + (firstLine.scene + 1) : ''}</span>
            <q>{(firstLine?.text || 'This is how I will sound in your story.').slice(0, 160)}</q>
          </div>
        </div>

        {/* On phones the cast sidebar becomes a scroller without its footer, so the next step lives here. */}
        <button
          className="btn btn-p btn-l mobile-only"
          onClick={() => {
            stopPreview();
            go('build');
          }}
        >
          Build the audio
          <Icon name="arrow-right" />
        </button>
      </motion.div>
    </div>
  );
}

/** What the AI casting director decided for this character, or that it is still working. */
function AiCastPanel({ aiCast, pick, voice }) {
  if (!hasGemini()) return null;
  const recast = (
    <button className="btn btn-s btn-sm" onClick={() => castWithAI({ force: true })} disabled={aiCast.status === 'working'}>
      <Icon name="sparkle" />
      {aiCast.status === 'done' ? 'Recast with AI' : 'Cast with AI'}
    </button>
  );
  return (
    <motion.div className="panel ai-cast" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <span className="ai-ic">
        <Icon
          name={aiCast.status === 'working' ? 'circle-notch' : 'sparkle'}
          fill={aiCast.status !== 'working'}
          spin={aiCast.status === 'working'}
        />
      </span>
      <div style={{ minWidth: 0 }}>
        {aiCast.status === 'working' && (
          <>
            <b>AI is casting your story…</b>
            <small>Gemini is reading each character's lines to pick the best-fitting voice.</small>
          </>
        )}
        {aiCast.status === 'done' && pick && (
          <>
            <b>AI recommends {voice?.name.split(' - ')[0] || 'this voice'}</b>
            <small>{pick.reason}</small>
          </>
        )}
        {aiCast.status === 'done' && !pick && (
          <>
            <b>No AI pick for this character</b>
            <small>The rule-based casting is used instead.</small>
          </>
        )}
        {aiCast.status === 'error' && (
          <>
            <b>AI casting failed</b>
            <small>{aiCast.error}</small>
          </>
        )}
        {aiCast.status === 'idle' && (
          <>
            <b>Let AI cast the voices</b>
            <small>Gemini picks the best voice for each character from their lines.</small>
          </>
        )}
      </div>
      {aiCast.status !== 'working' && recast}
    </motion.div>
  );
}
