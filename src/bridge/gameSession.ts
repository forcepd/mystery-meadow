import { ScaledClock, systemClock, type Clock } from '../sim/clock';
import { GameSim } from '../sim/GameSim';
import { SaveManager, type KeyValueStore } from '../save/SaveManager';
import { toSaveFile, toSimState, type Profile } from '../save/schema';
import { Emitter } from '../sim/emitter';

/** Phase 2 has a single auto-created profile; real profiles arrive in Phase 8. */
export const DEFAULT_PROFILE: Profile = { id: 'default', username: 'Player' };

export type SessionEvents = {
  /** A save attempt failed (e.g. storage blocked in a private window). */
  saveFailed: { error: unknown };
};

export interface SessionOptions {
  store: KeyValueStore;
  /** Real time source. Defaults to the system clock. */
  source?: Clock;
  /** Seed for a brand new game. */
  newSeed?: () => number;
  profile?: Profile;
}

/**
 * Owns one running game: the clock, the sim, and its save. The app drives it with `frame()`
 * (every animation frame), `hidden()` / `visible()` (page visibility), and `autosave()`.
 */
export class GameSession {
  readonly events = new Emitter<SessionEvents>();
  private saving: Promise<void> = Promise.resolve();
  private stopped = false;
  private stateVersion = 0;

  private constructor(
    readonly sim: GameSim,
    readonly clock: ScaledClock,
    readonly profile: Profile,
    private readonly saves: SaveManager,
    /** True if this session started a brand new game. */
    readonly isNewGame: boolean,
  ) {
    sim.events.on('changed', () => this.stateVersion++);
    // DESIGN 18.4: save after any sale (and, later, any purchase).
    sim.events.on('animalSold', () => void this.save());
  }

  /** Bumps whenever sim state may have changed. For React's useSyncExternalStore. */
  get version(): number {
    return this.stateVersion;
  }

  subscribe = (listener: () => void): (() => void) => this.sim.events.on('changed', listener);

  /** Loads the profile's save (catching up the time away) or starts a new game. */
  static async start(options: SessionOptions): Promise<GameSession> {
    const source = options.source ?? systemClock;
    const profile = options.profile ?? DEFAULT_PROFILE;
    const saves = new SaveManager(options.store);
    const file = await saves.load(profile.id);

    if (file) {
      // Never let game time run backwards, even if the device clock was set back.
      const clock = new ScaledClock(source, 1, Math.max(source.now(), file.meta.lastSeenAt));
      const sim = GameSim.fromState(toSimState(file), clock);
      const session = new GameSession(sim, clock, file.profile, saves, false);
      sim.catchUp();
      return session;
    }

    const clock = new ScaledClock(source, 1);
    const seed = (options.newSeed ?? randomSeed)();
    const sim = GameSim.newGame({ clock, seed });
    const session = new GameSession(sim, clock, profile, saves, true);
    await session.save();
    return session;
  }

  /** Call every animation frame. */
  frame(): void {
    this.sim.update();
  }

  /** The page was hidden: save now, since it may never come back. */
  hidden(): Promise<void> {
    return this.save();
  }

  /** The page is visible again: the time away is offline time. */
  visible(): void {
    this.sim.catchUp();
  }

  autosave(): Promise<void> {
    this.sim.update();
    return this.save();
  }

  /** Saves the current state. Saves never overlap; failures are reported, not thrown. */
  save(): Promise<void> {
    if (this.stopped) return this.saving;
    const file = toSaveFile(this.profile, this.sim.toState());
    this.saving = this.saving
      .then(() => this.saves.save(file))
      .catch((error: unknown) => this.events.emit('saveFailed', { error }));
    return this.saving;
  }

  /** Dev only: throws away this profile's save. The app reloads afterwards. */
  async deleteSave(): Promise<void> {
    this.stopped = true;
    await this.saving;
    await this.saves.delete(this.profile.id);
  }
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0x100000000);
}
