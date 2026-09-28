import { BALANCE } from '../../config/balance';
import { FakeClock } from '../clock';
import { hours, minutes } from '../context';
import { GameSim } from '../GameSim';
import { RARITIES, type Rarity } from '../types';

/**
 * Economy harness (DESIGN 22). A simple bot plays for N hours: it taps every visitor right away
 * and sells every animal the moment it can. It never spends coins.
 */
export interface EconomyOptions {
  hours: number;
  seed: number;
  /** Seconds between bot actions. The sim itself always runs 1-second ticks. */
  botIntervalSeconds?: number;
}

export interface EconomyReport {
  hours: number;
  seed: number;
  visitorsArrived: number;
  visitorsEntered: number;
  visitorsLeftAtGate: number;
  visitorsSkippedCrowded: number;
  births: number;
  babies: number;
  sold: Record<Rarity, number>;
  sparklesSold: number;
  coinsEarned: number;
  coinsPerHour: number;
  /** Hours until total earnings reached each house tier's cost (null = not reached). */
  hoursToAfford: Record<string, number | null>;
  minutesCrowded: number;
  finalAnimals: number;
}

export function runEconomy(options: EconomyOptions): EconomyReport {
  const start = Date.UTC(2026, 0, 1);
  const clock = new FakeClock(start);
  const sim = GameSim.newGame({ clock, seed: options.seed });
  const step = (options.botIntervalSeconds ?? 1) * 1000;
  const end = start + hours(options.hours);

  const sold = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
  const hoursToAfford: Record<string, number | null> = {};
  for (const tier of BALANCE.houseTiers.slice(1)) hoursToAfford[tier.id] = null;
  const report = {
    visitorsArrived: 0,
    visitorsEntered: 0,
    visitorsLeftAtGate: 0,
    visitorsSkippedCrowded: 0,
    births: 0,
    babies: 0,
    sparklesSold: 0,
    coinsEarned: 0,
    crowdedMs: 0,
  };

  sim.events.on('visitorArrived', () => report.visitorsArrived++);
  sim.events.on('visitorEntered', () => report.visitorsEntered++);
  sim.events.on('visitorLeft', () => report.visitorsLeftAtGate++);
  sim.events.on('visitorSkipped', () => report.visitorsSkippedCrowded++);
  sim.events.on('animalBorn', ({ babies }) => {
    report.births++;
    report.babies += babies.length;
  });
  sim.events.on('animalSold', ({ animal, price }) => {
    sold[animal.rarity]++;
    if (animal.isSparkle) report.sparklesSold++;
    report.coinsEarned += price;
    for (const tier of BALANCE.houseTiers.slice(1)) {
      if (hoursToAfford[tier.id] === null && report.coinsEarned >= tier.cost) {
        hoursToAfford[tier.id] = (sim.now() - start) / hours(1);
      }
    }
  });

  while (clock.now() < end) {
    clock.advance(step);
    sim.update();
    if (sim.isCrowded()) report.crowdedMs += step;
    for (const visitor of [...sim.state.world.gateQueue]) {
      if (!visitor.revealed) sim.revealVisitor(visitor.id);
    }
    for (const animal of [...sim.state.world.animals]) {
      if (sim.canSell(animal.id).ok) sim.sell(animal.id);
    }
  }

  const { crowdedMs, ...counts } = report;
  return {
    hours: options.hours,
    seed: options.seed,
    ...counts,
    sold,
    coinsPerHour: Math.round(report.coinsEarned / options.hours),
    hoursToAfford,
    minutesCrowded: Math.round(crowdedMs / minutes(1)),
    finalAnimals: sim.animalCount(),
  };
}

export function formatEconomyReport(r: EconomyReport, runtimeMs?: number): string {
  const afford = Object.entries(r.hoursToAfford)
    .map(([id, h]) => `${id} ${h === null ? 'not reached' : `${h.toFixed(1)} h`}`)
    .join(', ');
  const soldTotal = Object.values(r.sold).reduce((a, b) => a + b, 0);
  return [
    `Economy summary: ${r.hours} h, seed ${r.seed} (Cottage, lure 0, bot never spends)`,
    `  Visitors: ${r.visitorsArrived} arrived, ${r.visitorsEntered} came in, ` +
      `${r.visitorsLeftAtGate} left at the gate, ${r.visitorsSkippedCrowded} skipped (crowded)`,
    `  Births: ${r.births} litters, ${r.babies} babies`,
    `  Sold: ${soldTotal} (${RARITIES.map((x) => `${x} ${r.sold[x]}`).join(', ')}), ` +
      `${r.sparklesSold} Sparkle`,
    `  Coins earned: ${r.coinsEarned} (${r.coinsPerHour}/hour)`,
    `  Earnings reach: ${afford}`,
    `  Time crowded: ${r.minutesCrowded} min; animals at end: ${r.finalAnimals}`,
    ...(runtimeMs === undefined ? [] : [`  Simulated in ${Math.round(runtimeMs)} ms`]),
  ].join('\n');
}
