import type { SimContext } from '../context';

/** Coins are integers and never go negative. */
export function addCoins(ctx: SimContext, delta: number): void {
  if (!Number.isInteger(delta)) throw new RangeError(`Coin change must be an integer (${delta})`);
  const world = ctx.state.world;
  if (world.coins + delta < 0) throw new RangeError('Not enough coins');
  if (delta === 0) return;
  world.coins += delta;
  ctx.emit('coinsChanged', { coins: world.coins, delta });
}
