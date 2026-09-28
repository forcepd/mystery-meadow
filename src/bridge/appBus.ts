import { Emitter } from '../sim/emitter';
import type { ExamResult } from '../sim/systems/vet';
import type { ToastMessage } from './toasts';

/**
 * App-level events between the Phaser world and the React overlay that aren't sim state
 * (selection, raw input, app toasts). Game state changes flow through GameSim events.
 */
export type AppEvents = {
  /** A tap landed on the world canvas (world coordinates). */
  canvasTap: { x: number; y: number };
  /** The player tapped an animal (or empty ground: null) in the world. */
  selectAnimal: { id: string | null };
  /** The world has drawn its first frame of sprites and accepts taps. */
  worldReady: undefined;
  /** A toast that doesn't come from a sim event. */
  toast: ToastMessage;
  /** Show the Vet Clinic for this animal (already checked in with `sim.goToVet`). */
  openVet: { animalId: string };
  /** Leave the Vet Clinic, back to the yard. */
  closeVet: undefined;
  /** An exam tool was used on the patient in the clinic scene. */
  vetExamined: { animalId: string; toolId: string; result: ExamResult };
  /**
   * Opens a full-screen overlay (null closes it). `incomingId`: an animal being kept while
   * every Pet Slot is full, so the Pets (Swap) screen asks where it goes.
   */
  openScreen: { screen: 'pets' | 'dex' | null; incomingId?: string };
  /** Which Phaser scene is showing. */
  sceneChanged: { scene: 'yard' | 'vet' };
};

export const appBus = new Emitter<AppEvents>();
