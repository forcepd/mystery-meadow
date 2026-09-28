import { variantOf } from '../bridge/describe';
import { getIllness } from '../config/illnesses';
import type { Animal } from '../sim/types';
import styles from './PetPortrait.module.css';

/** A round placeholder portrait (Phase 10 art replaces it) with small status marks. */
export function PetPortrait({
  animal,
  size = 64,
  now,
}: {
  animal: Pick<Animal, 'speciesId' | 'variantId' | 'isSparkle' | 'sickness' | 'grownAt'>;
  size?: number;
  now?: number;
}) {
  const color = variantOf(animal)?.placeholderColor ?? '#ccc';
  const sick = animal.sickness && (getIllness(animal.sickness.illnessId)?.symptomIcon ?? '🤒');
  const baby = now !== undefined && animal.grownAt !== undefined && now < animal.grownAt;
  return (
    <span
      className={`${styles.portrait} ${animal.isSparkle ? styles.sparkle : ''}`}
      style={{ background: color, width: size, height: size }}
      aria-hidden="true"
    >
      {sick && <span className={styles.mark}>{sick}</span>}
      {!sick && baby && <span className={styles.mark}>🐣</span>}
    </span>
  );
}

/** An undiscovered species in the Dex. */
export function Silhouette({ size = 64 }: { size?: number }) {
  return (
    <span
      className={`${styles.portrait} ${styles.silhouette}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      ?
    </span>
  );
}
