import { BALANCE } from '../../config/balance';
import { ILLNESSES } from '../../config/illnesses';
import { seconds, type SimContext } from '../context';
import type { Animal, Ms, WorldState } from '../types';

/** Sick animals spread germs to their zone, except while away at the Free Clinic. */
export function isContagious(animal: Animal): boolean {
  return animal.sickness !== undefined && animal.sickness.atClinicUntil === undefined;
}

export function isImmune(animal: Animal, illnessId: string, now: Ms): boolean {
  return (animal.immunities[illnessId] ?? -Infinity) > now;
}

/** DESIGN 9.1, the care part of the roll: base chance times the neglect multipliers. */
export function baseSickChance(world: WorldState, animal: Animal): number {
  const s = BALANCE.sickness;
  const zonePoops = world.poops.filter((p) => p.zone === animal.zone).length;
  return (
    s.baseChancePerMinute *
    (animal.needs.hunger < s.lowHungerBelow ? s.lowHungerMultiplier : 1) *
    (zonePoops >= s.poopThreshold ? s.poopMultiplier : 1) *
    (animal.needs.happiness < s.lowHappinessBelow ? s.lowHappinessMultiplier : 1)
  );
}

/** Contagious animals in the same zone (DESIGN 9.2: contagion never crosses zones). */
export function sickNeighbors(world: WorldState, animal: Animal): Animal[] {
  return world.animals.filter((a) => a !== animal && a.zone === animal.zone && isContagious(a));
}

/** DESIGN 9.1: the full per-minute chance for a healthy animal (0 if it's already sick). */
export function sickChance(world: WorldState, animal: Animal): number {
  if (animal.sickness) return 0;
  return (
    baseSickChance(world, animal) +
    BALANCE.sickness.contagionPerSickPerMinute * sickNeighbors(world, animal).length
  );
}

/** Makes an animal sick right now and tells the player (symptoms show immediately, DESIGN 9.2). */
export function makeSick(ctx: SimContext, animal: Animal, illnessId: string, now: Ms): void {
  animal.sickness = { illnessId, since: now };
  ctx.emit('animalSick', { animal, illnessId });
}

/**
 * DESIGN 9.1: once a simulated minute, each healthy animal out in the world rolls to get sick.
 * Stored pets aren't in `animals`, so they never do. Online only (nobody gets sick while the
 * player is away), and never when the parent setting turns sickness off.
 *
 * One roll decides both whether and what: a roll inside the base share gets a random illness;
 * a roll inside the contagion share catches that neighbor's illness, so outbreaks stay one
 * illness. Immunity to that illness (recently cured) protects against it.
 */
export function tickSickness(ctx: SimContext, t: Ms): void {
  if (ctx.offline) return;
  const world = ctx.state.world;
  if (!world.settings.sicknessEnabled) return;
  const every = seconds(BALANCE.sickness.rollSeconds);
  if (t % every !== ctx.state.meta.createdAt % every) return;

  const perSick = BALANCE.sickness.contagionPerSickPerMinute;
  // Decide everyone against the same snapshot, so an outbreak spreads one step per minute.
  const contagious = new Map<string, Animal[]>();
  for (const a of world.animals) {
    if (isContagious(a)) contagious.set(a.zone, [...(contagious.get(a.zone) ?? []), a]);
  }
  const plans: { animal: Animal; illnessId: string }[] = [];
  for (const animal of world.animals) {
    if (animal.sickness) continue;
    pruneImmunities(animal, t);
    const base = baseSickChance(world, animal);
    // A healthy animal is never contagious itself, so this is exactly its sick neighbors.
    const neighbors = contagious.get(animal.zone) ?? [];
    const roll = ctx.rng.next();
    if (roll >= base + perSick * neighbors.length) continue;

    let illnessId: string | undefined;
    if (roll >= base) {
      const from = neighbors[Math.min(neighbors.length - 1, Math.floor((roll - base) / perSick))];
      const caught = from?.sickness?.illnessId;
      if (caught && !isImmune(animal, caught, t)) illnessId = caught;
    } else {
      const options = ILLNESSES.filter((i) => !isImmune(animal, i.id, t));
      if (options.length > 0) illnessId = ctx.rng.pick(options).id;
    }
    if (illnessId) plans.push({ animal, illnessId });
  }
  for (const { animal, illnessId } of plans) makeSick(ctx, animal, illnessId, t);
}

/** Drops immunities that have run out, so saves don't collect them forever. */
function pruneImmunities(animal: Animal, now: Ms): void {
  for (const [id, until] of Object.entries(animal.immunities)) {
    if (until <= now) delete animal.immunities[id];
  }
}
