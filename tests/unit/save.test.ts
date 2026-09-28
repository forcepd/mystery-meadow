import { describe, expect, it } from 'vitest';
import { FakeClock } from '../../src/sim/clock';
import { GameSim } from '../../src/sim/GameSim';
import { MemoryStore, SaveManager } from '../../src/save/SaveManager';
import { SaveError, migrate, type Migration } from '../../src/save/migrations';
import {
  CURRENT_SCHEMA_VERSION,
  toSaveFile,
  toSimState,
  type SaveFile,
} from '../../src/save/schema';
import { HOUR, MIN, SEC, START, newSim, play } from './sim/helpers';

const profile = { id: 'p1', username: 'Sunny_Fox' };

/** A bot that taps visitors and sells whatever it can. Exercises the RNG. */
function botStep(sim: GameSim): void {
  for (const v of [...sim.state.world.gateQueue]) if (!v.revealed) sim.revealVisitor(v.id);
  for (const a of [...sim.state.world.animals]) if (sim.canSell(a.id).ok) sim.sell(a.id);
}

function playWithBot(sim: GameSim, clock: FakeClock, ms: number): void {
  const end = clock.now() + ms;
  while (clock.now() < end) {
    clock.advance(SEC);
    sim.update();
    botStep(sim);
  }
}

describe('save round-trip', () => {
  it('saves, loads, and continues exactly like an uninterrupted game', async () => {
    const a = newSim(42);
    const b = newSim(42);
    playWithBot(a.sim, a.clock, 90 * MIN);
    playWithBot(b.sim, b.clock, 90 * MIN);

    const manager = new SaveManager(new MemoryStore());
    await manager.save(toSaveFile(profile, b.sim.toState()));
    const loaded = await manager.load(profile.id);
    expect(loaded).toBeDefined();
    expect(loaded!.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(loaded!.profile).toEqual(profile);
    const resumed = GameSim.fromState(toSimState(loaded!), b.clock);

    playWithBot(a.sim, a.clock, 90 * MIN);
    playWithBot(resumed, b.clock, 90 * MIN);
    expect(resumed.toState()).toEqual(a.sim.toState());
    expect(a.sim.state.world.coins).toBeGreaterThan(100);
  });

  it('survives JSON export/import unchanged', () => {
    const h = newSim(3);
    play(h, 45 * MIN);
    const file = toSaveFile(profile, h.sim.toState());
    const text = JSON.stringify(file);
    expect(migrate(JSON.parse(text))).toEqual(file);
  });

  it('catches up offline time after loading', async () => {
    const h = newSim(5);
    play(h, 5 * MIN);
    const manager = new SaveManager(new MemoryStore());
    await manager.save(toSaveFile(profile, h.sim.toState()));

    const later = new FakeClock(h.clock.now() + 2 * HOUR);
    const sim = GameSim.fromState(toSimState((await manager.load(profile.id))!), later);
    const summary = sim.catchUp();
    expect(summary.awayMs).toBe(2 * HOUR);
    expect(sim.state.world.gateQueue.length).toBeGreaterThan(0);
  });

  it('keeps profiles separate and lists them', async () => {
    const manager = new SaveManager(new MemoryStore());
    const h = newSim();
    await manager.save(toSaveFile({ id: 'a', username: 'A' }, h.sim.toState()));
    await manager.save(toSaveFile({ id: 'b', username: 'B' }, h.sim.toState()));
    expect((await manager.listProfileIds()).sort()).toEqual(['a', 'b']);
    await manager.delete('a');
    expect(await manager.listProfileIds()).toEqual(['b']);
    expect(await manager.load('a')).toBeUndefined();
  });

  it('does not share state between the sim and the save', () => {
    const h = newSim();
    const state = h.sim.toState();
    state.world.coins = 99999;
    expect(h.sim.state.world.coins).not.toBe(99999);
    const resumed = GameSim.fromState(state, h.clock);
    state.world.coins = 1;
    expect(resumed.state.world.coins).toBe(99999);
  });
});

describe('migrations', () => {
  function currentSave(): SaveFile {
    return toSaveFile(profile, newSim().sim.toState());
  }

  it('passes a current save through', () => {
    const save = currentSave();
    expect(migrate(structuredClone(save))).toEqual(save);
  });

  it('runs each migration in order from the save version up', () => {
    const save = currentSave() as unknown as Record<string, unknown>;
    const v1 = { ...save, schemaVersion: 1, legacy: true };
    const migrations: Record<number, Migration> = {
      1: (s) => ({ ...s, schemaVersion: 2, steps: ['1to2'] }),
      2: (s) => ({ ...s, schemaVersion: 3, steps: [...(s.steps as string[]), '2to3'] }),
    };
    const out = migrate(v1, migrations, 3) as unknown as Record<string, unknown>;
    expect(out.schemaVersion).toBe(3);
    expect(out.steps).toEqual(['1to2', '2to3']);
    expect(out.legacy).toBe(true);
  });

  it('refuses saves from a newer game version', () => {
    const save = { ...currentSave(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    expect(() => migrate(save)).toThrow(SaveError);
    try {
      migrate(save);
    } catch (e) {
      expect((e as SaveError).code).toBe('tooNew');
    }
  });

  it('refuses a missing migration step', () => {
    expect(() => migrate({ ...currentSave(), schemaVersion: 1 }, {}, 2)).toThrow(
      /No migration from version 1/,
    );
  });

  it('refuses a migration that forgets to bump the version', () => {
    expect(() => migrate({ ...currentSave(), schemaVersion: 1 }, { 1: (s) => s }, 2)).toThrow(
      SaveError,
    );
  });

  it.each([
    ['null', null],
    ['a string', 'hello'],
    ['an array', []],
    ['no version', { world: {} }],
    ['version 0', { schemaVersion: 0 }],
    ['a fractional version', { schemaVersion: 1.5 }],
    ['missing world', { schemaVersion: 1, profile: { id: 'x' }, meta: {} }],
  ])('refuses garbage: %s', (_label, raw) => {
    expect(() => migrate(raw)).toThrow(SaveError);
  });

  it('refuses a save with a broken RNG state', () => {
    const save = currentSave();
    (save.meta as { rngState: unknown }).rngState = [1, 2];
    expect(() => migrate(save)).toThrow(SaveError);
  });

  it('stamps the current schema version on new saves', () => {
    expect(currentSave().schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(currentSave().meta.createdAt).toBe(START);
  });
});
