import { SPECIES, getSpecies } from '../config/species';
import type { GameSim } from './GameSim';
import { addCoins, addGems } from './systems/economy';
import { rollLitterSize, rollVisitor } from './systems/rarity';
import { spawnVisitor } from './systems/visitors';
import { runOnline } from './tick';
import type { CommandResult, Rarity, VisitorRoll } from './types';

/**
 * Dev-only commands for the Debug Panel (DESIGN 21, Phase 2). Only src/dev imports this
 * module, so production builds leave it out.
 */
export interface DebugVisitorOptions {
  rarity?: Rarity;
  speciesId?: string;
  variantId?: string;
  isSparkle?: boolean;
  /** 0 = not pregnant; a number forces that litter size; `true` rolls one. */
  pregnant?: boolean | number;
}

/** A visitor appears at the gate right now, ignoring capacity and Crowded. */
export function debugSpawnVisitor(sim: GameSim, opts: DebugVisitorOptions = {}): CommandResult {
  return sim.debugRun((ctx) => {
    const roll: VisitorRoll = rollVisitor(ctx.rng, ctx.state.world);
    const species = opts.speciesId
      ? getSpecies(opts.speciesId)
      : opts.rarity && opts.rarity !== roll.rarity
        ? ctx.rng.pick(SPECIES.filter((s) => s.rarity === opts.rarity))
        : getSpecies(roll.speciesId);
    if (!species) return { ok: false, reason: `Unknown species "${opts.speciesId}"` };
    if (species.id !== roll.speciesId) {
      roll.speciesId = species.id;
      roll.rarity = species.rarity;
      roll.variantId = ctx.rng.pick(species.variants).id;
    }
    if (opts.variantId) {
      if (!species.variants.some((v) => v.id === opts.variantId)) {
        return { ok: false, reason: `${species.name} has no "${opts.variantId}" variant` };
      }
      roll.variantId = opts.variantId;
    }
    if (opts.isSparkle !== undefined) roll.isSparkle = opts.isSparkle;
    if (opts.pregnant === true) roll.litterSize = rollLitterSize(ctx.rng);
    else if (opts.pregnant === false) roll.litterSize = 0;
    else if (typeof opts.pregnant === 'number') roll.litterSize = opts.pregnant;
    spawnVisitor(ctx, ctx.state.meta.lastSeenAt, roll);
    return { ok: true };
  });
}

export function debugAddCoins(sim: GameSim, amount: number): void {
  sim.debugRun((ctx) => addCoins(ctx, Math.max(amount, -ctx.state.world.coins)));
}

export function debugAddGems(sim: GameSim, amount: number): void {
  sim.debugRun((ctx) => addGems(ctx, Math.max(amount, -ctx.state.world.gems)));
}

/**
 * Plays forward to the clock's time as if the player were watching (online rules), even across
 * a long gap. Call after jumping the game clock forward.
 */
export function debugRunOnline(sim: GameSim): void {
  sim.debugRun((ctx, clockNow) => runOnline(ctx, clockNow));
}

/** Sets every animal's needs (e.g. make everyone hungry to test feeding and care prices). */
export function debugSetNeeds(sim: GameSim, hunger: number, happiness: number): void {
  sim.debugRun((ctx) => {
    for (const a of ctx.state.world.animals) a.needs = { hunger, happiness };
  });
}
