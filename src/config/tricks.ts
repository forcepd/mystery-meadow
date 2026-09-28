import { deepFreeze } from './deepFreeze';

/**
 * Tricks (DESIGN 11). `move` is how the placeholder art performs it in the world (the Phase 10
 * art pass can give each its own animation). Adding a trick = a data entry here.
 */
export type TrickMove = 'hop' | 'spin' | 'wiggle' | 'roll' | 'bow';

export interface TrickDef {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly move: TrickMove;
}

// prettier-ignore
export const TRICKS: readonly TrickDef[] = deepFreeze([
  { id: 'sit',       name: 'Sit',       icon: '🪑', move: 'bow' },
  { id: 'spin',      name: 'Spin',      icon: '🌀', move: 'spin' },
  { id: 'high_five', name: 'High-Five', icon: '✋', move: 'hop' },
  { id: 'roll_over', name: 'Roll Over', icon: '🔄', move: 'roll' },
  { id: 'jump',      name: 'Jump',      icon: '⬆️', move: 'hop' },
  { id: 'dance',     name: 'Dance',     icon: '💃', move: 'wiggle' },
  { id: 'wave',      name: 'Wave',      icon: '👋', move: 'wiggle' },
  { id: 'fetch',     name: 'Fetch',     icon: '🎾', move: 'hop' },
]);

export function getTrick(id: string): TrickDef | undefined {
  return TRICKS.find((t) => t.id === id);
}

/** Simon-says cues (DESIGN 11): four arrows and a tap. */
export const TRAINING_CUES = ['left', 'up', 'right', 'down', 'tap'] as const;
export type TrainingCue = (typeof TRAINING_CUES)[number];
