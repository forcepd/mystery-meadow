import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SPECIES, getSpecies } from '../../src/config/species';
import { RARITIES } from '../../src/sim/types';

describe('BALANCE', () => {
  it('is deeply frozen', () => {
    expect(Object.isFrozen(BALANCE)).toBe(true);
    expect(Object.isFrozen(BALANCE.houseTiers)).toBe(true);
    expect(Object.isFrozen(BALANCE.houseTiers[0])).toBe(true);
    expect(Object.isFrozen(BALANCE.houseTiers[0]?.interiorGrid)).toBe(true);
    expect(Object.isFrozen(BALANCE.rarity.baseWeights)).toBe(true);
    expect(() => {
      (BALANCE as { startingCoins: number }).startingCoins = 1;
    }).toThrow();
  });

  it('has the four house tiers in order with increasing cost and capacity', () => {
    expect(BALANCE.houseTiers.map((t) => t.id)).toEqual([
      'cottage',
      'bungalow',
      'farmhouse',
      'manor',
    ]);
    for (let i = 1; i < BALANCE.houseTiers.length; i++) {
      const prev = BALANCE.houseTiers[i - 1]!;
      const cur = BALANCE.houseTiers[i]!;
      expect(cur.cost).toBeGreaterThan(prev.cost);
      expect(cur.baseCapacity).toBeGreaterThan(prev.baseCapacity);
      expect(cur.visitorMinutes).toBeLessThanOrEqual(prev.visitorMinutes);
    }
    expect(BALANCE.houseTiers[0]!.cost).toBe(0);
  });

  it('has enough room expansion prices for the tier with the most expansions', () => {
    const most = Math.max(...BALANCE.houseTiers.map((t) => t.maxRoomExpansions));
    expect(BALANCE.roomExpansionCosts.length).toBeGreaterThanOrEqual(most);
  });

  it('defines every rarity table for every rarity', () => {
    const tables = [
      BALANCE.rarity.baseWeights,
      BALANCE.rarity.lureBoost,
      BALANCE.rarity.floorFactor,
      BALANCE.rarity.basePrice,
      BALANCE.tricks.maxByRarity,
    ];
    for (const table of tables) {
      expect(Object.keys(table).sort()).toEqual([...RARITIES].sort());
    }
  });

  it('keeps probabilities in [0, 1] and ranges ordered', () => {
    for (const p of [
      BALANCE.rarity.sparkleChance,
      BALANCE.pregnancy.chance,
      BALANCE.pregnancy.babyKeepsMotherColor,
      BALANCE.pregnancy.sparkleInheritChance,
      BALANCE.sickness.baseChancePerMinute,
    ]) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
    expect(BALANCE.poop.minMinutes).toBeLessThanOrEqual(BALANCE.poop.maxMinutes);
    expect(BALANCE.wander.minSeconds).toBeLessThanOrEqual(BALANCE.wander.maxSeconds);
    expect(BALANCE.care.minMultiplier).toBeLessThanOrEqual(BALANCE.care.maxMultiplier);
  });

  it('caps litters at 5 (DESIGN 7.3)', () => {
    const sizes = Object.keys(BALANCE.pregnancy.litterWeights).map(Number);
    expect(Math.max(...sizes)).toBe(5);
    expect(Math.min(...sizes)).toBe(1);
  });
});

describe('SPECIES', () => {
  // DESIGN 7.1 says "(20)" but its table lists 21; we follow the table (see PROGRESS.md).
  it('has the starter roster from the DESIGN 7.1 table with the right rarity counts', () => {
    expect(SPECIES).toHaveLength(21);
    const count = (r: string) => SPECIES.filter((s) => s.rarity === r).length;
    expect(count('common')).toBe(6);
    expect(count('uncommon')).toBe(5);
    expect(count('rare')).toBe(4);
    expect(count('epic')).toBe(3);
    expect(count('legendary')).toBe(3);
  });

  it('has unique species ids and asset keys', () => {
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(SPECIES.length);
    expect(new Set(SPECIES.map((s) => s.assetKey)).size).toBe(SPECIES.length);
  });

  it('gives each species 3–5 uniquely named color variants', () => {
    for (const s of SPECIES) {
      expect(s.variants.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.variants.length, s.id).toBeLessThanOrEqual(5);
      expect(new Set(s.variants.map((v) => v.id)).size, s.id).toBe(s.variants.length);
      for (const v of s.variants) expect(v.placeholderColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('has at least one species in every rarity so every rarity roll can resolve', () => {
    for (const r of RARITIES) expect(SPECIES.some((s) => s.rarity === r)).toBe(true);
  });

  it('looks species up by id', () => {
    expect(getSpecies('red_panda')?.name).toBe('Red Panda');
    expect(getSpecies('nope')).toBeUndefined();
  });

  it('is frozen', () => {
    expect(Object.isFrozen(SPECIES)).toBe(true);
    expect(Object.isFrozen(SPECIES[0]?.variants)).toBe(true);
  });
});
