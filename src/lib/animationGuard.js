// Safety net for screen recording and covered windows: some setups pause the browser's
// animation clock while the page is still on screen. Entrance animations start invisible,
// so a paused clock would leave screens blank. If animations stop advancing, jump them to
// their end state and turn further animations off for this visit.
import { MotionGlobalConfig } from 'motion/react';

const CHECK_MS = 1200;

export function startAnimationGuard() {
  if (typeof document === 'undefined' || !document.getAnimations) return;
  const seen = new WeakMap();
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    let stalled = false;
    for (const a of document.getAnimations()) {
      if (a.playState !== 'running') continue;
      const t = a.currentTime;
      if (seen.has(a) && seen.get(a) === t) stalled = true;
      seen.set(a, t);
    }
    if (!stalled) return;
    MotionGlobalConfig.skipAnimations = true;
    document.documentElement.classList.add('no-anim');
    for (const a of document.getAnimations()) {
      try {
        if (!a.playbackRate) a.playbackRate = 1;
        a.finish();
      } catch {
        a.cancel(); // infinite animations can't finish; cancelling shows the element's final style
      }
    }
  }, CHECK_MS);
}
