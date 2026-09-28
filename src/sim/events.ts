import type { Animal, OfflineSummary, Poop, Visitor } from './types';

/**
 * Events the sim emits for animations, toasts, and sounds. Payloads reference live sim
 * objects: listeners must treat them as read-only.
 *
 * During offline catch-up, per-item events are not emitted; `caughtUp` summarizes instead.
 */
export type SimEvents = {
  visitorArrived: { visitor: Visitor };
  /** The visitor timer fired while the yard was Crowded, so nobody came. */
  visitorSkipped: { reason: 'crowded' };
  visitorRevealed: { visitor: Visitor; auto: boolean };
  visitorEntered: { visitorId: string; animal: Animal };
  visitorLeft: { visitor: Visitor };
  animalBorn: { mother: Animal; babies: Animal[] };
  animalGrew: { animal: Animal };
  readyToSell: { animal: Animal };
  animalSold: { animal: Animal; price: number };
  coinsChanged: { coins: number; delta: number };
  gemsChanged: { gems: number; delta: number };
  crowdedChanged: { crowded: boolean };
  dexDiscovered: { key: string };
  animalAte: { animal: Animal; bowlId: string };
  bowlEmptied: { bowlId: string };
  bowlRefilled: { bowlId: string };
  treatGiven: { animal: Animal };
  animalPetted: { animal: Animal };
  poopAppeared: { poop: Poop; animalId: string };
  poopCleaned: { poop: Poop };
  animalRenamed: { animal: Animal };
  animalSick: { animal: Animal; illnessId: string };
  /** Checked in at the vet (`free` = Free Clinic, which starts with a wait). */
  vetVisitStarted: { animal: Animal; free: boolean; fee: number };
  /** The Free Clinic wait is over: the vet can see the animal now. */
  clinicReady: { animal: Animal };
  /** A treatment was given (`cost` may be 0). `cured` is false for the wrong treatment. */
  vetTreated: { animal: Animal; treatmentId: string; cost: number; cured: boolean };
  animalCured: { animal: Animal; illnessId: string };
  caughtUp: OfflineSummary;
  /** Something in the state may have changed (a tick ran or a command was called). */
  changed: undefined;
};
