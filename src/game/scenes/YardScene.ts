import Phaser from 'phaser';
import { RARITY_STYLE, parseHex } from '../../art/palette';
import { appBus } from '../../bridge/appBus';
import type { GameSession } from '../../bridge/gameSession';
import { HOUSE_COLORS } from '../../config/houseColors';
import type { Vec2 } from '../../sim/types';
import { Effects } from '../fx/effects';
import { GATE_ENTRY, gateSlot, yardToWorld } from '../layout';
import { AnimalSprite } from '../sprites/AnimalSprite';
import { drawHouse, drawYard } from '../sprites/drawYard';
import { VisitorSprite } from '../sprites/VisitorSprite';

/**
 * The yard (DESIGN 17.1 World). Render only: every frame it reconciles sprites with sim state,
 * and uses sim events just for flourishes. Taps go to sim commands or the app bus.
 */
export class YardScene extends Phaser.Scene {
  private readonly animals = new Map<string, AnimalSprite>();
  private readonly visitors = new Map<string, VisitorSprite>();
  /** animalId -> where it should appear from (the gate, or its mother). */
  private readonly spawnFrom = new Map<string, { at: Vec2; kind: 'gate' | 'birth' }>();
  private readonly sold = new Map<string, number>();
  private readonly leftGate = new Set<string>();
  private selectedId: string | null = null;
  private house!: Phaser.GameObjects.Graphics;
  private houseColor = '';
  private fx!: Effects;
  private systemReducedMotion = false;

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
      appBus.on('selectAnimal', ({ id }) => this.select(id)),
    ];
    const unsubscribe = () => offs.forEach((off) => off());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.events.once(Phaser.Scenes.Events.DESTROY, unsubscribe);

    this.reconcile();
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

    // Visitors at the gate.
    const queued = new Set<string>();
    world.gateQueue.forEach((visitor, i) => {
      queued.add(visitor.id);
      const slot = gateSlot(i);
      let sprite = this.visitors.get(visitor.id);
      if (!sprite) {
        sprite = new VisitorSprite(this, visitor, slot, this.reducedMotion);
        sprite.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
          if (!sprite!.isRevealed) this.session.sim.revealVisitor(visitor.id);
        });
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

    // Animals.
    const present = new Set<string>();
    for (const animal of world.animals) {
      present.add(animal.id);
      const home = yardToWorld(animal.position);
      let sprite = this.animals.get(animal.id);
      if (!sprite) {
        const from = this.spawnFrom.get(animal.id);
        this.spawnFrom.delete(animal.id);
        sprite = new AnimalSprite(this, animal, from?.at ?? home, home, this.reducedMotion);
        const id = animal.id;
        sprite.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () =>
          appBus.emit('selectAnimal', { id }),
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

  private select(id: string | null): void {
    this.animals.get(this.selectedId ?? '')?.setSelected(false);
    this.selectedId = id;
    this.animals.get(id ?? '')?.setSelected(true);
  }
}
