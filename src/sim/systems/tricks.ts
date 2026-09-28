import type { Animal, CommandResult } from '../types';

/** DESIGN 9.3: sick animals can't train. Training itself arrives in Phase 9 and checks this. */
export function canTrain(animal: Animal): CommandResult {
  if (animal.sickness) return { ok: false, reason: 'Too sick to train. Visit the vet!' };
  return { ok: true };
}
