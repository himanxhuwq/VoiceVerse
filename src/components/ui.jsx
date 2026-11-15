// Small shared UI pieces.
import { motion } from 'motion/react';
import { COLORS } from '../data/constants';
import { cap1 } from '../lib/utils';

export const Icon = ({ name, fill = false, spin = false, style }) => (
  <i className={`${fill ? 'ph-fill' : 'ph'} ph-${name}${spin ? ' spin' : ''}`} style={style} aria-hidden="true" />
);

export function Avatar({ name, index, className = '', speaking = false }) {
  const initial = name.replace(/^the\s+/i, '')[0] || '?';
  return (
    <motion.span
      className={`av ${className}${speaking ? ' speaking' : ''}`}
      style={{ background: COLORS[index % COLORS.length] }}
      animate={speaking ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={speaking ? { duration: 0.9, repeat: Infinity } : { duration: 0.2 }}
    >
      {initial}
    </motion.span>
  );
}

export const MoodChip = ({ mood }) => <span className={`chip ${mood === 'tense' ? 'mood-tense' : ''}`}>{cap1(mood)}</span>;

export const Dot = ({ color }) => <span className="dot" style={{ background: color }} />;

/** Range input that paints its filled part (via the --p CSS variable). */
export function Range({ value, min, max, step, onChange, onCommit, style, label }) {
  const pct = ((value - min) / (max - min)) * 100 + '%';
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      style={{ '--p': pct, ...style }}
      onChange={(e) => onChange(+e.target.value)}
      onPointerUp={onCommit}
      onKeyUp={onCommit}
    />
  );
}

/** Bars that rise in one after another: the app's signature waveform. */
export function Bars({ heights, className = 'mwave', delay = 0, stagger = 0.012, barClass }) {
  return (
    <div className={className}>
      {heights.map((h, i) => (
        <motion.i
          key={i}
          className={barClass ? barClass(i) : undefined}
          style={{ height: Math.round(h * 100) + '%', originY: 0.5 }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: delay + i * stagger, duration: 0.35, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

/** Container + item variants for staggered entrances. */
export const stagger = (gap = 0.06, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});
export const rise = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.2, 0.7, 0.2, 1] } },
};
