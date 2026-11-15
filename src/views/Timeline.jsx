import { motion } from 'motion/react';
import { MOODS, SCENE_GAP, SFX_ICON, SFX_TYPES } from '../data/constants';
import { cap1, fmtT, pad2, seededBars } from '../lib/utils';
import { S, commit, hasEleven, useAppState } from '../state/store';
import { go } from '../state/navigation';
import { toast } from '../state/toast';
import { previewLine } from '../ai/tts';
import { audio, effectRows, layout, markDirty } from '../audio/mixer';
import { scheduleMusic } from '../audio/music';
import { scheduleSfx } from '../audio/sfx';
import { ac, gain } from '../audio/nodes';
import { lineAtTime, pause, play, seek, toggle, usePlayback } from '../audio/playback';
import { Dot, Icon, Range } from '../components/ui';

const LANES = [
  ['book-open-text', 'Narration'],
  ['chats-circle', 'Dialogue'],
  ['music-notes', 'Music'],
  ['waveform', 'Effects'],
];

function edited() {
  markDirty();
  commit();
}

/** One block on the timeline: grows in from the left, highlights when selected or playing. */
function Block({ cls, kind, id, start, dur, label, total, bars, current, order }) {
  const selected = S.selBlock && S.selBlock.k === kind && String(S.selBlock.i) === String(id);
  const pc = (x) => (x / total) * 100;
  return (
    <motion.button
      className={`b ${cls}${selected ? ' sel' : ''}${current ? ' cur' : ''}`}
      style={{ left: pc(start) + '%', width: `calc(${pc(dur)}% - 3px)`, originX: 0 }}
      title={label}
      initial={{ scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ delay: Math.min(order * 0.025, 0.8), duration: 0.35, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      onClick={() => {
        S.selBlock = { k: kind, i: id };
        commit();
      }}
    >
      <span>{label}</span>
      {bars && (
        <span className="wv">
          {bars.map((h, i) => (
            <i key={i} style={{ height: Math.round(h * 100) + '%' }} />
          ))}
        </span>
      )}
    </motion.button>
  );
}

function LineInspector({ i }) {
  const an = S.an;
  const l = an.lines[i];
  const hear = () => {
    if (hasEleven() && audio.buffers[i]) {
      const ctx = ac();
      const s = ctx.createBufferSource();
      s.buffer = audio.buffers[i];
      s.connect(ctx.destination);
      s.start();
    } else previewLine(l.speaker, l.text).catch((e) => toast(e.message));
  };
  const changeSpeaker = (name) => {
    l.speaker = name;
    delete audio.buffers[i];
    edited();
    if (hasEleven()) {
      S.built = false;
      toast('Rebuild needed to re-record this line');
      go('build');
    }
  };
  const narr = l.speaker === 'Narrator';
  return (
    <>
      <span className="sw" style={{ background: narr ? 'var(--nar)' : 'var(--dia)' }}>
        <Icon name={narr ? 'book-open-text' : 'chat-circle'} />
      </span>
      <div style={{ minWidth: 0 }}>
        <b>
          {l.speaker} · line {i + 1}
        </b>
        <div className="tx">{l.text}</div>
      </div>
      <div className="r">
        <select
          className="inp"
          style={{ height: 36, width: 'auto' }}
          aria-label="Speaker"
          value={l.speaker}
          onChange={(e) => changeSpeaker(e.target.value)}
        >
          {an.chars.map((c) => (
            <option key={c.name}>{c.name}</option>
          ))}
        </select>
        <button className="btn btn-s btn-sm" onClick={hear}>
          <Icon name="play" fill />
          Hear line
        </button>
        <button className="btn btn-g btn-sm" onClick={() => play(l.start)}>
          <Icon name="arrow-line-right" />
          Play from here
        </button>
      </div>
    </>
  );
}

function MusicInspector({ i }) {
  const s = S.an.scenes[i];
  const hear = () => {
    pause();
    const c = ac();
    const g = gain(c, 1);
    g.connect(c.destination);
    scheduleMusic(c, g, s.mood, c.currentTime + 0.05, c.currentTime + 6, s.musVol ?? 1);
  };
  return (
    <>
      <span className="sw" style={{ background: 'var(--mus)' }}>
        <Icon name="music-notes" />
      </span>
      <div>
        <b>
          Scene {i + 1} music · {cap1(s.mood)}
        </b>
        <div className="tx">Synthesised music bed. It dips automatically under voices.</div>
      </div>
      <div className="r">
        <select
          className="inp"
          style={{ height: 36, width: 'auto' }}
          aria-label="Music mood"
          value={s.mood}
          onChange={(e) => {
            s.mood = e.target.value;
            edited();
          }}
        >
          {MOODS.map((m) => (
            <option key={m} value={m}>
              {cap1(m)}
            </option>
          ))}
        </select>
        <span className="hint">Volume</span>
        <Range
          label="Music volume"
          min={0}
          max={1.5}
          step={0.05}
          value={s.musVol ?? 1}
          style={{ width: 120 }}
          onChange={(v) => {
            s.musVol = v;
            commit();
          }}
          onCommit={edited}
        />
        <button className="btn btn-s btn-sm" onClick={hear}>
          <Icon name="play" fill />
          Hear 6 s
        </button>
      </div>
    </>
  );
}

function EffectInspector({ id }) {
  const an = S.an;
  const [si, xi] = String(id).split('.').map(Number);
  const sc = an.scenes[si];
  const x = sc.sfx[xi];
  if (!x) return null;
  const l = an.lines[x.line];
  const sceneLines = an.lines.map((_, i) => i).filter((i) => an.lines[i].scene === si);
  const move = (dir) => {
    const k = sceneLines.indexOf(x.line) + dir;
    if (k < 0 || k >= sceneLines.length) return;
    x.line = sceneLines[k];
    edited();
  };
  const hear = () => {
    pause();
    const c = ac();
    scheduleSfx(c, c.destination, x.type, c.currentTime + 0.05, x.vol);
  };
  const remove = () => {
    sc.sfx.splice(xi, 1);
    S.selBlock = null;
    edited();
    toast('Removed');
  };
  return (
    <>
      <span className="sw" style={{ background: 'var(--sfx)' }}>
        <Icon name={SFX_ICON[x.type]} />
      </span>
      <div style={{ minWidth: 0 }}>
        <b>{SFX_TYPES[x.type]}</b>
        <div className="tx">
          Scene {si + 1} · starts {fmtT(x.t)} · with “{(l?.text || '').slice(0, 60)}…”
        </div>
      </div>
      <div className="r">
        <select
          className="inp"
          style={{ height: 36, width: 'auto' }}
          aria-label="Sound"
          value={x.type}
          onChange={(e) => {
            x.type = e.target.value;
            edited();
          }}
        >
          {Object.entries(SFX_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="btn btn-s btn-sm" aria-label="Move to the previous line" onClick={() => move(-1)}>
          <Icon name="caret-left" />
        </button>
        <button className="btn btn-s btn-sm" aria-label="Move to the next line" onClick={() => move(1)}>
          <Icon name="caret-right" />
        </button>
        <span className="hint">Volume</span>
        <Range
          label="Effect volume"
          min={0}
          max={1.5}
          step={0.05}
          value={x.vol}
          style={{ width: 110 }}
          onChange={(v) => {
            x.vol = v;
            commit();
          }}
          onCommit={edited}
        />
        <button className="btn btn-s btn-sm" onClick={hear}>
          <Icon name="play" fill />
          Hear
        </button>
        <button className="btn btn-g btn-sm" onClick={remove}>
          <Icon name="trash" />
          Remove
        </button>
      </div>
    </>
  );
}

function Inspector({ t }) {
  const sb = S.selBlock;
  if (!sb) {
    const addEffect = () => {
      const li = lineAtTime(t);
      const l = S.an.lines[li];
      const sc = S.an.scenes[l.scene];
      sc.sfx.push({ type: 'wind', line: li, vol: 1 });
      S.selBlock = { k: 'sfx', i: l.scene + '.' + (sc.sfx.length - 1) };
      edited();
      toast('Added a sound effect at the playhead');
    };
    return (
      <>
        <span className="sw" style={{ background: 'var(--s3)', color: 'var(--mu)' }}>
          <Icon name="cursor-click" />
        </span>
        <div>
          <b>Click any block</b>
          <div className="tx">
            Hear a line, change a scene's music, or swap, move and remove sound effects. Click the scene names to jump.
          </div>
        </div>
        <div className="r">
          <button className="btn btn-s btn-sm" onClick={addEffect}>
            <Icon name="plus" />
            Add sound effect
          </button>
        </div>
      </>
    );
  }
  if (sb.k === 'line') return <LineInspector i={sb.i} />;
  if (sb.k === 'music') return <MusicInspector i={sb.i} />;
  return <EffectInspector id={sb.i} />;
}

export default function Timeline() {
  const { an, selBlock } = useAppState();
  const { playing, t, idx } = usePlayback();
  layout();
  const T = an.total;
  const pc = (x) => (x / T) * 100;
  const bars = (dur, i) => seededBars(Math.max(4, Math.round(dur * 1.4)), i * 7 + 3);
  let order = 0;

  return (
    <div className="wrap" style={{ gap: 16 }}>
      <div className="head">
        <div>
          <span className="cap">Scene by scene · {fmtT(T)}</span>
          <h2 className="disp h1" style={{ marginTop: 8 }}>
            {an.title}
          </h2>
        </div>
        <div className="legend">
          <span>
            <Dot color="var(--nar)" />
            Narration
          </span>
          <span>
            <Dot color="var(--dia)" />
            Dialogue
          </span>
          <span>
            <Dot color="var(--mus)" />
            Music
          </span>
          <span>
            <Dot color="var(--sfx)" />
            Sound effects
          </span>
        </div>
        <div className="acts">
          <button className="btn btn-s ppv" aria-label={playing ? 'Pause' : 'Play'} onClick={toggle}>
            <Icon name={playing ? 'pause' : 'play'} fill />
          </button>
          <span className="time mono" style={{ alignSelf: 'center' }}>
            <b>{fmtT(t)}</b> / {fmtT(T)}
          </span>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="btn btn-p"
            onClick={() => go('player')}
          >
            Listen to the story
            <Icon name="arrow-right" />
          </motion.button>
        </div>
      </div>

      <div className="board">
        <div className="lanes-l">
          <div />
          {LANES.map(([icon, label]) => (
            <div key={label}>
              <Icon name={icon} />
              {label}
            </div>
          ))}
        </div>
        <div className="scroller">
          <div className="grid" style={{ width: `max(100%, ${Math.max(100, T * 18)}px)` }}>
            <div className="ruler">
              {an.scenes.map((s, i) => (
                <div
                  key={i}
                  onClick={() => seek(s.start)}
                  style={{ left: pc(s.start - (i ? SCENE_GAP / 2 : 0.8)) + '%', width: pc(s.end - s.start + SCENE_GAP) + '%' }}
                >
                  <b>
                    {pad2(i + 1)} · {s.title}
                  </b>
                  <span className="mono">{fmtT(s.start)}</span>
                </div>
              ))}
            </div>
            <div className="trk">
              {an.lines.map((l, i) =>
                l.speaker === 'Narrator' ? (
                  <Block
                    key={i}
                    cls="nar"
                    kind="line"
                    id={i}
                    start={l.start}
                    dur={l.dur}
                    label={l.text}
                    total={T}
                    bars={bars(l.dur, i)}
                    current={playing && idx === i}
                    order={order++}
                  />
                ) : null,
              )}
            </div>
            <div className="trk">
              {an.lines.map((l, i) =>
                l.speaker !== 'Narrator' ? (
                  <Block
                    key={i}
                    cls="dia"
                    kind="line"
                    id={i}
                    start={l.start}
                    dur={l.dur}
                    label={l.speaker + ': ' + l.text}
                    total={T}
                    bars={bars(l.dur, i)}
                    current={playing && idx === i}
                    order={order++}
                  />
                ) : null,
              )}
            </div>
            <div className="trk">
              {an.scenes.map((s, i) => (
                <Block
                  key={i}
                  cls="mus"
                  kind="music"
                  id={i}
                  start={Math.max(0, s.start - 0.6)}
                  dur={s.end - s.start + SCENE_GAP * 0.8 + 0.6}
                  label={cap1(s.mood) + ' music'}
                  total={T}
                  order={order++}
                />
              ))}
            </div>
            <div className="trk">
              {effectRows().map((o) => (
                <Block
                  key={o.id}
                  cls={'sfx r' + o.row}
                  kind="sfx"
                  id={o.id}
                  start={o.x.t}
                  dur={o.w}
                  label={SFX_TYPES[o.x.type]}
                  total={T}
                  order={order++}
                />
              ))}
            </div>
            {an.scenes.slice(1).map((s, i) => (
              <span key={i} className="sep" style={{ left: pc(s.start - SCENE_GAP / 2) + '%' }} />
            ))}
            <span className="playhead" style={{ left: pc(t) + '%' }} />
          </div>
        </div>
      </div>

      <motion.div
        key={selBlock ? selBlock.k + selBlock.i : 'none'}
        className="panel inspector"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Inspector t={t} />
      </motion.div>
    </div>
  );
}
