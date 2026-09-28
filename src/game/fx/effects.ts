import type Phaser from 'phaser';
import { FONT, TEXT_RESOLUTION } from '../constants';

/** Short-lived celebration effects. All respect reduced motion (they fade in place). */
export class Effects {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly reducedMotion: () => boolean,
  ) {}

  /** Stars bursting outward (reveal, birth). */
  burst(x: number, y: number, colors: readonly number[], count = 10): void {
    const still = this.reducedMotion();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const color = colors[i % colors.length] ?? 0xffffff;
      const star = this.scene.add.star(x, y, 5, 5, 11, color).setDepth(10_000);
      const dist = still ? 0 : 60 + (i % 3) * 18;
      this.scene.tweens.add({
        targets: star,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: still ? 1 : 0.4,
        duration: 650,
        ease: 'Cubic.easeOut',
        onComplete: () => star.destroy(),
      });
    }
  }

  /** Hearts floating up (births, and petting in Phase 3). */
  hearts(x: number, y: number, count = 4): void {
    for (let i = 0; i < count; i++) {
      this.floatText(x + (i - (count - 1) / 2) * 22, y - i * 6, '♥', '#ff6f9a', 34, i * 90);
    }
  }

  /** Text that rises and fades (e.g. "+45" coins). */
  floatText(x: number, y: number, text: string, color: string, size = 30, delay = 0): void {
    const label = this.scene.add
      .text(x, y, text, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        fontStyle: '800',
        color,
        stroke: '#ffffff',
        strokeThickness: 6,
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0.5)
      .setDepth(10_001)
      .setAlpha(0);
    this.scene.tweens.add({
      targets: label,
      alpha: { from: 1, to: 0 },
      y: y - (this.reducedMotion() ? 0 : 90),
      delay,
      duration: 1100,
      ease: 'Sine.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  ripple(x: number, y: number): void {
    const ring = this.scene.add.circle(x, y, 22).setStrokeStyle(5, 0xffffff).setDepth(9_999);
    this.scene.tweens.add({
      targets: ring,
      scale: this.reducedMotion() ? 1 : 2.2,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }
}
