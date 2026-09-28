import { useEffect, useRef } from 'react';
import { createGame } from '../game/createGame';
import styles from './GameCanvas.module.css';

/** Hosts the Phaser canvas underneath the React overlay. */
export function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const game = createGame(hostRef.current);
    return () => game.destroy(true);
  }, []);

  return <div ref={hostRef} className={styles.host} data-testid="game-canvas" />;
}
