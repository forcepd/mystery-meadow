import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameSession } from './bridge/gameSession';
import { runSession } from './bridge/runSession';
import { createIdbStore } from './save/idbStore';
import { App } from './ui/App';
import { preventZoomGestures } from './ui/preventZoom';
import { StartupScreen } from './ui/StartupScreen';

preventZoomGestures();

if (import.meta.env.PROD) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');
const root = createRoot(rootEl);
root.render(<StartupScreen />);

// The session lives outside React so StrictMode's double effects can't start two games.
GameSession.start({ store: createIdbStore() }).then(
  (session) => {
    runSession(session);
    root.render(
      <StrictMode>
        <App session={session} />
      </StrictMode>,
    );
  },
  (error: unknown) => {
    console.error('Could not start the game', error);
    root.render(<StartupScreen error />);
  },
);
