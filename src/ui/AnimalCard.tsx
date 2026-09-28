import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { RARITY_STYLE, starString } from '../art/palette';
import { appBus } from '../bridge/appBus';
import { displayName, formatCountdown, speciesName, variantOf } from '../bridge/describe';
import { BALANCE } from '../config/balance';
import type { Badge, GameSim } from '../sim/GameSim';
import type { Animal } from '../sim/types';
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

/** DESIGN 17.3 Animal Card (through Phase 3). Opens when an animal is tapped in the world. */
export function AnimalCard() {
  const { sim } = useSim();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);

  useAppEvent(
    'selectAnimal',
    useCallback(({ id }) => {
      setSelectedId(id);
      setMessage(null);
      setEditingName(false);
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
  const care = sim.careMultiplier(animal.id) ?? 1;
  const carePercent = Math.round((care - 1) * 100);
  const canSell = sim.canSell(animal.id);
  const close = () => appBus.emit('selectAnimal', { id: null });

  /** Runs a command; shows its reason if it's refused. */
  const act = (run: () => { ok: boolean; reason?: string }) => {
    const result = run();
    setMessage(result.ok ? null : (result.reason ?? null));
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
        <div className={styles.titles}>
          {editingName ? (
            <NameEditor sim={sim} animal={animal} onDone={() => setEditingName(false)} />
          ) : (
            <button
              type="button"
              className={styles.nameButton}
              onClick={() => setEditingName(true)}
              aria-label={`Name: ${displayName(animal)}. Tap to rename`}
            >
              <span className={styles.name}>{displayName(animal)}</span>
              <span aria-hidden="true" className={styles.pencil}>
                ✏️
              </span>
            </button>
          )}
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

      <div className={styles.needs}>
        <NeedBar icon="🍖" label="Food" value={animal.needs.hunger} />
        <NeedBar icon="💗" label="Happy" value={animal.needs.happiness} />
        <NeedBar icon="🧼" label="Clean" value={sim.cleanliness(animal.zone)} />
      </div>
      <p className={styles.tip}>
        <span aria-hidden="true">🤚</span> Press and hold to pet!
      </p>

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
        <li data-testid="care-bonus" className={carePercent < 0 ? styles.careLow : styles.careHigh}>
          <span aria-hidden="true">{carePercent < 0 ? '😟' : '💖'}</span>{' '}
          {carePercent === 0
            ? 'Care bonus: none yet'
            : carePercent > 0
              ? `Care bonus +${carePercent}%`
              : `Needs care ${carePercent}%`}
        </li>
      </ul>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${common.button} ${styles.secondary}`}
          onClick={() => act(() => sim.feedTreat(animal.id))}
        >
          <span aria-hidden="true">🍪</span> Treat for {BALANCE.treat.cost}
        </button>
        <button
          type="button"
          className={common.button}
          aria-disabled={!canSell.ok}
          onClick={() => (canSell.ok ? act(() => sim.sell(animal.id)) : setMessage(canSell.reason))}
        >
          <span aria-hidden="true">🪙</span> Sell for {price}
        </button>
        {message && (
          <p className={styles.refusal} role="status">
            {message}
          </p>
        )}
      </div>
    </aside>
  );
}

function NeedBar({ icon, label, value }: { icon: string; label: string; value: number }) {
  const v = Math.round(value);
  const level = v >= 60 ? styles.good : v >= 25 ? styles.okay : styles.low;
  return (
    <div className={styles.need}>
      <span aria-hidden="true" className={styles.needIcon}>
        {icon}
      </span>
      <span className={styles.needLabel}>{label}</span>
      <div
        className={styles.bar}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
      >
        <div className={`${styles.fill} ${level}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

function NameEditor({ sim, animal, onDone }: { sim: GameSim; animal: Animal; onDone: () => void }) {
  const [text, setText] = useState(animal.name ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = sim.rename(animal.id, text);
    if (result.ok) onDone();
    else setError(result.reason);
  };

  return (
    <form className={styles.nameForm} onSubmit={submit}>
      <input
        className={styles.nameInput}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        maxLength={BALANCE.names.maxLength}
        placeholder={speciesName(animal.speciesId)}
        aria-label="New name"
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
      />
      <div className={styles.nameButtons}>
        <button type="submit" className={common.iconButton} aria-label="Save name">
          ✓
        </button>
        <button type="button" className={common.iconButton} aria-label="Cancel" onClick={onDone}>
          ✕
        </button>
      </div>
      {error && (
        <p className={styles.nameError} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
