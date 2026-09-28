import { BALANCE } from '../config/balance';
import { emptySummary, hours, seconds, type SimContext } from './context';
import { tickLifecycle } from './systems/lifecycle';
import { tickBirths } from './systems/pregnancy';
import { shiftWorld } from './systems/timeShift';
import { refreshGateTimers, tickGate, tickVisitorTimer } from './systems/visitors';
import { tickWander } from './systems/wander';
import type { Ms, OfflineSummary } from './types';

export const TICK_MS: Ms = seconds(BALANCE.time.tickSeconds);

/** One fixed step ending at time t. Order matters: births first, so capacity is up to date. */
export function runTick(ctx: SimContext, t: Ms): void {
  const prev = ctx.state.meta.lastSeenAt;
  tickBirths(ctx, t);
  tickLifecycle(ctx, prev, t);
  tickVisitorTimer(ctx, t);
  tickGate(ctx, t);
  tickWander(ctx, t);
  ctx.state.meta.lastSeenAt = t;
}

/** Last tick boundary at or before `now`. */
export function alignedTarget(lastSeenAt: Ms, now: Ms): Ms {
  return lastSeenAt + Math.max(0, Math.floor((now - lastSeenAt) / TICK_MS)) * TICK_MS;
}

/** Online: runs every whole tick between the last one and now. */
export function runOnline(ctx: SimContext, now: Ms): void {
  const target = alignedTarget(ctx.state.meta.lastSeenAt, now);
  while (ctx.state.meta.lastSeenAt < target) runTick(ctx, ctx.state.meta.lastSeenAt + TICK_MS);
}

/**
 * DESIGN 14: offline catch-up. Visitors queue at the gate, pregnancies, births, hold timers and
 * growth progress; needs, poop, and sickness don't (those systems skip offline ticks).
 * Only the last maxCatchUpHours are simulated (none if offline progress is off): the rest is
 * paused time, so every timer is shifted past it.
 */
export function runOffline(ctx: SimContext, now: Ms): OfflineSummary {
  const { meta, world } = ctx.state;
  const target = alignedTarget(meta.lastSeenAt, now);
  const summary = emptySummary();
  summary.awayMs = target - meta.lastSeenAt;
  if (summary.awayMs <= 0) return summary;

  const cap = world.settings.offlineProgress ? hours(BALANCE.offline.maxCatchUpHours) : 0;
  const paused = Math.min(
    summary.awayMs,
    Math.ceil(Math.max(0, summary.awayMs - cap) / TICK_MS) * TICK_MS,
  );
  if (paused > 0) {
    shiftWorld(world, paused);
    meta.lastSeenAt += paused;
  }

  ctx.offline = true;
  ctx.summary = summary;
  try {
    while (meta.lastSeenAt < target) runTick(ctx, meta.lastSeenAt + TICK_MS);
  } finally {
    ctx.offline = false;
  }
  summary.simulatedMs = summary.awayMs - paused;
  summary.visitorsWaiting = world.gateQueue.length;
  refreshGateTimers(ctx, target);
  return summary;
}
