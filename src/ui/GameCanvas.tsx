import { useEffect, useRef } from 'react';
import { appBus } from '../bridge/appBus';
import { createGame } from '../game/createGame';
import styles from './GameCanvas.module.css';
import { useSession } from './session';

/** Hosts the Phaser canvas underneath the React overlay. */
export function GameCanvas() {
  const session = useSession();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const game = createGame(host, session);
    // Counts world taps on the host element, so tests can prove UI taps don't fall through.
    let taps = 0;
    const offs = [
      appBus.on('canvasTap', () => host.setAttribute('data-canvas-taps', String(++taps))),
      appBus.on('worldReady', () => host.setAttribute('data-world-ready', 'true')),
    ];
    return () => {
      offs.forEach((off) => off());
      game.destroy(true);
    };
  }, [session]);

  return (
    <div ref={hostRef} className={styles.host} data-testid="game-canvas" data-canvas-taps="0" />
  );
}
