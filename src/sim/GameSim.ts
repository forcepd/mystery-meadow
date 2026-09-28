import { BALANCE } from '../config/balance';
import { DEFAULT_HOUSE_COLOR } from '../config/houseColors';
import { STARTING_ITEMS } from '../config/yard';
import type { Clock } from './clock';
import { emptySummary, minutes, seconds, type SimContext } from './context';
import { Emitter } from './emitter';
import type { SimEvents } from './events';
import { Rng } from './rng';
import { isBaby, isReadyToSell } from './systems/animals';
import {
  animalCount,
  freeCapacity,
  getHouseTier,
  isCrowded,
  totalCapacity,
} from './systems/housing';
import { lureScore } from './systems/rarity';
import { feedTreat, isBowl, refillBowl } from './systems/feeding';
import { renameAnimal } from './systems/naming';
import { careMultiplier, cleanliness } from './systems/needs';
import { pet } from './systems/petting';
import { cleanPoop } from './systems/poop';
import { canSell, findAnimal, salePrice, sell } from './systems/selling';
import { revealVisitor } from './systems/visitors';
import { runOffline, runOnline } from './tick';
import type {
  Animal,
  CommandResult,
  Ms,
  OfflineSummary,
  PlacedItem,
  SimState,
  Zone,
} from './types';

export type Badge = 'new' | 'pregnant' | 'baby' | 'sick' | 'readyToSell' | 'kept';

export interface NewGameOptions {
  clock: Clock;
  seed: number;
}

/**
 * The headless game (DESIGN 18.2). UI calls commands and reads state; it never mutates state.
 * Call `update()` often (e.g. every frame) and `catchUp()` when the app returns from being hidden
 * or right after loading a save.
 */
export class GameSim {
  readonly events = new Emitter<SimEvents>();
  private readonly ctx: SimContext;
  private crowded: boolean;

  private constructor(
    private readonly clock: Clock,
    state: SimState,
  ) {
    const rng = Rng.fromState(state.meta.rngState);
    this.ctx = {
      state,
      rng,
      offline: false,
      summary: emptySummary(),
      emit: (event, payload) => {
        if (!this.ctx.offline) this.events.emit(event, payload);
      },
    };
    this.crowded = isCrowded(state.world);
  }

  static newGame({ clock, seed }: NewGameOptions): GameSim {
    const now = clock.now();
    const rng = new Rng(seed);
    const cottage = BALANCE.houseTiers[0];
    const state: SimState = {
      world: {
        coins: BALANCE.startingCoins,
        gems: BALANCE.startingGems,
        house: {
          tierId: cottage.id,
          exteriorColor: DEFAULT_HOUSE_COLOR,
          roomExpansions: 0,
          petSlotsPurchased: 0,
          storageExpansions: 0,
        },
        placedItems: [],
        inventory: {},
        animals: [],
        petStorage: [],
        gateQueue: [],
        poops: [],
        nextVisitorAt: now + minutes(cottage.visitorMinutes),
        discoveredDex: [],
        settings: {
          offlineProgress: true,
          sicknessEnabled: true,
          dailyTrickGemCap: BALANCE.tricks.dailyGemCap,
          musicVolume: 1,
          sfxVolume: 1,
          reducedMotion: false,
        },
      },
      meta: {
        createdAt: now,
        lastSeenAt: now,
        rngSeed: seed,
        rngState: rng.getState(),
        nextId: 1,
        dailyTrickGems: { date: '', earned: 0 },
      },
    };
    state.world.placedItems = STARTING_ITEMS.map((item, i) => ({
      id: `start${i + 1}`,
      itemId: item.itemId,
      zone: item.zone,
      tile: { ...item.tile },
      rotation: 0,
      ...(item.itemId === 'food_bowl' ? { servings: BALANCE.needs.bowlServings } : {}),
    }));
    return new GameSim(clock, state);
  }

  /** Resumes from saved state. Call `catchUp()` next to cover the time since it was saved. */
  static fromState(state: SimState, clock: Clock): GameSim {
    return new GameSim(clock, clone(state));
  }

  /** A deep copy of the full state, safe to save. */
  toState(): SimState {
    this.syncRng();
    return clone(this.ctx.state);
  }

  /** Live state for rendering. Read-only: change it only through commands. */
  get state(): Readonly<SimState> {
    return this.ctx.state;
  }

  /** Sim time: the last processed tick. */
  now(): Ms {
    return this.ctx.state.meta.lastSeenAt;
  }

  // ---- Time -------------------------------------------------------------------------------

  /** Advances to the clock's time. A long gap is treated as offline time. */
  update(): void {
    const gap = this.clock.now() - this.now();
    if (gap > seconds(BALANCE.time.offlineGapSeconds)) {
      this.catchUp();
      return;
    }
    const before = this.now();
    runOnline(this.ctx, this.clock.now());
    this.afterChange(this.now() !== before);
  }

