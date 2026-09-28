import { Emitter } from '../sim/emitter';

/**
 * App-level events between the Phaser world and the React overlay that aren't sim state
 * (e.g. raw input). Game state changes will flow through GameSim events from Phase 1 on.
 */
export type AppEvents = {
  /** A tap landed on the world canvas (world coordinates). */
  canvasTap: { x: number; y: number };
  /** A React button asked the world to react (proves UI -> world messaging). */
  uiPing: undefined;
};

export const appBus = new Emitter<AppEvents>();
