import { useCallback, useState } from 'react';
import { appBus } from '../bridge/appBus';
import { BALANCE } from '../config/balance';
import { useAppEvent } from './useAppEvent';
import styles from './Hud.module.css';

/**
 * Phase 0 HUD: shows the overlay sits above the canvas and that taps reach both layers.
 * Coin/gem values are display-only placeholders until the sim exists (Phase 1).
 */
export function Hud() {
  const [canvasTaps, setCanvasTaps] = useState(0);
  const [buttonTaps, setButtonTaps] = useState(0);

  useAppEvent(
    'canvasTap',
    useCallback(() => setCanvasTaps((n) => n + 1), []),
  );

  const sendHeart = () => {
    setButtonTaps((n) => n + 1);
    appBus.emit('uiPing', undefined);
  };

  return (
    <div className={styles.overlay}>
      <header className={styles.topBar}>
        <div className={styles.pill} aria-label={`${BALANCE.startingCoins} coins`}>
          <span className={`${styles.icon} ${styles.coin}`} aria-hidden="true" />
          {BALANCE.startingCoins}
        </div>
        <div className={styles.pill} aria-label={`${BALANCE.startingGems} gems`}>
          <span className={`${styles.icon} ${styles.gem}`} aria-hidden="true" />
          {BALANCE.startingGems}
        </div>
      </header>

      <section className={styles.panel} aria-label="Touch test">
        <p className={styles.stat}>
          🌿 Meadow taps: <strong data-testid="canvas-taps">{canvasTaps}</strong>
        </p>
        <p className={styles.stat}>
          💗 Button taps: <strong data-testid="button-taps">{buttonTaps}</strong>
        </p>
        <button type="button" className={styles.button} onClick={sendHeart}>
          <span aria-hidden="true">💗</span> Send a heart
        </button>
        <a className={styles.link} href="./privacy.html">
          Privacy
        </a>
      </section>
    </div>
  );
}
