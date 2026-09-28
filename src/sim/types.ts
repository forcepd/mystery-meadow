import type { RngState } from './rng';

/** Epoch milliseconds. All sim timers are stored as absolute timestamps. */
export type Ms = number;

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export type Zone = 'yard' | 'house';

/** Result of every sim command. UI shows `reason` to the player when a command is refused. */
export type CommandResult = { ok: true } | { ok: false; reason: string };

/** Position inside a zone, normalized to 0..1 on each axis. Scenes map it to pixels. */
export interface Vec2 {
  x: number;
  y: number;
}

/** DESIGN.md Section 19. Fields for later phases exist now so saves don't need migrating. */
export interface Animal {
  id: string;
  speciesId: string;
  variantId: string;
  isSparkle: boolean;
  rarity: Rarity;
  name?: string;
  arrivedAt: Ms;
  /** Set for animals born in the yard. */
  bornAt?: Ms;
  holdUntil: Ms;
  /** Set for babies: when they grow to adult size. */
  grownAt?: Ms;
  pregnancy?: { birthAt: Ms; litterSize: number };
  zone: Zone;
  position: Vec2;
  needs: { hunger: number; happiness: number };
  careHistory: number[];
  sickness?: Sickness;
  /** illnessId -> immune until. */
  immunities: Record<string, Ms>;
  isKept: boolean;
  outfit: { head?: string; body?: string; face?: string };
  tricks: { known: string[]; progress: Record<string, number>; nextTrainAt: Ms };
  nextPoopAt: Ms;
  nextWanderAt: Ms;
  /** Petting cooldown ends (DESIGN 8.4). Added in save v2. */
  nextPetAt: Ms;
}

/** DESIGN 9. */
export interface Sickness {
  illnessId: string;
  since: Ms;
  /** Free Clinic: waiting to see the vet until this time. Cleared when the wait is over. */
  atClinicUntil?: Ms;
  /**
   * Set once checked in at the vet (save v3), so leaving the clinic never charges twice.
   * `free` = Free Clinic: the visit and its treatments cost nothing.
   */
  visit?: 'paid' | 'free';
}

/** Kept pet in Pet Storage (paused). On retrieval, timestamps shift by (now - storedAt). */
export interface StoredPet {
  animal: Animal;
  storedAt: Ms;
}

/** What a mystery visitor turns out to be. Rolled when it reaches the gate. */
export interface VisitorRoll {
  speciesId: string;
  variantId: string;
  isSparkle: boolean;
  rarity: Rarity;
  /** 0 = not pregnant. */
  litterSize: number;
}

export interface Visitor {
  id: string;
  arrivedAtGate: Ms;
  autoRevealAt: Ms;
  /** Only matters if there's no room: the visitor waves goodbye at this time. */
  leavesAt: Ms;
  revealed: boolean;
  roll: VisitorRoll;
}

export interface Poop {
  id: string;
  zone: Zone;
  position: Vec2;
  createdAt: Ms;
}

export interface PlacedItem {
  id: string;
  itemId: string;
  zone: Zone;
  tile: { x: number; y: number };
  rotation: 0 | 90 | 180 | 270;
  servings?: number;
}

export interface GameSettings {
  offlineProgress: boolean;
  sicknessEnabled: boolean;
  dailyTrickGemCap: number;
  musicVolume: number;
  sfxVolume: number;
  reducedMotion: boolean;
}

export interface HouseState {
  tierId: string;
  exteriorColor: string;
  roomExpansions: number;
  petSlotsPurchased: number;
  storageExpansions: number;
  /** Applied wallpaper and flooring item ids (save v4). */
  wallpaperId: string;
  flooringId: string;
}

export interface WorldState {
  coins: number;
  gems: number;
  house: HouseState;
  placedItems: PlacedItem[];
  /** itemId -> count (unplaced furniture, pet outfits). */
  inventory: Record<string, number>;
  /** Animals out in the world (yard/house), including kept pets in slots. */
  animals: Animal[];
  petStorage: StoredPet[];
  gateQueue: Visitor[];
  poops: Poop[];
  nextVisitorAt: Ms;
  /** `${speciesId}:${variantId}`, plus `${speciesId}:sparkle`. */
  discoveredDex: string[];
  settings: GameSettings;
}

export interface SimMeta {
  createdAt: Ms;
  /** Time of the last processed tick. Everything up to here has been simulated. */
  lastSeenAt: Ms;
  rngSeed: number;
  rngState: RngState;
  /** Counter for deterministic ids. */
  nextId: number;
  dailyTrickGems: { date: string; earned: number };
}

/** Everything the sim needs to resume exactly. Plain JSON. */
export interface SimState {
  world: WorldState;
  meta: SimMeta;
}

/** What happened while the player was away (for the "While you were away" card). */
export interface OfflineSummary {
  /** Real time between the last tick and now. */
  awayMs: Ms;
  /** How much of that was simulated (capped; zero if offline progress is off). */
  simulatedMs: Ms;
  visitorsWaiting: number;
  babiesBorn: number;
  grewUp: number;
  readyToSell: number;
}
