import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { clearSavedStory, hasEleven, notify } from './state/store';
import { loadElevenVoices } from './ai/voices';
import './styles/global.css';
import { startAnimationGuard } from './lib/animationGuard';

startAnimationGuard();

// Every visit starts with a fresh story (only API keys are remembered).
clearSavedStory();
// Fetch ElevenLabs voices in the background if a key is saved.
if (hasEleven()) {
  loadElevenVoices()
    .then(notify)
    .catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
