import { motion } from 'motion/react';
import { STEPS } from '../data/constants';
import { hasAI, hasEleven, useAppState } from '../state/store';
import { aiLabel } from '../ai/llm';
import { go, openSettings, reachable } from '../state/navigation';
import { usePlayback } from '../audio/playback';
import { Icon } from './ui';

const LOGO_BARS = [10, 20, 14, 24, 8];

/** Logo bars dance like a level meter while a story is playing. */
function LogoMark() {
  const { playing } = usePlayback();
  return (
    <span className="mk" aria-hidden="true">
      {LOGO_BARS.map((h, i) => (
        <motion.i
          key={i}
          style={{ height: h }}
          animate={playing ? { scaleY: [1, 0.35, 1.1, 0.6, 1] } : { scaleY: 1 }}
          transition={playing ? { duration: 0.9 + i * 0.13, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
        />
      ))}
    </span>
  );
}

export default function TopBar() {
  const S = useAppState();
  const current = STEPS.findIndex(([k]) => k === S.view);
  const can = reachable();
  const live = hasAI() || hasEleven();
  const modeText = live ? [hasAI() && aiLabel(), hasEleven() && 'ElevenLabs'].filter(Boolean).join(' + ') : 'Demo mode';

  return (
    <header className="top">
      <div
        className="logo"
        role="link"
        tabIndex={0}
        aria-label="VoiceVerse home"
        onClick={() => go('home')}
        onKeyDown={(e) => e.key === 'Enter' && go('home')}
      >
        <LogoMark />
        <span className="word">VoiceVerse</span>
      </div>

      <nav className="steps" aria-label="Steps">
        {S.view !== 'home' &&
          STEPS.map(([key, label], i) => (
            <button
              key={key}
              className={i < current ? 'done' : i === current ? 'on' : ''}
              disabled={!can[key]}
              aria-current={i === current ? 'step' : 'false'}
              onClick={() => go(key)}
            >
              {i === current && (
                <motion.span
                  layoutId="step-pill"
                  className="step-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <b>{i < current ? <Icon name="check" /> : i + 1}</b>
              <span>{label}</span>
            </button>
          ))}
      </nav>

      <button className={`mode ${live ? 'live' : ''}`} title="AI keys and settings" onClick={openSettings}>
        <span className="dot" />
        <span>{modeText}</span>
        <Icon name="gear-six" />
      </button>
    </header>
  );
}
