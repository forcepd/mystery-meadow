import { describe, expect, it, vi } from 'vitest';
import {
  debugAddCoins,
  debugAddGems,
  debugRunOnline,
  debugSpawnVisitor,
} from '../../../src/sim/debugCommands';
import { BALANCE } from '../../../src/config/balance';
import { HOUR, MIN, START, edit, fillAnimals, newSim } from './helpers';

describe('debug commands', () => {
  it('spawns a visitor at the gate now, with forced species, variant, Sparkle, and litter', () => {
    const h = newSim();
    const res = debugSpawnVisitor(h.sim, {
      speciesId: 'unicorn',
      variantId: 'pink',
      isSparkle: true,
      pregnant: 5,
    });
    expect(res).toEqual({ ok: true });
    const v = h.sim.state.world.gateQueue[0]!;
    expect(v.roll).toEqual({
      speciesId: 'unicorn',
      variantId: 'pink',
      isSparkle: true,
      rarity: 'legendary',
      litterSize: 5,
    });
    expect(v.arrivedAtGate).toBe(START);
  });

  it('forces a rarity without a species', () => {
    const h = newSim();
    for (let i = 0; i < 20; i++) debugSpawnVisitor(h.sim, { rarity: 'epic', pregnant: false });
    for (const v of h.sim.state.world.gateQueue) {
      expect(v.roll.rarity).toBe('epic');
      expect(v.roll.litterSize).toBe(0);
    }
  });

  it('spawns even when crowded, and refuses unknown species or variants', () => {
    const h = edit(newSim(), (s) => fillAnimals(s, 9));
    expect(debugSpawnVisitor(h.sim).ok).toBe(true);
    expect(debugSpawnVisitor(h.sim, { speciesId: 'dodo' }).ok).toBe(false);
    expect(debugSpawnVisitor(h.sim, { speciesId: 'fox', variantId: 'plaid' }).ok).toBe(false);
  });

  it('adds coins and gems but never below zero', () => {
    const h = newSim();
    const coins = vi.fn();
    h.sim.events.on('coinsChanged', coins);
    debugAddCoins(h.sim, 1000);
    debugAddGems(h.sim, 10);
    expect(h.sim.state.world.coins).toBe(BALANCE.startingCoins + 1000);
    expect(h.sim.state.world.gems).toBe(BALANCE.startingGems + 10);
    expect(coins).toHaveBeenCalledOnce();
    debugAddCoins(h.sim, -99999);
    debugAddGems(h.sim, -99999);
    expect(h.sim.state.world.coins).toBe(0);
    expect(h.sim.state.world.gems).toBe(0);
  });

  it('plays a long jump forward with online rules (no catch-up)', () => {
    const h = newSim();
    const caughtUp = vi.fn();
    const timerFired = vi.fn();
    h.sim.events.on('caughtUp', caughtUp);
    h.sim.events.on('visitorArrived', timerFired);
    h.sim.events.on('visitorSkipped', timerFired);
    h.clock.advance(HOUR);
    debugRunOnline(h.sim);
    expect(caughtUp).not.toHaveBeenCalled();
    expect(timerFired).toHaveBeenCalledTimes(6);
    // Online rules: visitors auto-revealed and came in (offline they'd wait unrevealed).
    expect(h.sim.animalCount()).toBeGreaterThan(0);
    const settled = h.sim.state.world.gateQueue.filter((v) => h.sim.now() >= v.autoRevealAt);
    expect(settled.every((v) => v.revealed)).toBe(true);
    expect(h.sim.now()).toBe(START + 60 * MIN);
  });
});
