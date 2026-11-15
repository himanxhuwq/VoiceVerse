import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { S, hasEleven, load, notify } from './state/store';
import { autoCast, loadElevenVoices } from './ai/voices';
import './styles/global.css';

// Restore the last session, then fetch ElevenLabs voices in the background if a key is saved.
load();
if (hasEleven()) {
  loadElevenVoices()
    .then(() => {
      if (S.an) autoCast(S.an);
      notify();
    })
    .catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
