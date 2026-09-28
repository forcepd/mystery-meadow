/** Epoch milliseconds. All sim timers are stored as absolute timestamps. */
export type Ms = number;

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export type Zone = 'yard' | 'house';

/** Result of every sim command. UI shows `reason` to the player when a command is refused. */
export type CommandResult = { ok: true } | { ok: false; reason: string };
