import { describe, expect, it, vi } from 'vitest';
import { BALANCE } from '../../../src/config/balance';
import { EXAM_TOOLS, ILLNESSES, TREATMENTS } from '../../../src/config/illnesses';
import { GameSim } from '../../../src/sim/GameSim';
import type { Animal, SimState } from '../../../src/sim/types';
import { HOUR, MIN, SEC, START, edit, makeAnimal, newSim, play } from './helpers';

const { visitFee, treatmentCost, freeClinicWaitMinutes } = BALANCE.vet;

function sickSim(coins: number, illnessId = 'sniffles', overrides: Partial<Animal> = {}) {
  return edit(newSim(), (s: SimState) => {
    s.world.coins = coins;
    s.world.animals.push(
      makeAnimal(s, {
        id: 'x',
        holdUntil: START,
        nextPoopAt: START + 99 * HOUR,
        sickness: { illnessId, since: START },
        ...overrides,
      }),
    );
  });
}

describe('checking in (DESIGN 9.5 step 1)', () => {
  it('charges the 20-coin visit fee once; going back is free', () => {
    const h = sickSim(100);
    const started = vi.fn();
    h.sim.events.on('vetVisitStarted', started);
    expect(h.sim.vetQuote()).toEqual({ free: false, fee: visitFee });
    expect(h.sim.goToVet('x')).toEqual({ ok: true });
    expect(h.sim.state.world.coins).toBe(100 - visitFee);
    expect(h.sim.getAnimal('x')!.sickness!.visit).toBe('paid');
    expect(h.sim.goToVet('x')).toEqual({ ok: true });
    expect(h.sim.state.world.coins).toBe(100 - visitFee);
    expect(started).toHaveBeenCalledTimes(1);
    expect(started).toHaveBeenCalledWith(expect.objectContaining({ free: false, fee: visitFee }));
  });

  it('refuses healthy and unknown animals', () => {
    const h = edit(newSim(), (s) => s.world.animals.push(makeAnimal(s, { id: 'ok' })));
    expect(h.sim.goToVet('ok')).toEqual({ ok: false, reason: 'Healthy and happy! No vet needed.' });
    expect(h.sim.goToVet('nope').ok).toBe(false);
    expect(h.sim.state.world.coins).toBe(BALANCE.startingCoins);
  });

  it('the visit survives a save and reload (never charged twice)', () => {
    const h = sickSim(100);
    h.sim.goToVet('x');
    h.sim = GameSim.fromState(h.sim.toState(), h.clock);
    h.sim.goToVet('x');
    expect(h.sim.state.world.coins).toBe(100 - visitFee);
    expect(h.sim.vetExamine('x', 'magnifier').ok).toBe(true);
  });
});

describe('exam tools (DESIGN 9.5 step 2)', () => {
  it('each tool reveals its clues; nothing changes', () => {
    const h = sickSim(100, 'spotty_fever');
    h.sim.goToVet('x');
    const before = JSON.stringify(h.sim.toState());
    expect(h.sim.vetExamine('x', 'thermometer')).toEqual({
      ok: true,
      clues: [{ icon: '🔥', text: 'Very hot!' }],
    });
    expect(JSON.stringify(h.sim.toState())).toBe(before);
  });

  it('needs a check-in first, and a real tool', () => {
    const h = sickSim(100);
    expect(h.sim.vetExamine('x', 'stethoscope')).toEqual({
      ok: false,
      reason: 'Check in at the vet first.',
    });
    h.sim.goToVet('x');
    expect(h.sim.vetExamine('x', 'hammer').ok).toBe(false);
  });
});

