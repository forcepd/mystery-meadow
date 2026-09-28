import { BALANCE } from '../../config/balance';
import { seconds, type SimContext } from '../context';
import type { Ms } from '../types';
import { randomPosition } from './animals';

/**
 * DESIGN 12.4 wander timer. Phase 2: each animal picks a new spot in its zone every 60-120 s.
 * Phase 6 adds switching zones (yard <-> house) at the same moment. Paused offline.
 */
export function tickWander(ctx: SimContext, t: Ms): void {
  if (ctx.offline) return;
  const { minSeconds, maxSeconds } = BALANCE.wander;
  for (const animal of ctx.state.world.animals) {
    if (t < animal.nextWanderAt) continue;
    animal.position = randomPosition(ctx);
    animal.nextWanderAt = t + seconds(ctx.rng.range(minSeconds, maxSeconds));
  }
}
