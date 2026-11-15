import { motion } from 'motion/react';
import { SAMPLES } from '../data/samples';
import { seededBars } from '../lib/utils';
import { S, commit, useAppState } from '../state/store';
import { go } from '../state/navigation';
import { Bars, Dot, Icon, rise, stagger } from '../components/ui';

const HOW = [
  ['01', 'Write or paste', '300–500 words, or generate one'],
  ['02', 'AI reads it', 'Scenes, characters, mood'],
  ['03', 'Voices + sound', 'Cast, music bed, effects'],
  ['04', 'Play & download', 'WAV or MP3'],
];

/** One lane of the decorative mixer on the hero. */
function Lane({ label, color, blocks, delay }) {
  return (
    <div className="lane">
      <span className="ln">
        <Dot color={color} />
        {label}
      </span>
      <div className="tr">
        {blocks.map(([left, width, bars], i) => (
          <motion.div
            key={i}
            className="blk"
            style={{ left: left + '%', width: width + '%', background: color, originX: 0 }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: delay + i * 0.15, duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
          >
            {bars && <Bars heights={bars} delay={delay + 0.4} stagger={0.008} />}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Stage() {
  return (
    <div className="stage" aria-hidden="true">
      <motion.div
        className="page"
        initial={{ opacity: 0, y: 40, rotate: -8 }}
        animate={{ opacity: 1, y: [0, -8, 0], rotate: -3 }}
        transition={{
          opacity: { duration: 0.6 },
          rotate: { duration: 0.8 },
          y: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
        }}
      >
        <span className="cap">Your story · 360 words</span>
        <h4>The Lantern Keeper</h4>
        <p>
          The wind came off the sea long before the <mark style={{ borderColor: '#D29A12' }}>thunder</mark> did. Mira climbed the
          last stair of the lighthouse.
        </p>
        <p>
          <mark style={{ borderColor: 'var(--dia)' }}>“Keep it lit, whatever comes,”</mark> old Tomas had told her.
        </p>
        <p>
          Below, the waves turned black. Somewhere in the <mark style={{ borderColor: '#2F9A86' }}>storm</mark>, a voice began to
          sing.
        </p>
      </motion.div>
      <motion.div
        className="mixer"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span className="cap">Scene 2 · The storm</span>
          <span className="mono" style={{ fontSize: 13, color: 'var(--mu)' }}>
            00:48 / 03:42
          </span>
        </div>
        <Lane label="Narrator" color="var(--nar)" delay={0.5} blocks={[[0, 58, seededBars(40, 3, { envelope: true })]]} />
        <Lane label="Tomas" color="var(--dia)" delay={0.7} blocks={[[60, 30, seededBars(22, 5, { envelope: true })]]} />
        <Lane label="Music" color="var(--mus)" delay={0.6} blocks={[[0, 100, seededBars(70, 9, { lo: true })]]} />
        <Lane
          label="Effects"
          color="var(--sfx)"
          delay={0.9}
          blocks={[
            [22, 12],
            [70, 16],
          ]}
        />
      </motion.div>
    </div>
  );
}

export default function Home() {
  const { an, built } = useAppState();

  const trySample = () => {
    S.title = SAMPLES[0].title;
    S.text = SAMPLES[0].text;
    S.tab = 'paste';
    commit();
    go('story');
  };

  return (
    <>
      <div className="hero">
        <motion.div variants={stagger(0.09)} initial="hidden" animate="show">
          <motion.span variants={rise} className="onair live">
            <span className="dot" />
            AI AUDIO-STORY STUDIO
          </motion.span>
          <motion.h1 variants={rise} className="disp">
            Turn your story into a <em>cinematic</em> audio experience.
          </motion.h1>
          <motion.p variants={rise} className="lede">
            Paste a story. VoiceVerse casts the voices, scores the scenes and adds the sound, ready to play.
          </motion.p>
          <motion.div variants={rise} className="ctas">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="btn btn-p btn-l"
              onClick={() => go('story')}
            >
              <Icon name="microphone-stage" />
              Create Audio Story
            </motion.button>
            <button className="btn btn-g" onClick={trySample}>
              <Icon name="play-circle" fill style={{ fontSize: 28, color: 'var(--tx)' }} />
              Try the sample story
            </button>
          </motion.div>
          {an && (
            <motion.p variants={rise} className="hint" style={{ marginTop: 20 }}>
              You have a story in progress:{' '}
              <button
                className="btn-g"
                style={{ textDecoration: 'underline', color: 'var(--tx)' }}
                onClick={() => go(built ? 'player' : 'analysis')}
              >
                {an.title}
              </button>
            </motion.p>
          )}
        </motion.div>
        <Stage />
      </div>
      <motion.div className="howrow" variants={stagger(0.08, 0.5)} initial="hidden" animate="show">
        {HOW.map(([n, title, sub]) => (
          <motion.div key={n} variants={rise}>
            <b>{n}</b>
            <span>
              {title}
              <small>{sub}</small>
            </span>
          </motion.div>
        ))}
      </motion.div>
    </>
  );
}
