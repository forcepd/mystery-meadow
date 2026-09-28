import { formatCountdown } from '../bridge/describe';
import common from './common.module.css';
import styles from './Hud.module.css';
import { useSim } from './session';

/** DESIGN 17.2 HUD (Phase 2 subset): coins, gems, capacity, next-visitor countdown. */
export function Hud() {
  const { sim } = useSim();
  const { coins, gems, gateQueue } = sim.state.world;
  const count = sim.animalCount();
  const capacity = sim.capacity();
  const crowded = sim.isCrowded();
  const waiting = gateQueue.some((v) => !v.revealed);

  let visitorText: string;
  if (crowded) visitorText = 'Too crowded for visitors';
  else if (waiting) visitorText = 'A visitor is at the gate!';
  else visitorText = `Next visitor in ${formatCountdown(sim.msUntilNextVisitor())}`;

  return (
    <div className={styles.overlay}>
      <div className={styles.topLeft}>
        <div className={common.pill} aria-label={`${coins} coins`} data-testid="coins">
          <span className={`${styles.icon} ${styles.coin}`} aria-hidden="true" />
          {coins}
        </div>
        <div className={common.pill} aria-label={`${gems} gems`} data-testid="gems">
          <span className={`${styles.icon} ${styles.gem}`} aria-hidden="true" />
          {gems}
        </div>
      </div>

      <div className={styles.topRight}>
        <div className={`${common.pill} ${styles.timer}`} data-testid="next-visitor">
          <span className={styles.emoji} aria-hidden="true">
            {crowded ? '🐾' : waiting ? '❓' : '⏰'}
          </span>
          {visitorText}
        </div>
        <div
          className={`${common.pill} ${crowded ? styles.crowded : ''}`}
          aria-label={`${count} of ${capacity} animals${crowded ? ', crowded' : ''}`}
          data-testid="capacity"
        >
          <span className={styles.emoji} aria-hidden="true">
            🐾
          </span>
          {count}/{capacity}
        </div>
      </div>

      <a className={`${common.link} ${styles.privacy}`} href="./privacy.html">
        Privacy
      </a>
    </div>
  );
}
