import Phaser from 'phaser';
import { RARITY_STYLE, parseHex } from '../../art/palette';
import { appBus } from '../../bridge/appBus';
import type { GameSession } from '../../bridge/gameSession';
import { HOUSE_COLORS } from '../../config/houseColors';
import type { Vec2 } from '../../sim/types';
import { Effects } from '../fx/effects';
import { GATE_ENTRY, gateSlot, tileToWorld, yardToWorld } from '../layout';
import { AnimalSprite } from '../sprites/AnimalSprite';
import { BowlSprite } from '../sprites/BowlSprite';
import { drawHouse, drawYard } from '../sprites/drawYard';
import { PoopSprite } from '../sprites/PoopSprite';
import { VisitorSprite } from '../sprites/VisitorSprite';

/** Press this long on an animal to pet it (DESIGN 8.4); a shorter tap opens its card. */
const HOLD_MS = 450;
/** A press that drifts this far (world px) is not a tap or a hold. */
const PRESS_SLOP = 28;

interface Press {
  animalId: string;
  start: Vec2;
  timer: Phaser.Time.TimerEvent;
  held: boolean;
  /** Real time the press began (the game-loop timer lags when frames are slow). */
  startedAt: number;
}

/**
 * The yard (DESIGN 17.1 World). Render only: every frame it reconciles sprites with sim state,
 * and uses sim events just for flourishes. Taps go to sim commands or the app bus.
 */
export class YardScene extends Phaser.Scene {
  private readonly animals = new Map<string, AnimalSprite>();
  private readonly visitors = new Map<string, VisitorSprite>();
  private readonly bowls = new Map<string, BowlSprite>();
  private readonly poops = new Map<string, PoopSprite>();
  /** animalId -> where it should appear from (the gate, or its mother). */
  private readonly spawnFrom = new Map<string, { at: Vec2; kind: 'gate' | 'birth' }>();
  private readonly sold = new Map<string, number>();
  private readonly leftGate = new Set<string>();
  private selectedId: string | null = null;
  private press: Press | null = null;
  private house!: Phaser.GameObjects.Graphics;
  private houseColor = '';
  private fx!: Effects;
  private systemReducedMotion = false;
  private initialized = false;

  constructor(private readonly session: GameSession) {
    super('Yard');
  }

