import { useCallback, useEffect, useState } from 'react';
import { RARITY_STYLE, starString } from '../art/palette';
import { appBus } from '../bridge/appBus';
import { displayName, formatCountdown, speciesName, variantOf } from '../bridge/describe';
import type { Badge } from '../sim/GameSim';
import styles from './AnimalCard.module.css';
import common from './common.module.css';
import { useSim } from './session';
import { useAppEvent } from './useAppEvent';

const BADGES: Record<Badge, { icon: string; label: string }> = {
  new: { icon: '✨', label: 'New' },
  pregnant: { icon: '🍼', label: 'Pregnant' },
  baby: { icon: '🐣', label: 'Baby' },
  sick: { icon: '🤒', label: 'Sick' },
  readyToSell: { icon: '🪙', label: 'Ready to sell' },
  kept: { icon: '❤️', label: 'Kept' },
};

/** DESIGN 17.3 Animal Card (Phase 2 subset). Opens when an animal is tapped in the world. */
export function AnimalCard() {
  const { sim } = useSim();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  useAppEvent(
    'selectAnimal',
    useCallback(({ id }) => {
      setSelectedId(id);
      setRefusal(null);
    }, []),
  );

  const animal = selectedId ? sim.getAnimal(selectedId) : undefined;

  // Sold (or otherwise gone): close.
  useEffect(() => {
    if (selectedId && !animal) appBus.emit('selectAnimal', { id: null });
  }, [selectedId, animal]);

  if (!animal) return null;

  const now = sim.now();
  const badges = sim.badges(animal.id);
  const rarity = RARITY_STYLE[animal.rarity];
  const color = variantOf(animal)?.placeholderColor ?? '#ccc';
  const price = sim.salePrice(animal.id) ?? 0;
  const canSell = sim.canSell(animal.id);
  const close = () => appBus.emit('selectAnimal', { id: null });

  const sell = () => {
    const result = sim.sell(animal.id);
    if (!result.ok) setRefusal(result.reason);
  };

  return (
    <aside className={`${common.panel} ${styles.card}`} aria-label={`${displayName(animal)} card`}>
      <button
        type="button"
        className={`${common.iconButton} ${styles.close}`}
        onClick={close}
        aria-label="Close"
      >
        ✕
      </button>

      <div className={styles.header}>
        <div
          className={`${styles.portrait} ${animal.isSparkle ? styles.sparkle : ''}`}
          style={{ background: color }}
          aria-hidden="true"
        />
        <div>
          <h2 className={styles.name}>{displayName(animal)}</h2>
          {animal.name && <p className={styles.species}>{speciesName(animal.speciesId)}</p>}
          <p className={styles.rarity} style={{ color: rarity.color }}>
            <span aria-hidden="true">{starString(animal.rarity)}</span> {rarity.label}
            {animal.isSparkle && <span className={styles.sparkleTag}> ✦ Sparkle</span>}
          </p>
        </div>
      </div>

      {badges.length > 0 && (
        <ul className={styles.badges} aria-label="Status">
          {badges.map((b) => (
            <li key={b} className={styles.badge}>
              <span aria-hidden="true">{BADGES[b].icon}</span> {BADGES[b].label}
            </li>
          ))}
        </ul>
      )}

      <ul className={styles.status}>
        {animal.pregnancy && (
          <li>
            <span aria-hidden="true">🍼</span> Babies coming in{' '}
            <strong>{formatCountdown(animal.pregnancy.birthAt - now)}</strong>
          </li>
        )}
        {animal.grownAt !== undefined && now < animal.grownAt && (
          <li>
            <span aria-hidden="true">🐣</span> Grows up in{' '}
            <strong>{formatCountdown(animal.grownAt - now)}</strong>
          </li>
        )}
        {!animal.isKept && (
          <li data-testid="hold-status">
            {now >= animal.holdUntil ? (
              <>
                <span aria-hidden="true">🪙</span> <strong>Ready to sell!</strong>
              </>
            ) : (
              <>
                <span aria-hidden="true">⏳</span> Ready to sell in{' '}
                <strong>{formatCountdown(animal.holdUntil - now)}</strong>
              </>
            )}
          </li>
        )}
      </ul>

      <div className={styles.actions}>
        <button
          type="button"
          className={common.button}
          aria-disabled={!canSell.ok}
          onClick={canSell.ok ? sell : () => setRefusal(canSell.reason)}
        >
          <span aria-hidden="true">🪙</span> Sell for {price}
        </button>
        {refusal && (
          <p className={styles.refusal} role="status">
            {refusal}
          </p>
        )}
      </div>
    </aside>
  );
}
