import { lazy, Suspense } from 'react';
import type { GameSession } from '../bridge/gameSession';
import { AnimalCard } from './AnimalCard';
import { DexScreen } from './DexScreen';
import styles from './App.module.css';
import { GameCanvas } from './GameCanvas';
import { Hud } from './Hud';
import { PetsScreen } from './PetsScreen';
import { RotateScreen } from './RotateScreen';
import { SessionProvider } from './session';
import { Toasts } from './Toasts';
import { VetClinic } from './VetClinic';

// Dev builds only: `import.meta.env.DEV` is false in production, so the panel is never bundled.
const DebugPanel = import.meta.env.DEV ? lazy(() => import('../dev/DebugPanel')) : null;

export function App({ session }: { session: GameSession }) {
  return (
    <SessionProvider session={session}>
      <div className={styles.app}>
        <GameCanvas />
        <Hud />
        <AnimalCard />
        <VetClinic />
        <PetsScreen />
        <DexScreen />
        <Toasts />
        {DebugPanel && (
          <Suspense fallback={null}>
            <DebugPanel />
          </Suspense>
        )}
        <RotateScreen />
      </div>
    </SessionProvider>
  );
}
