import type { SimMeta, SimState, WorldState } from '../sim/types';

/** Bump this and add a migration in migrations.ts for ANY change to saved state. */
export const CURRENT_SCHEMA_VERSION = 3;

/** Phase 8 adds the avatar and owned items (with a migration). */
export interface Profile {
  id: string;
  username: string;
}

/** DESIGN 19. One per profile, stored under `profile:<id>`. */
export interface SaveFile {
  schemaVersion: number;
  profile: Profile;
  world: WorldState;
  meta: SimMeta;
}

export function saveKey(profileId: string): string {
  return `profile:${profileId}`;
}

export function toSaveFile(profile: Profile, state: SimState): SaveFile {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: { ...profile },
    world: state.world,
    meta: state.meta,
  };
}

export function toSimState(save: SaveFile): SimState {
  return { world: save.world, meta: save.meta };
}
