import Phaser from 'phaser';
import { RARITY_STYLE, parseHex } from '../../art/palette';
import { appBus } from '../../bridge/appBus';
import type { GameSession } from '../../bridge/gameSession';
import { HOUSE_COLORS } from '../../config/houseColors';
import { GATE_ENTRY, HOUSE_DOOR, gateSlot } from '../layout';
import { drawHouse, drawYard } from '../sprites/drawYard';
import { VisitorSprite } from '../sprites/VisitorSprite';
import { ZoneScene } from './ZoneScene';

/**
 * The yard (DESIGN 17.1 World): the shared zone behavior plus mystery visitors at the gate and
 * the house exterior (its door is where animals go inside).
 */
export class YardScene extends ZoneScene {
  protected readonly zone = 'yard';
  private readonly visitors = new Map<string, VisitorSprite>();
  private readonly leftGate = new Set<string>();
  private house!: Phaser.GameObjects.Graphics;
  private houseColor = '';

  constructor(session: GameSession) {
    super('Yard', session);
  }

  override create(): void {
    super.create();
    const { events } = this.session.sim;
    const offs = [
      events.on('visitorEntered', ({ visitorId, animal }) => {
        const from = this.visitors.get(visitorId);
        this.spawnFrom.set(animal.id, {
          at: from ? { x: from.x, y: from.y } : GATE_ENTRY,
          kind: 'walk',
        });
      }),
      events.on('visitorLeft', ({ visitor }) => this.leftGate.add(visitor.id)),
      events.on('visitorRevealed', ({ visitor }) => {
        const sprite = this.visitors.get(visitor.id);
        if (!sprite) return;
        const color = RARITY_STYLE[visitor.roll.rarity].hex;
        this.fx.burst(sprite.x, sprite.y - 30, [color, 0xffd84d, 0xffffff], 12);
      }),
      // Back from Storage: pops out of the house door.
      events.on('petRetrieved', ({ animal }) =>
        this.spawnFrom.set(animal.id, { at: HOUSE_DOOR, kind: 'pop' }),
      ),
    ];
    const unsubscribe = () => offs.forEach((off) => off());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.events.once(Phaser.Scenes.Events.DESTROY, unsubscribe);
    appBus.emit('sceneChanged', { scene: 'yard' });
    appBus.emit('worldReady', undefined);
  }

  protected drawBackground(): void {
    drawYard(this);
    this.house = this.add.graphics().setDepth(0);
  }

  protected reconcileExtra(): void {
    const world = this.session.sim.state.world;
    if (world.house.exteriorColor !== this.houseColor) {
      this.houseColor = world.house.exteriorColor;
      const def = HOUSE_COLORS.find((c) => c.id === this.houseColor) ?? HOUSE_COLORS[0]!;
      drawHouse(this.house, parseHex(def.color));
    }
    this.reconcileVisitors();
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
}
