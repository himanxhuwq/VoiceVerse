import { useEffect } from 'react';
import { MotionConfig } from 'motion/react';
import { STEPS } from './data/constants';
import { useAppState } from './state/store';
import { closeSettings } from './state/navigation';
import { toggle } from './audio/playback';
import TopBar from './components/TopBar';
import Toast from './components/Toast';
import SettingsModal from './components/SettingsModal';
import Home from './views/Home';
import Story from './views/Story';
import Analysis from './views/Analysis';
import Voices from './views/Voices';
import Build from './views/Build';
import Timeline from './views/Timeline';
import Player from './views/Player';
import Export from './views/Export';

const VIEWS = {
  home: Home,
  story: Story,
  analysis: Analysis,
  voices: Voices,
  build: Build,
  timeline: Timeline,
  player: Player,
  export: Export,
};
const NEEDS_STORY = new Set(['analysis', 'voices', 'build', 'timeline', 'player', 'export']);

/** Global keys: Escape closes settings, Space plays/pauses on the player and timeline. */
function useKeyboard(view) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closeSettings();
      const typing = /INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement?.tagName);
      if (e.code === 'Space' && (view === 'player' || view === 'timeline') && !typing) {
        e.preventDefault();
        toggle();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [view]);
}

export default function App() {
  const S = useAppState();
  const view = NEEDS_STORY.has(S.view) && !S.an ? 'home' : S.view;
  const View = VIEWS[view] || Home;
  useKeyboard(view);

  useEffect(() => {
    const step = STEPS.find(([k]) => k === view);
    document.title = view === 'home' || !step ? 'VoiceVerse' : `${step[1]} · VoiceVerse`;
  }, [view]);

  return (
    <MotionConfig reducedMotion="user">
      <TopBar />
      <main id="main">
        {/* The new screen replaces the old one at once and only slides in (CSS .view-in).
            It never waits on an exit animation and never starts invisible, so a paused
            animation (window covered, background tab, screen recording) can't leave it blank. */}
        <div key={view} className="view view-in">
          <View />
        </div>
      </main>
      <Toast />
      <SettingsModal />
    </MotionConfig>
  );
}