  create(): void {
    this.systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.fx = new Effects(this, this.reducedMotion);
    drawYard(this);
    this.house = this.add.graphics().setDepth(0);

    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        appBus.emit('canvasTap', { x: pointer.worldX, y: pointer.worldY });
        if (over.length === 0) {
          this.fx.ripple(pointer.worldX, pointer.worldY);
          appBus.emit('selectAnimal', { id: null });
        }
      },
    );
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!this.press) return;
      const moved = Math.hypot(
        pointer.worldX - this.press.start.x,
        pointer.worldY - this.press.start.y,
      );
      if (moved > PRESS_SLOP) this.endPress(false);
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, () => this.endPress(true));
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => this.endPress(false));

    const { events } = this.session.sim;
    const offs = [
      events.on('visitorEntered', ({ visitorId, animal }) => {
        const from = this.visitors.get(visitorId);
        this.spawnFrom.set(animal.id, {
          at: from ? { x: from.x, y: from.y } : GATE_ENTRY,
          kind: 'gate',
        });
      }),
      events.on('visitorLeft', ({ visitor }) => this.leftGate.add(visitor.id)),
      events.on('visitorRevealed', ({ visitor }) => {
        const sprite = this.visitors.get(visitor.id);
        if (!sprite) return;
        const color = RARITY_STYLE[visitor.roll.rarity].hex;
        this.fx.burst(sprite.x, sprite.y - 30, [color, 0xffd84d, 0xffffff], 12);
      }),
      events.on('animalBorn', ({ mother, babies }) => {
        const mom = this.animals.get(mother.id);
        const at = mom ? { x: mom.x, y: mom.y } : yardToWorld(mother.position);
        for (const baby of babies) this.spawnFrom.set(baby.id, { at, kind: 'birth' });
        this.fx.hearts(at.x, at.y - 70, 5);
        this.fx.burst(at.x, at.y - 20, [0xffd84d, 0xff9fc4, 0xffffff]);
      }),
      events.on('animalSold', ({ animal, price }) => this.sold.set(animal.id, price)),
      events.on('animalPetted', ({ animal }) => {
        const s = this.animals.get(animal.id);
        if (s) this.fx.hearts(s.x, s.y - 80, 4);
      }),
      events.on('treatGiven', ({ animal }) => {
        const s = this.animals.get(animal.id);
        if (!s) return;
        this.fx.floatText(s.x, s.y - 90, '🍪', '#c98a00', 36);
        this.fx.hearts(s.x, s.y - 70, 3);
      }),
      events.on('animalAte', ({ bowlId }) => {
        const b = this.bowls.get(bowlId);
        if (b) this.fx.floatText(b.x, b.y - 40, 'nom!', '#8b5a33', 24);
      }),
      events.on('bowlRefilled', ({ bowlId }) => {
        const b = this.bowls.get(bowlId);
        if (b) this.fx.burst(b.x, b.y - 10, [0xe0a868, 0xffd84d, 0xffffff], 8);
      }),
      appBus.on('selectAnimal', ({ id }) => this.select(id)),
    ];
    const unsubscribe = () => offs.forEach((off) => off());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.events.once(Phaser.Scenes.Events.DESTROY, unsubscribe);

    this.reconcile();
    this.initialized = true;
    appBus.emit('worldReady', undefined);
  }

  override update(): void {
    this.reconcile();
  }

  private readonly reducedMotion = (): boolean =>
    this.systemReducedMotion || this.session.sim.state.world.settings.reducedMotion;

  private reconcile(): void {
    const { sim } = this.session;
    const world = sim.state.world;

    if (world.house.exteriorColor !== this.houseColor) {
      this.houseColor = world.house.exteriorColor;
      const def = HOUSE_COLORS.find((c) => c.id === this.houseColor) ?? HOUSE_COLORS[0]!;
      drawHouse(this.house, parseHex(def.color));
    }

    this.reconcileBowls();
    this.reconcilePoops();
    this.reconcileVisitors();
    this.reconcileAnimals();
  }

  private reconcileBowls(): void {
    const seen = new Set<string>();
    for (const bowl of this.session.sim.bowls()) {
      if (bowl.zone !== 'yard') continue;
      seen.add(bowl.id);
      let sprite = this.bowls.get(bowl.id);
      if (!sprite) {
        sprite = new BowlSprite(this, bowl, tileToWorld(bowl.tile), this.reducedMotion);
        const s = sprite;
        s.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
          const result = this.session.sim.refillBowl(bowl.id);
          if (!result.ok) this.fx.floatText(s.x, s.y - 50, 'Full!', '#3f7fbf', 24);
        });
        this.bowls.set(bowl.id, sprite);
      }
      sprite.sync(bowl);
    }
    for (const [id, sprite] of this.bowls) {
      if (seen.has(id)) continue;
      this.bowls.delete(id);
      sprite.destroy();
    }
  }

  private reconcilePoops(): void {
    const seen = new Set<string>();
    for (const poop of this.session.sim.state.world.poops) {
      if (poop.zone !== 'yard') continue;
      seen.add(poop.id);
      if (this.poops.has(poop.id)) continue;
      const sprite = new PoopSprite(this, poop, yardToWorld(poop.position), this.initialized);
      sprite.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () =>
        this.session.sim.cleanPoop(poop.id),
      );
      this.poops.set(poop.id, sprite);
    }
    for (const [id, sprite] of this.poops) {
      if (seen.has(id)) continue;
      this.poops.delete(id);
      this.fx.burst(sprite.x, sprite.y - 10, [0xffffff, 0x9fe7ff, 0xffe066], 8);
      sprite.clean();
    }
  }

  private reconcileVisitors(): void {
    const queued = new Set<string>();
    this.session.sim.state.world.gateQueue.forEach((visitor, i) => {
      queued.add(visitor.id);
      const slot = gateSlot(i);
      let sprite = this.visitors.get(visitor.id);
      if (!sprite) {
        const s = new VisitorSprite(this, visitor, slot, this.reducedMotion);
        s.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
          if (!s.isRevealed) this.session.sim.revealVisitor(visitor.id);
        });
        sprite = s;
        this.visitors.set(visitor.id, sprite);
      }
      sprite.sync(visitor, slot);
    });
    for (const [id, sprite] of this.visitors) {
      if (queued.has(id)) continue;
      this.visitors.delete(id);
      if (this.leftGate.delete(id)) sprite.leave();
      else sprite.destroy(); // Walked in: the animal sprite takes over from here.
    }
  }

  private reconcileAnimals(): void {
    const { sim } = this.session;
    const present = new Set<string>();
    for (const animal of sim.state.world.animals) {
      if (animal.zone !== 'yard') continue;
      present.add(animal.id);
      const home = yardToWorld(animal.position);
      let sprite = this.animals.get(animal.id);
      if (!sprite) {
        const from = this.spawnFrom.get(animal.id);
        this.spawnFrom.delete(animal.id);
        sprite = new AnimalSprite(this, animal, from?.at ?? home, home, this.reducedMotion);
        const s = sprite;
        const id = animal.id;
        s.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (pointer: Phaser.Input.Pointer) =>
          this.startPress(id, pointer),
        );
        this.animals.set(animal.id, sprite);
        // Apply looks (e.g. baby size) before any spawn animation, which tweens toward them.
        sprite.sync(animal, sim.badges(animal.id), home);
        if (from?.kind === 'gate') sprite.walkTo(home);
        else if (from?.kind === 'birth') {
          sprite.popIn();
          sprite.walkTo(home);
        }
        sprite.setSelected(animal.id === this.selectedId);
      }
      sprite.sync(animal, sim.badges(animal.id), home);
    }
    for (const [id, sprite] of this.animals) {
      if (present.has(id)) continue;
      this.animals.delete(id);
      const price = this.sold.get(id);
      this.sold.delete(id);
      if (price === undefined) {
        sprite.destroy();
        continue;
      }
      this.fx.floatText(sprite.x, sprite.y - 90, `+${price} 🪙`, '#c98a00', 34);
      this.fx.hearts(sprite.x, sprite.y - 60, 3);
      sprite.goodbye();
    }
  }

  /** Pointer went down on an animal: a hold pets it, a quick tap (on release) opens its card. */
  private startPress(animalId: string, pointer: Phaser.Input.Pointer): void {
    this.endPress(false);
    const press: Press = {
      animalId,
      start: { x: pointer.worldX, y: pointer.worldY },
      held: false,
      startedAt: performance.now(),
      timer: this.time.delayedCall(HOLD_MS, () => {
        press.held = true;
        this.petAnimal(animalId);
      }),
    };
    this.press = press;
  }

  private endPress(released: boolean): void {
    const press = this.press;
    if (!press) return;
    this.press = null;
    press.timer.remove(false);
    if (!released || press.held) return;
    // Held long enough but the timer didn't get to fire (slow frames): still a pet, not a tap.
    if (performance.now() - press.startedAt >= HOLD_MS) this.petAnimal(press.animalId);
    else appBus.emit('selectAnimal', { id: press.animalId });
  }

  private petAnimal(animalId: string): void {
    const result = this.session.sim.pet(animalId);
    if (result.ok) return; // The animalPetted event draws the hearts.
    const s = this.animals.get(animalId);
    if (s) this.fx.floatText(s.x, s.y - 90, '💕 Loved that!', '#e0628b', 22);
  }

  private select(id: string | null): void {
    this.animals.get(this.selectedId ?? '')?.setSelected(false);
    this.selectedId = id;
    this.animals.get(id ?? '')?.setSelected(true);
  }
}
