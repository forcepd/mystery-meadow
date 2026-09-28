import { Emitter } from '../sim/emitter';
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
};

export const appBus = new Emitter<AppEvents>();