describe('treatments (DESIGN 9.5 steps 3-4)', () => {
  it('the wrong one costs 10 and does nothing; the right one cures', () => {
    const h = sickSim(100, 'sore_paw');
    const treated = vi.fn();
    const cured = vi.fn();
    h.sim.events.on('vetTreated', treated);
    h.sim.events.on('animalCured', cured);
    h.sim.goToVet('x');

    expect(h.sim.vetTreat('x', 'flea_bath')).toEqual({ ok: true, cured: false, cost: 10 });
    expect(h.sim.state.world.coins).toBe(100 - visitFee - treatmentCost);
    expect(h.sim.getAnimal('x')!.sickness?.illnessId).toBe('sore_paw');
    expect(cured).not.toHaveBeenCalled();

    expect(h.sim.vetTreat('x', 'bandage')).toEqual({ ok: true, cured: true, cost: 10 });
    expect(h.sim.state.world.coins).toBe(100 - visitFee - 2 * treatmentCost);
    const a = h.sim.getAnimal('x')!;
    expect(a.sickness).toBeUndefined();
    expect(cured).toHaveBeenCalledWith(expect.objectContaining({ illnessId: 'sore_paw' }));
    expect(treated).toHaveBeenCalledTimes(2);
    // Healthy and sellable again.
    expect(h.sim.canSell('x').ok).toBe(true);
  });

  it('a cure gives 30 minutes of immunity to that illness', () => {
    const h = sickSim(100);
    h.sim.goToVet('x');
    h.sim.vetTreat('x', 'medicine_drops');
    expect(h.sim.getAnimal('x')!.immunities.sniffles).toBe(
      h.sim.now() + BALANCE.sickness.immunityMinutes * MIN,
    );
  });

  it('refuses unknown treatments, check-in first, and healthy animals', () => {
    const h = sickSim(100);
    expect(h.sim.vetTreat('x', 'medicine_drops').ok).toBe(false);
    h.sim.goToVet('x');
    expect(h.sim.vetTreat('x', 'chocolate').ok).toBe(false);
    expect(h.sim.state.world.coins).toBe(100 - visitFee);
    h.sim.vetTreat('x', 'medicine_drops');
    expect(h.sim.vetTreat('x', 'medicine_drops')).toEqual({
      ok: false,
      reason: 'Healthy and happy! No vet needed.',
    });
  });

  it.each(ILLNESSES.map((i) => [i.id, i.treatmentId]))(
    '%s is cured by %s and nothing else',
    (illnessId, right) => {
      for (const t of TREATMENTS) {
        const h = sickSim(1000, illnessId);
        h.sim.goToVet('x');
        const result = h.sim.vetTreat('x', t.id);
        expect(result).toMatchObject({ ok: true, cured: t.id === right });
      }
    },
  );

  it('a player can diagnose every illness from the clues alone', () => {
    // A "detective" that only sees clues: it matches them against the illness data.
    const clueKey = (clues: readonly { text: string }[]) => clues.map((c) => c.text).join('|');
    for (const illness of ILLNESSES) {
      const h = sickSim(1000, illness.id);
      h.sim.goToVet('x');
      const seen = EXAM_TOOLS.map((tool) => {
        const r = h.sim.vetExamine('x', tool.id);
        if (!r.ok) throw new Error(r.reason);
        return clueKey(r.clues);
      }).join('#');
      const matches = ILLNESSES.filter(
        (i) => EXAM_TOOLS.map((tool) => clueKey(i.clues[tool.id] ?? [])).join('#') === seen,
      );
      expect(matches.map((m) => m.id)).toEqual([illness.id]);
      expect(h.sim.vetTreat('x', matches[0]!.treatmentId)).toMatchObject({ cured: true });
    }
  });
});

describe('Free Clinic (DESIGN 9.5 step 5)', () => {
  it('when you can’t afford the fee plus one treatment, the visit is free after a 3-min wait', () => {
    const h = sickSim(visitFee + treatmentCost - 1);
    const ready = vi.fn();
    h.sim.events.on('clinicReady', ready);
    expect(h.sim.vetQuote()).toEqual({ free: true, fee: 0 });
    expect(h.sim.goToVet('x')).toEqual({ ok: true });
    const a = h.sim.getAnimal('x')!;
    expect(a.sickness!.visit).toBe('free');
    expect(a.sickness!.atClinicUntil).toBe(h.sim.now() + freeClinicWaitMinutes * MIN);
    expect(h.sim.isWaitingAtClinic('x')).toBe(true);
    expect(h.sim.vetExamine('x', 'magnifier').ok).toBe(false);
    expect(h.sim.vetTreat('x', 'medicine_drops').ok).toBe(false);

    play(h, freeClinicWaitMinutes * MIN - SEC);
    expect(h.sim.isWaitingAtClinic('x')).toBe(true);
    play(h, SEC);
    expect(h.sim.isWaitingAtClinic('x')).toBe(false);
    expect(ready).toHaveBeenCalledTimes(1);

    const coins = h.sim.state.world.coins;
    expect(h.sim.treatmentCost('x')).toBe(0);
    expect(h.sim.vetTreat('x', 'bandage')).toEqual({ ok: true, cured: false, cost: 0 });
    expect(h.sim.vetTreat('x', 'medicine_drops')).toEqual({ ok: true, cured: true, cost: 0 });
    expect(h.sim.state.world.coins).toBe(coins);
  });

  it('exactly the fee plus one treatment pays normally', () => {
    const h = sickSim(visitFee + treatmentCost);
    h.sim.goToVet('x');
    expect(h.sim.getAnimal('x')!.sickness!.visit).toBe('paid');
    expect(h.sim.state.world.coins).toBe(treatmentCost);
  });

  it('on a paid visit, a treatment you can’t afford is free', () => {
    const h = sickSim(visitFee + treatmentCost, 'sleepy_sickness');
    h.sim.goToVet('x');
    expect(h.sim.vetTreat('x', 'cool_pack')).toEqual({ ok: true, cured: false, cost: 10 });
    expect(h.sim.state.world.coins).toBe(0);
    expect(h.sim.treatmentCost('x')).toBe(0);
    expect(h.sim.vetTreat('x', 'vitamin_treat')).toEqual({ ok: true, cured: true, cost: 0 });
  });

  it('the wait keeps running while the player is away', () => {
    const h = sickSim(0);
    h.sim.goToVet('x');
    h.clock.advance(HOUR);
    h.sim.catchUp();
    expect(h.sim.isWaitingAtClinic('x')).toBe(false);
    expect(h.sim.vetTreat('x', 'medicine_drops')).toMatchObject({ cured: true });
  });

  it('an animal waiting at the clinic does not spread germs', () => {
    const h = sickSim(0);
    h.sim = edit(h, (s) => s.world.animals.push(makeAnimal(s, { id: 'y' }))).sim;
    const before = h.sim.sickChance('y')!;
    h.sim.goToVet('x');
    expect(h.sim.sickChance('y')!).toBeCloseTo(before - BALANCE.sickness.contagionPerSickPerMinute);
  });
});

