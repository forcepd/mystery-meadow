import { GameCanvas } from './GameCanvas';
import { Hud } from './Hud';
import { RotateScreen } from './RotateScreen';
import styles from './App.module.css';

export function App() {
  return (
    <div className={styles.app}>
      <GameCanvas />
      <Hud />
      <RotateScreen />
    </div>
  );
}
