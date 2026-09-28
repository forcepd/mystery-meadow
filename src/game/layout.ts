import { tileCenter } from '../config/yard';
import type { Vec2 } from '../sim/types';
import { WORLD_HEIGHT, WORLD_WIDTH } from './constants';

/**
 * Yard layout in world pixels (1280x800). No Phaser imports, so e2e tests can use it to find
 * things on screen.
 */
export const LAYOUT = {
  house: { x: 70, y: 70, width: 330, height: 250 },
  /** The fence along the top of the yard, with the gate gap near the right. */
  fenceY: 340,
  gate: { x: 1090, width: 130 },
  /** Where mystery visitors wait, just outside the gate (queue goes up the path). */
  gateQueue: { x: 1155, y: 280, stepX: -95, stepY: -40 },
  /** Normalized animal positions (0..1) map into this rectangle. */
  yard: { left: 110, top: 470, right: 1170, bottom: 730 },
} as const;

export function yardToWorld(p: Vec2): Vec2 {
  const { left, top, right, bottom } = LAYOUT.yard;
  return { x: left + p.x * (right - left), y: top + p.y * (bottom - top) };
}

/** World position of a yard tile's center (bowls, and lures in Phase 6). */
export function tileToWorld(tile: { x: number; y: number }): Vec2 {
  return yardToWorld(tileCenter(tile));
}

export function gateSlot(index: number): Vec2 {
  const q = LAYOUT.gateQueue;
  return { x: q.x + index * q.stepX, y: q.y + index * q.stepY };
}

/** Where visitors step into the yard. */
export const GATE_ENTRY: Vec2 = { x: LAYOUT.gate.x + LAYOUT.gate.width / 2, y: LAYOUT.fenceY + 40 };

export { WORLD_HEIGHT, WORLD_WIDTH };

/**
 * Vet Clinic scene layout (world pixels). Everything stays left of x = 760: the clinic panel
 * (cabinet and clues) covers the right side of the screen.
 */
export const VET_LAYOUT = {
  table: { x: 150, y: 500, width: 520, height: 44 },
  /** Where the patient stands on the table (its feet touch the tabletop). */
  patient: { x: 410, y: 452 },
  patientScale: 1.8,
  /** Drop a tool within this distance of the patient to use it. */
  dropRadius: 190,
  /** Exam tool buttons along the bottom, in EXAM_TOOLS order. */
  tools: { y: 668, xs: [210, 410, 610], width: 150, height: 138 },
} as const;

export function vetToolPoint(index: number): Vec2 {
  return { x: VET_LAYOUT.tools.xs[index] ?? 0, y: VET_LAYOUT.tools.y };
}
