import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { KEYS, S, hasEleven } from '../state/store';
import { go } from '../state/navigation';
import { BUILD_STEPS, runBuild, useBuild } from '../state/build';
import { autoCast, resetElevenVoices } from '../ai/voices';
import { Icon } from '../components/ui';

const R = 200;
const CIRC = 2 * Math.PI * R;

function stepState(i, b) {
  if (b.error && i === b.step) return 'fail';
  if (i < b.step || b.progress >= 1) return 'done';
  if (i === b.step) return 'now';
  return 'wait';
}

export default function Build() {
  const b = useBuild();
  const pct = Math.round(b.progress * 100);

  // Entering this screen (re)builds the audio unless a build is already running.
  useEffect(() => {
    if (!b.running) runBuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useBrowserVoices = () => {
    KEYS.set('vv-el', '', false);
    resetElevenVoices();
    autoCast(S.an);
    runBuild(0);
  };

  const title = b.error ? 'Something went wrong' : pct >= 100 ? 'Ready to listen' : BUILD_STEPS[b.step].label;

  return (
    <div className="gen-wrap">
      <div className="ring">
        <svg viewBox="0 0 440 440" aria-hidden="true">
          <circle cx="220" cy="220" r={R} fill="none" stroke="#262B37" strokeWidth="12" />
          <motion.circle
            cx="220"
            cy="220"
            r={R}
            fill="none"
            stroke={b.error ? '#FF7A7A' : '#FF5A36'}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            transform="rotate(-90 220 220)"
            initial={{ strokeDashoffset: CIRC }}
            animate={{ strokeDashoffset: CIRC * (1 - b.progress) }}
            transition={{ type: 'spring', stiffness: 60, damping: 20 }}
          />
        </svg>
        <div className="c">
          <motion.span
            key={pct >= 100 ? 'done' : 'run'}
            className="disp"
            initial={{ scale: 0.9 }}
            animate={{ scale: pct >= 100 ? [1, 1.12, 1] : 1 }}
          >
            {pct}%
          </motion.span>
          <span className="cap" style={{ marginTop: 12 }}>
            {b.error ? 'Stopped' : pct >= 100 ? 'Done' : 'Working…'}
          </span>
        </div>
      </div>

      <div>
        <span className="cap">Building your audio story</span>
        {/* Plain CSS slide-ins: content is visible from the first frame even if animations are paused. */}
        <h1 key={title} className="disp h1 view-in" style={{ margin: '12px 0 32px' }}>
          {title}
        </h1>

        <div>
          {BUILD_STEPS.map((step, i) => {
            const st = stepState(i, b);
            const icon = st === 'done' ? 'check' : st === 'fail' ? 'x' : step.icon;
            return (
              <div
                key={step.key}
                className={`pstep ${st} step-in`}
                style={{ animationDelay: `${i * 0.08}s`, opacity: st === 'wait' ? 0.55 : 1 }}
              >
                <span className="ic">
                  <motion.i
                    key={icon}
                    className={`ph ph-${icon}`}
                    initial={{ scale: 0.4, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                  />
                </span>
                <div>
                  <b>{step.label}</b>
                  <small>{b.detail[step.key] || ''}</small>
                </div>
                <span className="st">{st === 'done' ? 'Done' : st === 'fail' ? 'Failed' : st === 'now' ? 'Working' : '—'}</span>
              </div>
            );
          })}
        </div>

        {b.error ? (
          <>
            <div className="err" style={{ marginTop: 20 }}>
              <Icon name="warning-circle" />
              <span>{b.error}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
              <button className="btn btn-p" onClick={() => runBuild(b.step)}>
                <Icon name="arrow-clockwise" />
                Retry this step
              </button>
              {hasEleven() && (
                <button className="btn btn-s" onClick={useBrowserVoices}>
                  Use browser voices instead
                </button>
              )}
              <button className="btn btn-g" onClick={() => go('voices')}>
                Back to voices
              </button>
            </div>
          </>
        ) : (
          <p className="hint" style={{ marginTop: 24 }}>
            <Icon name="info" /> Keep this tab open.{' '}
            {hasEleven()
              ? 'Each line is recorded by ElevenLabs.'
              : "Demo mode uses this browser's voices; they play live instead of being recorded."}
          </p>
        )}
      </div>
    </div>
  );
}
