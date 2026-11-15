import { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SCENE_GAP } from '../data/constants';
import { cap1, clamp, fmtT, pad2 } from '../lib/utils';
import { useAppState } from '../state/store';
import { go } from '../state/navigation';
import { audio, estimatedPeaks, layout, peaks } from '../audio/mixer';
import { engineMode, seek, toggle, usePlayback } from '../audio/playback';
import { Avatar, Icon } from '../components/ui';

/** Clickable waveform; bars before the playhead light up. */
function Waveform({ heights, progress, total, t }) {
  const lit = Math.floor(progress * heights.length);
  const onClick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * total);
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') seek(t + 5);
    if (e.key === 'ArrowLeft') seek(t - 5);
  };
  return (
    <div
      className="bigwave"
      role="slider"
      aria-label="Seek"
      tabIndex={0}
      aria-valuemin={0}
      aria-valuemax={Math.round(total)}
      aria-valuenow={Math.round(t)}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {heights.map((h, i) => (
        <motion.i
          key={i}
          className={i < lit ? 'p' : undefined}
          style={{ height: Math.round(h * 100) + '%' }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 0.2 + i * 0.004, duration: 0.3 }}
        />
      ))}
    </div>
  );
}

/** The previous, current and next line, with the current one sliding into focus. */
function Lyrics({ lines, idx }) {
  return (
    <div className="lyric" aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        {[idx - 1, idx, idx + 1].map((k) =>
          lines[k] ? (
            <motion.p
              key={k}
              layout
              className={k === idx ? 'cur' : ''}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            >
              <span className="spk">{lines[k].speaker}</span>
              {lines[k].text}
            </motion.p>
          ) : (
            <p key={'empty' + k} />
          ),
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Player() {
  const { an } = useAppState();
  const { playing, t, idx } = usePlayback();
  layout();
  const n = window.innerWidth < 860 ? 70 : 180;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const heights = useMemo(
    () => (engineMode() === 'mix' && audio.mix ? peaks(audio.mix, n) : estimatedPeaks(n)),
    [an, n, audio.mix],
  );
  const line = an.lines[idx];
  const scene = line ? an.scenes[line.scene] : null;
  const back = () => {
    const l = an.lines[idx];
    seek(t - l.start > 2 ? l.start : (an.lines[idx - 1]?.start ?? 0));
  };
  const fwd = () => {
    const l = an.lines[idx + 1];
    if (l) seek(l.start);
  };

  return (
    <div className="player">
      <div className="pmain">
        <motion.div
          className="glow"
          animate={{ opacity: playing ? [0.7, 1, 0.7] : 0.6, scale: playing ? [1, 1.06, 1] : 1 }}
          transition={{ duration: 3, repeat: playing ? Infinity : 0 }}
        />
        <span className={`onair ${playing ? 'live' : ''}`} style={{ alignSelf: 'flex-start' }}>
          <span className="dot" />
          {playing ? 'NOW PLAYING' : 'PAUSED'}
        </span>
        <motion.h1
          className="disp ptitle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {an.title}
        </motion.h1>
        <div className="nowp">
          <span>{scene ? `Scene ${line.scene + 1} · ${scene.title}` : ''}</span>
          <span>·</span>
          <span>{an.genre}</span>
          <span>·</span>
          <span>{an.chars.length} voices</span>
          {engineMode() === 'live' && (
            <>
              <span>·</span>
              <span className="chip" title="Voices play live from this browser">
                Live browser voices
              </span>
            </>
          )}
        </div>
        <Lyrics lines={an.lines} idx={idx} />
        <Waveform heights={heights} progress={t / an.total} total={an.total} t={t} />
        <div className="markers">
          {an.scenes.map((s, i) => (
            <button key={i} style={{ left: (s.start / an.total) * 100 + '%' }} onClick={() => seek(s.start)}>
              {pad2(i + 1)} {s.title}
            </button>
          ))}
        </div>
        <div className="trans">
          <button className="sk" aria-label="Previous line" onClick={back}>
            <Icon name="skip-back" fill />
          </button>
          <motion.button
            className="pp"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={toggle}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.i
                key={playing ? 'pause' : 'play'}
                className={`ph-fill ph-${playing ? 'pause' : 'play'}`}
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 90 }}
                transition={{ duration: 0.15 }}
              />
            </AnimatePresence>
          </motion.button>
          <button className="sk" aria-label="Next line" onClick={fwd}>
            <Icon name="skip-forward" fill />
          </button>
          <span className="time">
            <b>{fmtT(t)}</b> / {fmtT(an.total)}
          </span>
          <div className="r">
            <button className="btn btn-s" onClick={() => go('timeline')}>
              <Icon name="sliders-horizontal" />
              Edit timeline
            </button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="btn btn-p"
              onClick={() => go('export')}
            >
              <Icon name="download-simple" />
              Download
            </motion.button>
          </div>
        </div>
      </div>

      <aside className="chap">
        <span className="cap" style={{ margin: '0 12px 8px' }}>
          Scenes
        </span>
        {an.scenes.map((s, i) => {
          const on = t >= s.start - 0.2 && t < s.end + SCENE_GAP;
          const pct = on ? clamp(((t - s.start) / (s.end - s.start)) * 100, 0, 100) : 0;
          return (
            <motion.button
              key={i}
              className={`ch ${on ? 'on' : ''}`}
              onClick={() => seek(s.start)}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.07 }}
            >
              <span className="num">{pad2(i + 1)}</span>
              <div>
                <b>{s.title}</b>
                <small>{cap1(s.mood)}</small>
              </div>
              <span className="mono">{fmtT(s.end - s.start)}</span>
              <span className="bar">
                <i style={{ width: pct + '%' }} />
              </span>
            </motion.button>
          );
        })}
        <div className="castmini">
          <span className="cap">Cast</span>
          <div className="avs">
            {an.chars.map((c, i) => (
              <Avatar key={c.name} name={c.name} index={i} speaking={playing && line?.speaker === c.name} />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
