import { lazy, Suspense } from 'react';
import type { GameSession } from '../bridge/gameSession';
import { AnimalCard } from './AnimalCard';
import { DecorateBar } from './DecorateBar';
import { DexScreen } from './DexScreen';
import styles from './App.module.css';
import { GameCanvas } from './GameCanvas';
import { HomeStore } from './HomeStore';
import { Hud } from './Hud';
import { PetsScreen } from './PetsScreen';
import { RealEstate } from './RealEstate';
import { SettingsScreen } from './SettingsScreen';
import { StyleScreen } from './StyleScreen';
import { TutorialCoach } from './TutorialCoach';
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
        <DecorateBar />
        <HomeStore />
        <RealEstate />
        <StyleScreen />
        <SettingsScreen />
        <TutorialCoach />
        <Toasts />
        {DebugPanel && (
          <Suspense fallback={null}>
            <DebugPanel />
          </Suspense>
        )}
      </div>
    </SessionProvider>
  );
}