  /** Runs offline catch-up to the clock's time and emits `caughtUp`. */
  catchUp(): OfflineSummary {
    const summary = runOffline(this.ctx, this.clock.now());
    this.afterChange(summary.awayMs > 0);
    if (summary.awayMs > 0) this.events.emit('caughtUp', summary);
    return summary;
  }

  // ---- Commands ---------------------------------------------------------------------------

  revealVisitor(visitorId: string): CommandResult {
    return this.command(() => revealVisitor(this.ctx, visitorId, this.now()));
  }

  sell(animalId: string): CommandResult {
    return this.command(() => sell(this.ctx, animalId, this.now()));
  }

  /** Tap a food bowl: fills it back up for free. */
  refillBowl(bowlId: string): CommandResult {
    return this.command(() => refillBowl(this.ctx, bowlId));
  }

  feedTreat(animalId: string): CommandResult {
    return this.command(() => feedTreat(this.ctx, animalId));
  }

  cleanPoop(poopId: string): CommandResult {
    return this.command(() => cleanPoop(this.ctx, poopId));
  }

  /** Tap-and-hold petting. */
  pet(animalId: string): CommandResult {
    return this.command(() => pet(this.ctx, animalId, this.now()));
  }

  /** Names an animal (an empty name clears it). */
  rename(animalId: string, name: string): CommandResult {
    return this.command(() => renameAnimal(this.ctx, animalId, name));
  }

  // ---- Queries ----------------------------------------------------------------------------

  getAnimal(id: string): Readonly<Animal> | undefined {
    return findAnimal(this.ctx.state.world, id);
  }

  capacity(): number {
    return totalCapacity(this.ctx.state.world);
  }

  animalCount(): number {
    return animalCount(this.ctx.state.world);
  }

  freeCapacity(): number {
    return freeCapacity(this.ctx.state.world);
  }

  isCrowded(): boolean {
    return isCrowded(this.ctx.state.world);
  }

  lureScore(): number {
    return lureScore(this.ctx.state.world);
  }

  houseTier() {
    return getHouseTier(this.ctx.state.world);
  }

  msUntilNextVisitor(): Ms {
    return Math.max(0, this.ctx.state.world.nextVisitorAt - this.now());
  }

  salePrice(animalId: string): number | undefined {
    const animal = findAnimal(this.ctx.state.world, animalId);
    return animal && salePrice(this.ctx.state.world, animal);
  }

  /** 0.8..1.3 from recent care (DESIGN 7.5). */
  careMultiplier(animalId: string): number | undefined {
    const animal = findAnimal(this.ctx.state.world, animalId);
    return animal && careMultiplier(this.ctx.state.world, animal);
  }

  /** Zone cleanliness 0..100. */
  cleanliness(zone: Zone): number {
    return cleanliness(this.ctx.state.world, zone);
  }

  bowls(): readonly PlacedItem[] {
    return this.ctx.state.world.placedItems.filter(isBowl);
  }

  canSell(animalId: string): CommandResult {
    const animal = this.getAnimal(animalId);
    if (!animal) return { ok: false, reason: "Can't find that animal." };
    return canSell(animal, this.now());
  }

  /** DESIGN 7.2 status badges. */
  badges(animalId: string): Badge[] {
    const animal = this.getAnimal(animalId);
    if (!animal) return [];
    const now = this.now();
    const out: Badge[] = [];
    if (now < animal.arrivedAt + seconds(BALANCE.newBadgeSeconds)) out.push('new');
    if (animal.pregnancy) out.push('pregnant');
    if (isBaby(animal, now)) out.push('baby');
    if (animal.sickness) out.push('sick');
    if (animal.isKept) out.push('kept');
    else if (isReadyToSell(animal, now)) out.push('readyToSell');
    return out;
  }

  // ---- Internals --------------------------------------------------------------------------

  /**
   * @internal Dev tools only (src/sim/debugCommands.ts). Runs `fn` with direct access to the
   * sim internals and the clock's current time, without catching up first.
   */
  debugRun<T>(fn: (ctx: SimContext, clockNow: Ms) => T): T {
    const result = fn(this.ctx, this.clock.now());
    this.afterChange(true);
    return result;
  }

  private command(run: () => CommandResult): CommandResult {
    this.update();
    const result = run();
    this.afterChange(true);
    return result;
  }

  private afterChange(changed: boolean): void {
    this.syncRng();
    const crowded = isCrowded(this.ctx.state.world);
    if (crowded !== this.crowded) {
      this.crowded = crowded;
      this.events.emit('crowdedChanged', { crowded });
    }
    if (changed) this.events.emit('changed', undefined);
  }

  private syncRng(): void {
    this.ctx.state.meta.rngState = this.ctx.rng.getState();
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
