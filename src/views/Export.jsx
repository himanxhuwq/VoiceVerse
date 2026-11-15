import { useState } from 'react';
import { motion } from 'motion/react';
import { downloadBlob, fmtT, seededBars, slugify } from '../lib/utils';
import { S, commit, hasEleven, useAppState } from '../state/store';
import { newStory, openSettings } from '../state/navigation';
import { toast } from '../state/toast';
import { audio, layout, renderMix } from '../audio/mixer';
import { scriptText, toMp3, toWav } from '../audio/exporter';
import { Bars, Icon, rise, stagger } from '../components/ui';

/** The finished mix, rendering it first if anything changed. Demo mode exports music + effects only. */
async function finalMix() {
  if (!hasEleven()) return renderMix(false);
  if (audio.dirty || !audio.mix) {
    audio.mix = await renderMix(true);
    audio.dirty = false;
  }
  return audio.mix;
}

export default function Export() {
  const { an, fmt } = useAppState();
  const [status, setStatus] = useState(''); // '' | 'preparing' | 'encoding'
  layout();
  const withVoices = hasEleven();
  const secs = an.total;
  const mp3MB = Math.round(((secs * 128) / 8 / 1024) * 10) / 10;
  const wavMB = Math.round(((secs * 44100 * 4) / 1024 / 1024) * 10) / 10;
  const name = slugify(an.title) + (withVoices ? '' : '-soundtrack');

  const download = async () => {
    setStatus('preparing');
    try {
      const buf = await finalMix();
      if (fmt === 'wav') downloadBlob(new Blob([toWav(buf)], { type: 'audio/wav' }), name + '.wav');
      else {
        setStatus('encoding');
        downloadBlob(await toMp3(buf), name + '.mp3');
      }
      toast('Download started');
    } catch (err) {
      toast('Could not export: ' + err.message);
    }
    setStatus('');
  };

  const copyScript = async () => {
    const text = scriptText(an);
    try {
      await navigator.clipboard.writeText(text);
      toast('Script copied');
    } catch {
      downloadBlob(new Blob([text], { type: 'text/plain' }), slugify(an.title) + '-script.txt');
      toast('Saved the script as a file');
    }
  };

  const setFmt = (f) => {
    S.fmt = f;
    commit();
  };

  return (
    <div className="ex">
      <motion.div
        className="cover"
        initial={{ opacity: 0, scale: 0.94, rotate: -2 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 18 }}
      >
        <motion.div className="rays" animate={{ opacity: [0.8, 1, 0.8] }} transition={{ duration: 4, repeat: Infinity }} />
        <span className="cap" style={{ position: 'relative' }}>
          A VoiceVerse audio story
        </span>
        <div>
          <div className="disp">{an.title}</div>
          <Bars className="cw" heights={seededBars(56, 11)} delay={0.3} stagger={0.015} />
        </div>
        <div className="meta">
          <span>{fmtT(secs)}</span>
          <span>
            {an.scenes.length} scenes · {an.chars.length} voices
          </span>
        </div>
      </motion.div>

      <motion.div className="opts" variants={stagger(0.08, 0.15)} initial="hidden" animate="show">
        <motion.div variants={rise}>
          <span className="cap">Your story is ready</span>
          <h1 className="disp h1" style={{ marginTop: 12 }}>
            Take it with you
          </h1>
        </motion.div>

        {!withVoices && (
          <motion.div variants={rise} className="note">
            <Icon name="info" />
            <span>
              Browser voices can be played but not recorded, so in demo mode the download holds the{' '}
              <b>music and sound effects only</b>.{' '}
              <button style={{ textDecoration: 'underline' }} onClick={openSettings}>
                Add an ElevenLabs key
              </button>{' '}
              to download the full story with voices.
            </span>
          </motion.div>
        )}

        <motion.div variants={rise} className="fmt" role="radiogroup">
          {[
            ['mp3', 'MP3', 'Best for sharing and phones', mp3MB],
            ['wav', 'WAV', 'Full quality, for editing', wavMB],
          ].map(([key, label, sub, mb]) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.98 }}
              role="radio"
              aria-checked={fmt === key}
              className={fmt === key ? 'on' : ''}
              onClick={() => setFmt(key)}
            >
              <span className="radio" />
              <div>
                <b>{label}</b>
                <small>{sub}</small>
              </div>
              <span className="mono hint">~{mb} MB</span>
            </motion.button>
          ))}
        </motion.div>

        <motion.button
          variants={rise}
          whileHover={{ scale: status ? 1 : 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn btn-p btn-l"
          disabled={!!status}
          onClick={download}
        >
          {status ? (
            <>
              <Icon name="circle-notch" spin />
              {status === 'encoding' ? 'Encoding MP3…' : 'Preparing…'}
            </>
          ) : (
            <>
              <Icon name="download-simple" />
              Download {fmt.toUpperCase()}
              {withVoices ? '' : ' (music + effects)'}
            </>
          )}
        </motion.button>

        <motion.div variants={rise} className="more">
          <motion.button whileHover={{ y: -2 }} className="panel" onClick={copyScript}>
            <Icon name="scroll" />
            <div>
              <b>Copy script</b>
              <small>Every line by speaker</small>
            </div>
          </motion.button>
          <motion.button whileHover={{ y: -2 }} className="panel" onClick={newStory}>
            <Icon name="plus-circle" />
            <div>
              <b>Make another</b>
              <small>Start a new story</small>
            </div>
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
