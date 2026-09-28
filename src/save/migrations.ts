import { CURRENT_SCHEMA_VERSION, type SaveFile } from './schema';

/** Upgrades a save from version N (the key) to N + 1. Never edit a shipped migration. */
export type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  /**
   * v1 -> v2 (Phase 3, Care): every animal gets a petting cooldown (`nextPetAt`, ready now),
   * and a game with no food bowl gets the starting bowl, full. Values are literal on purpose:
   * a migration must keep producing the same result even if the balance config changes later.
   */
  1: (save) => {
    const world = save.world as {
      animals: Record<string, unknown>[];
      petStorage: { animal: Record<string, unknown> }[];
      placedItems: { id: string; itemId: string }[];
    };
    const meta = save.meta as { lastSeenAt: number };
    const addPetTimer = (a: Record<string, unknown>) => ({ nextPetAt: meta.lastSeenAt, ...a });
    const hasBowl = world.placedItems.some((p) => p.itemId === 'food_bowl');
    const bowlId = world.placedItems.some((p) => p.id === 'start1') ? 'start1-v2' : 'start1';
    return {
      ...save,
      schemaVersion: 2,
      world: {
        ...world,
        animals: world.animals.map(addPetTimer),
        petStorage: world.petStorage.map((p) => ({ ...p, animal: addPetTimer(p.animal) })),
        placedItems: hasBowl
          ? world.placedItems
          : [
              ...world.placedItems,
              {
                id: bowlId,
                itemId: 'food_bowl',
                zone: 'yard',
                tile: { x: 1, y: 0 },
                rotation: 0,
                servings: 5,
              },
            ],
      },
    };
  },

  /**
   * v2 -> v3 (Phase 4, Health and Vet): `sickness` gains an optional `visit` (checked in at the
   * vet). Nobody could get sick before v3, so there is nothing to fill in: only the version moves.
   */
  2: (save) => ({ ...save, schemaVersion: 3 }),

  /**
   * v3 -> v4 (Phase 6, House): the house gets its applied wallpaper and flooring (the free
   * starter ones). Literal ids on purpose (see v1 -> v2).
   */
  3: (save) => {
    const world = save.world as { house: Record<string, unknown> };
    return {
      ...save,
      schemaVersion: 4,
      world: {
        ...world,
        house: { wallpaperId: 'wallpaper_cream', flooringId: 'flooring_wood', ...world.house },
      },
    };
  },
};

export class SaveError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid' | 'tooNew' | 'missingMigration',
  ) {
    super(message);
    this.name = 'SaveError';
  }
}

/** Brings any older save up to the current schema. Throws SaveError if it can't. */
export function migrate(
  raw: unknown,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  currentVersion: number = CURRENT_SCHEMA_VERSION,
): SaveFile {
  if (!isRecord(raw)) throw new SaveError('Save is not an object', 'invalid');
  const startVersion = raw.schemaVersion;
  if (typeof startVersion !== 'number' || !Number.isInteger(startVersion) || startVersion < 1) {
    throw new SaveError('Save has no valid schemaVersion', 'invalid');
  }
  if (startVersion > currentVersion) {
    throw new SaveError(
      `Save is from a newer version of the game (${startVersion} > ${currentVersion})`,
      'tooNew',
    );
  }
  let save: Record<string, unknown> = raw;
  for (let v = startVersion; v < currentVersion; v++) {
    const step = migrations[v];
    if (!step) throw new SaveError(`No migration from version ${v}`, 'missingMigration');
    try {
      save = step(save);
    } catch (error) {
      // A step assumes the shape of version v; anything else is a broken save.
      throw new SaveError(
        `Save could not be upgraded from version ${v}: ${String(error)}`,
        'invalid',
      );
    }
    if (save.schemaVersion !== v + 1) {
      throw new SaveError(`Migration from ${v} did not produce version ${v + 1}`, 'invalid');
    }
  }
  validate(save);
  return save;
}

/** Structural check of the current schema: enough to refuse garbage, not a full validator. */
function validate(
  save: Record<string, unknown>,
): asserts save is Record<string, unknown> & SaveFile {
  const { profile, world, meta } = save;
  const ok =
    isRecord(profile) &&
    typeof profile.id === 'string' &&
    isRecord(world) &&
    typeof world.coins === 'number' &&
    typeof world.gems === 'number' &&
    isRecord(world.house) &&
    Array.isArray(world.animals) &&
    Array.isArray(world.gateQueue) &&
    typeof world.nextVisitorAt === 'number' &&
    isRecord(world.settings) &&
    isRecord(meta) &&
    typeof meta.lastSeenAt === 'number' &&
    typeof meta.nextId === 'number' &&
    Array.isArray(meta.rngState) &&
    meta.rngState.length === 4;
  if (!ok) throw new SaveError('Save is missing required fields', 'invalid');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
