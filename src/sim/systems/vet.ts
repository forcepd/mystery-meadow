import { BALANCE } from '../../config/balance';
import {
  getExamTool,
  getIllness,
  getTreatment,
  type ClueDef,
  type IllnessDef,
} from '../../config/illnesses';
import { minutes, type SimContext } from '../context';
import type { Animal, CommandResult, Ms, WorldState } from '../types';
import { addCoins } from './economy';
import { findAnimal } from './selling';

/** What checking in at the vet would cost right now. */
export interface VetQuote {
  /** Free Clinic: no fee and free treatments, but a wait first. */
  free: boolean;
  fee: number;
}

export type ExamResult = { ok: true; clues: readonly ClueDef[] } | { ok: false; reason: string };

export type VetTreatResult =
  { ok: true; cured: boolean; cost: number } | { ok: false; reason: string };

/**
 * DESIGN 9.5: a visit costs `visitFee`. [DEFAULT, Phase 4] If the player can't afford the fee
 * plus one treatment, it's the Free Clinic instead.
 */
export function vetQuote(world: WorldState): VetQuote {
  const { visitFee, treatmentCost } = BALANCE.vet;
  const free = world.coins < visitFee + treatmentCost;
  return { free, fee: free ? 0 : visitFee };
}

export function isWaitingAtClinic(animal: Animal): boolean {
  return animal.sickness?.atClinicUntil !== undefined;
}

/**
 * What the next treatment costs: nothing at the Free Clinic, or when the player can't afford
 * it (so a wrong guess on a paid visit can never leave an animal stuck sick).
 */
export function treatmentCost(world: WorldState, animal: Animal): number {
  const cost = BALANCE.vet.treatmentCost;
  if (animal.sickness?.visit === 'free' || world.coins < cost) return 0;
  return cost;
}

/** Tap "Go to Vet": checks in, paying the fee (or starting the Free Clinic wait). */
export function goToVet(ctx: SimContext, animalId: string, now: Ms): CommandResult {
  const world = ctx.state.world;
  const animal = findAnimal(world, animalId);
  if (!animal) return { ok: false, reason: 'Can’t find that animal.' };
  const sickness = animal.sickness;
  if (!sickness) return { ok: false, reason: 'Healthy and happy! No vet needed.' };
  if (sickness.visit) return { ok: true }; // Already checked in: going back is free.

  const quote = vetQuote(world);
  if (quote.free) {
    sickness.visit = 'free';
    sickness.atClinicUntil = now + minutes(BALANCE.vet.freeClinicWaitMinutes);
  } else {
    addCoins(ctx, -quote.fee);
    sickness.visit = 'paid';
  }
  ctx.emit('vetVisitStarted', { animal, free: quote.free, fee: quote.fee });
  return { ok: true };
}

function checkReady(animal: Animal | undefined): { animal: Animal; illness: IllnessDef } | string {
  if (!animal) return 'Can’t find that animal.';
  if (!animal.sickness) return 'Healthy and happy! No vet needed.';
  if (!animal.sickness.visit) return 'Check in at the vet first.';
  if (isWaitingAtClinic(animal)) return 'Still in the waiting room. The vet is coming soon!';
  const illness = getIllness(animal.sickness.illnessId);
  if (!illness) return 'The vet is puzzled by this one.';
  return { animal, illness };
}

/** Uses an exam tool on the animal and returns what it reveals. Changes nothing. */
export function examine(world: WorldState, animalId: string, toolId: string): ExamResult {
  const ready = checkReady(findAnimal(world, animalId));
  if (typeof ready === 'string') return { ok: false, reason: ready };
  if (!getExamTool(toolId)) return { ok: false, reason: 'That’s not an exam tool.' };
  return { ok: true, clues: ready.illness.clues[toolId] ?? [] };
}

/**
 * Gives a treatment from the cabinet. The right one cures the animal and makes it immune to
 * that illness for a while; the wrong one still costs coins (DESIGN 9.5 step 4).
 */
export function vetTreat(
  ctx: SimContext,
  animalId: string,
  treatmentId: string,
  now: Ms,
): VetTreatResult {
  const world = ctx.state.world;
  const ready = checkReady(findAnimal(world, animalId));
  if (typeof ready === 'string') return { ok: false, reason: ready };
  if (!getTreatment(treatmentId)) return { ok: false, reason: 'That’s not in the cabinet.' };
  const { animal, illness } = ready;

  const cost = treatmentCost(world, animal);
  addCoins(ctx, -cost);
  const cured = treatmentId === illness.treatmentId;
  if (cured) {
    delete animal.sickness;
    animal.immunities[illness.id] = now + minutes(BALANCE.sickness.immunityMinutes);
  }
  ctx.emit('vetTreated', { animal, treatmentId, cost, cured });
  if (cured) ctx.emit('animalCured', { animal, illnessId: illness.id });
  return { ok: true, cured, cost };
}

/** Ends Free Clinic waits that are over. Runs offline too (waiting is a timer, not care). */
export function tickClinic(ctx: SimContext, t: Ms): void {
  for (const animal of ctx.state.world.animals) {
    const sickness = animal.sickness;
    if (sickness?.atClinicUntil === undefined || t < sickness.atClinicUntil) continue;
    delete sickness.atClinicUntil;
    ctx.emit('clinicReady', { animal });
  }
}
