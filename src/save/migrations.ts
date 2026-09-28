import { CURRENT_SCHEMA_VERSION, type SaveFile } from './schema';

/** Upgrades a save from version N (the key) to N + 1. Never edit a shipped migration. */
export type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // Example for the first real change:
  // 1: (save) => ({ ...save, schemaVersion: 2, profile: { ...(save.profile as object), avatar: DEFAULT_AVATAR } }),
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
    save = step(save);
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
