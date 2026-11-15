import { Fragment } from 'react';
import { motion } from 'motion/react';
import { MOODS, SFX_TYPES } from '../data/constants';
import { cap1, pad2 } from '../lib/utils';
import { S, commit, useAppState } from '../state/store';
import { analyseStory, go } from '../state/navigation';
import { toast } from '../state/toast';
import { markDirty } from '../audio/mixer';
import { Avatar, Dot, Icon, MoodChip, rise, stagger } from '../components/ui';

function rebuildArc(an) {
  an.arc = [];
  an.scenes.forEach((s) => {
    if (an.arc[an.arc.length - 1] !== s.mood) an.arc.push(s.mood);
  });
}

function setMood(i, mood) {
  S.an.scenes[i].mood = mood;
  rebuildArc(S.an);
  markDirty();
  commit();
}

function rename(i, value) {
  const c = S.an.chars[i];
  const old = c.name;
  const name = value.trim() || old;
  if (name === old) return;
  S.an.lines.forEach((l) => {
    if (l.speaker === old) l.speaker = name;
  });
  S.cast[name] = S.cast[old];
  delete S.cast[old];
  if (S.sel === old) S.sel = name;
  c.name = name;
  commit();
  toast('Renamed to ' + name);
}

export default function Analysis() {
  const { an } = useAppState();
  const linesBy = (name) => an.lines.filter((l) => l.speaker === name).length;

  const reanalyse = () => {
    go('story');
    setTimeout(() => analyseStory().catch((e) => toast(e.message)), 50);
  };

  return (
    <div className="wrap">
      <div className="head">
        <div>
          <span className="cap">What the AI found · {an.engine}</span>
          <h1 className="disp h1" style={{ marginTop: 12 }}>
            {an.title}
          </h1>
        </div>
        <div className="acts">
          <button className="btn btn-s" onClick={reanalyse}>
            <Icon name="arrow-counter-clockwise" />
            Re-analyse
          </button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="btn btn-p"
            onClick={() => go('voices')}
          >
            Cast the voices
            <Icon name="arrow-right" />
          </motion.button>
        </div>
      </div>

      <motion.div className="facts" variants={stagger(0.07)} initial="hidden" animate="show">
        <motion.div variants={rise} className="panel fact">
          <span className="cap">Genre</span>
          <div className="v">{an.genre}</div>
        </motion.div>
        <motion.div variants={rise} className="panel fact">
          <span className="cap">Scenes</span>
          <div className="v">{an.scenes.length}</div>
        </motion.div>
        <motion.div variants={rise} className="panel fact">
          <span className="cap">Mood across the story</span>
          <div className="arc">
            {an.arc.map((m, i) => (
              <Fragment key={i}>
                {i > 0 && <Icon name="arrow-right" />}
                <MoodChip mood={m} />
              </Fragment>
            ))}
          </div>
        </motion.div>
        <motion.div variants={rise} className="panel fact">
          <span className="cap">Narration style</span>
          <div style={{ fontSize: 'var(--t3)', fontWeight: 600, marginTop: 12, lineHeight: 1.3 }}>{an.style}</div>
        </motion.div>
      </motion.div>

      <div className="ancols">
        <motion.div className="scenes" variants={stagger(0.08, 0.2)} initial="hidden" animate="show">
          {an.scenes.map((s, i) => (
            <motion.div
              key={i}
              variants={rise}
              whileHover={{ y: -3 }}
              className="panel scene"
              style={s.mood === 'tense' ? { borderColor: 'rgba(255,90,54,.45)' } : undefined}
            >
              <div className="sr">
                <span className="cap">Scene {pad2(i + 1)}</span>
                <select
                  className="chip"
                  aria-label={`Scene ${i + 1} mood`}
                  style={{ appearance: 'none', cursor: 'pointer' }}
                  value={s.mood}
                  onChange={(e) => setMood(i, e.target.value)}
                >
                  {MOODS.map((m) => (
                    <option key={m} value={m}>
                      {cap1(m)}
                    </option>
                  ))}
                </select>
              </div>
              <h4>{s.title}</h4>
              <p>{s.summary}</p>
              <div className="cues">
                <span className="chip">
                  <Dot color="var(--mus)" />
                  {cap1(s.mood)} music
                </span>
                {s.sfx.map((x, k) => (
                  <span key={k} className="chip">
                    <Dot color="var(--sfx)" />
                    {SFX_TYPES[x.type]}
                  </span>
                ))}
              </div>
              <span className="hint">{an.lines.filter((l) => l.scene === i).length} lines</span>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="panel cast"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.45 }}
        >
          <span className="cap">Characters · {an.chars.length}</span>
          <motion.div style={{ marginTop: 8 }} variants={stagger(0.06, 0.4)} initial="hidden" animate="show">
            {an.chars.map((c, i) => (
              <motion.div key={c.name + i} variants={rise} className="person">
                <Avatar name={c.name} index={i} />
                <div>
                  {i === 0 ? (
                    <b style={{ fontSize: 16 }}>Narrator</b>
                  ) : (
                    <input
                      defaultValue={c.name}
                      aria-label="Character name"
                      onBlur={(e) => rename(i, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                    />
                  )}
                  <small>
                    {c.role}
                    {c.gender !== 'unknown' && i ? ' · ' + c.gender : ''}
                  </small>
                </div>
                <span className="n">{linesBy(c.name)} lines</span>
              </motion.div>
            ))}
          </motion.div>
          <p className="hint" style={{ marginTop: 12, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <Icon name="pencil-simple" /> Wrong name? Click it to fix it before casting.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