describe('the game can never get stuck with no money and sick animals', () => {
  /**
   * Plays a kid who knows nothing: every sick animal goes to the vet and gets treatments in
   * cabinet order until one works. Checks at every step that the next step is affordable.
   */
  function cureEveryone(h: ReturnType<typeof newSim>) {
    for (let guard = 0; guard < 10_000; guard++) {
      const sick = h.sim.state.world.animals.filter((a) => a.sickness);
      if (sick.length === 0) return;
      for (const a of sick) {
        const coins = h.sim.state.world.coins;
        if (!a.sickness!.visit) {
          const quote = h.sim.vetQuote();
          expect(quote.fee).toBeLessThanOrEqual(coins);
          expect(h.sim.goToVet(a.id).ok).toBe(true);
          continue;
        }
        if (h.sim.isWaitingAtClinic(a.id)) continue;
        expect(h.sim.treatmentCost(a.id)!).toBeLessThanOrEqual(coins);
        for (const t of TREATMENTS) {
          const r = h.sim.vetTreat(a.id, t.id);
          expect(r.ok).toBe(true);
          if (r.ok && r.cured) break;
        }
      }
      play(h, 10 * SEC);
    }
    throw new Error('Never finished curing');
  }

  it.each([0, 1, 5, 10, 19, 20, 25, 29, 30, 31, 45, 100])(
    'with %i coins and six sick animals, every animal is cured and sold',
    (coins) => {
      const h = edit(newSim(), (s) => {
        s.world.coins = coins;
        s.world.settings.sicknessEnabled = false; // Only the sickness we set up.
        ILLNESSES.forEach((illness, i) =>
          s.world.animals.push(
            makeAnimal(s, {
              id: `s${i}`,
              holdUntil: START,
              nextPoopAt: START + 99 * HOUR,
              sickness: { illnessId: illness.id, since: START },
            }),
          ),
        );
      });
      for (const a of h.sim.state.world.animals) expect(h.sim.canSell(a.id).ok).toBe(false);
      cureEveryone(h);
      for (const a of [...h.sim.state.world.animals]) expect(h.sim.sell(a.id).ok).toBe(true);
      expect(h.sim.state.world.animals).toHaveLength(0);
      expect(h.sim.state.world.coins).toBeGreaterThan(0);
    },
  );

  it('a long neglectful game at 0 coins always recovers', () => {
    const h = edit(newSim(3), (s) => {
      s.world.coins = 0;
      for (const p of s.world.placedItems) p.servings = 0;
      for (let i = 0; i < 6; i++) {
        s.world.animals.push(makeAnimal(s, { needs: { hunger: 0, happiness: 0 } }));
      }
    });
    play(h, 3 * HOUR, 30 * SEC);
    expect(h.sim.state.world.animals.some((a) => a.sickness)).toBe(true);
    cureEveryone(h);
    expect(h.sim.state.world.animals.some((a) => a.sickness)).toBe(false);
  });
});
