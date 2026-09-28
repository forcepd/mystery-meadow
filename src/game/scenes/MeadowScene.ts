import Phaser from 'phaser';
import { appBus } from '../../bridge/appBus';
import { COLORS, WORLD_HEIGHT, WORLD_WIDTH } from '../constants';

/** Phase 0 placeholder world: proves canvas input and UI -> world messaging. */
export class MeadowScene extends Phaser.Scene {
  private reducedMotion = false;

  constructor() {
    super('Meadow');
  }

  create(): void {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.add.rectangle(0, 0, WORLD_WIDTH, WORLD_HEIGHT, COLORS.grass).setOrigin(0);
    const tufts = this.add.graphics({ fillStyle: { color: COLORS.grassDark, alpha: 0.35 } });
    for (let x = 60; x < WORLD_WIDTH; x += 160) {
      for (let y = 80; y < WORLD_HEIGHT; y += 140) {
        tufts.fillEllipse(x + ((y / 140) % 2) * 80, y, 36, 14);
      }
    }

    this.add
      .text(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 'Tap the meadow!', {
        fontFamily: 'Nunito, system-ui, sans-serif',
        fontSize: '40px',
        fontStyle: '800',
        color: '#2f3a2c',
      })
      .setOrigin(0.5)
      .setAlpha(0.6);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.ripple(pointer.worldX, pointer.worldY);
      appBus.emit('canvasTap', { x: pointer.worldX, y: pointer.worldY });
    });

    const offPing = appBus.on('uiPing', () => this.heart());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offPing);
    this.events.once(Phaser.Scenes.Events.DESTROY, offPing);
  }

  private ripple(x: number, y: number): void {
    const ring = this.add.circle(x, y, 24).setStrokeStyle(6, COLORS.ripple);
    this.tweens.add({
      targets: ring,
      scale: this.reducedMotion ? 1 : 2.5,
      alpha: 0,
      duration: 450,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private heart(): void {
    const heart = this.add
      .text(WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 80, '♥', { fontSize: '96px', color: '#ff8fb1' })
      .setOrigin(0.5);
    this.tweens.add({
      targets: heart,
      y: heart.y - (this.reducedMotion ? 0 : 120),
      alpha: 0,
      duration: 800,
      ease: 'Sine.easeOut',
      onComplete: () => heart.destroy(),
    });
  }
}
