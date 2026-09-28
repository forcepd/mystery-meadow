import Phaser from 'phaser';
import { parseHex } from '../../art/palette';
import { displayName, variantOf } from '../../bridge/describe';
import type { Badge } from '../../sim/GameSim';
import type { Animal, Vec2 } from '../../sim/types';
import { COLORS, FONT, TEXT_RESOLUTION } from '../constants';
import { drawCritter } from './critter';

const BABY_SCALE = 0.65;
const WALK_SPEED = 110; // world px per second
const AMBLE_RADIUS = 30;

const BADGE_ICONS: Partial<Record<Badge, string>> = {
  sick: '🤒',
  pregnant: '🍼',
  readyToSell: '🪙',
  kept: '❤️',
  new: '✨',
};
const BADGE_ORDER: Badge[] = ['sick', 'pregnant', 'readyToSell', 'kept', 'new'];

/**
 * One animal in the yard. Its sim position is its "home"; between sim moves it ambles
 * around home for life (render-only). Tap target is at least 96x120 world px.
 */
export class AnimalSprite extends Phaser.GameObjects.Container {
  readonly animalId: string;
  private readonly figure: Phaser.GameObjects.Container;
  private readonly breather: Phaser.GameObjects.Container;
  private readonly art: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly badge: Phaser.GameObjects.Text;
  private readonly selectRing: Phaser.GameObjects.Ellipse;
  private sparkles?: Phaser.GameObjects.Container;
  private home: Vec2;
  private baseScale = 1;
  private facing = 1;
  private walkTween: Phaser.Tweens.Tween | undefined;
  private hopTween: Phaser.Tweens.Tween | undefined;
  private nextAmbleAt = 0;
  private leaving = false;
  private lastKey = '';

  constructor(
    scene: Phaser.Scene,
    animal: Animal,
    start: Vec2,
    home: Vec2,
    private readonly reducedMotion: () => boolean,
  ) {
    super(scene, start.x, start.y);
    this.animalId = animal.id;
    this.home = home;

    this.selectRing = scene.add
      .ellipse(0, 22, 104, 36)
      .setStrokeStyle(5, COLORS.select)
      .setVisible(false);
    const shadow = scene.add.ellipse(0, 24, 76, 20, 0x000000, 0.12);
    this.art = scene.add.graphics();
    this.breather = scene.add.container(0, 0, [this.art]);
    this.figure = scene.add.container(0, 0, [this.breather]);
    this.label = scene.add
      .text(0, 36, '', {
        fontFamily: FONT,
        fontSize: '18px',
        fontStyle: '800',
        color: '#2f3a2c',
        backgroundColor: 'rgba(255,253,246,0.85)',
        padding: { x: 8, y: 2 },
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0.5, 0);
    this.badge = scene.add
      .text(0, -92, '', { fontSize: '28px', resolution: TEXT_RESOLUTION })
      .setOrigin(0.5);
    this.add([this.selectRing, shadow, this.figure, this.label, this.badge]);

    const variant = variantOf(animal);
    drawCritter(this.art, parseHex(variant?.placeholderColor ?? '#cccccc'));
    if (animal.isSparkle) this.addSparkles();

    this.setSize(96, 120);
    this.setInteractive({ useHandCursor: true });
    scene.add.existing(this);

    if (!reducedMotion()) {
      scene.tweens.add({
        targets: this.breather,
        scaleY: 1.05,
        duration: 1100 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    this.nextAmbleAt = scene.time.now + 1500 + Math.random() * 3000;
  }

  /** Updates looks from sim state. Cheap to call every frame. */
  sync(animal: Animal, badges: readonly Badge[], home: Vec2): void {
    if (this.leaving) return;
    const baby = badges.includes('baby');
    const icons = BADGE_ORDER.filter((b) => badges.includes(b))
      .slice(0, 2)
      .map((b) => BADGE_ICONS[b])
      .join('');
    const key = `${displayName(animal)}|${icons}|${baby}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.label.setText(displayName(animal));
      this.badge.setText(icons);
      this.baseScale = baby ? BABY_SCALE : 1;
      this.figure.setScale(this.baseScale * this.facing, this.baseScale);
      this.badge.setY(baby ? -70 : -92);
    }
    if (home.x !== this.home.x || home.y !== this.home.y) {
      this.home = home;
      this.walkTo(home);
    }
    this.setDepth(this.y);
  }

  preUpdate(time: number): void {
    this.setDepth(this.y);
    if (this.leaving || this.walkTween?.isPlaying() || this.reducedMotion()) return;
    if (time < this.nextAmbleAt) return;
    this.nextAmbleAt = time + 2500 + Math.random() * 4000;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * AMBLE_RADIUS;
    this.walkTo({
      x: this.home.x + Math.cos(angle) * r,
      y: this.home.y + Math.sin(angle) * r * 0.6,
    });
  }

  walkTo(target: Vec2, onDone?: () => void): void {
    this.walkTween?.stop();
    const dx = target.x - this.x;
    const dist = Math.hypot(dx, target.y - this.y);
    if (Math.abs(dx) > 4) this.face(dx > 0 ? 1 : -1);
    if (this.reducedMotion()) {
      this.setPosition(target.x, target.y);
      onDone?.();
      return;
    }
    const duration = Math.max(250, (dist / WALK_SPEED) * 1000);
    this.startHopping();
    this.walkTween = this.scene.tweens.add({
      targets: this,
      x: target.x,
      y: target.y,
      duration,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.stopHopping();
        onDone?.();
      },
    });
  }

  setSelected(selected: boolean): void {
    this.selectRing.setVisible(selected);
  }

  /** Happy wave goodbye after a sale, then removes itself. */
  goodbye(): void {
    this.leaving = true;
    this.disableInteractive();
    this.walkTween?.stop();
    this.stopHopping();
    this.scene.tweens.add({
      targets: this,
      y: this.y - (this.reducedMotion() ? 0 : 60),
      alpha: 0,
      duration: 900,
      ease: 'Sine.easeIn',
      onComplete: () => this.destroy(),
    });
  }

  /** Pops in (newborns). */
  popIn(): void {
    if (this.reducedMotion()) return;
    this.figure.setScale(0.01);
    this.scene.tweens.add({
      targets: this.figure,
      scaleX: this.baseScale * this.facing,
      scaleY: this.baseScale,
      duration: 450,
      ease: 'Back.easeOut',
    });
  }

  private face(dir: 1 | -1): void {
    if (dir === this.facing) return;
    this.facing = dir;
    this.figure.setScale(this.baseScale * dir, this.baseScale);
  }

  private startHopping(): void {
    if (this.hopTween?.isPlaying()) return;
    this.hopTween = this.scene.tweens.add({
      targets: this.breather,
      y: -10,
      duration: 160,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeOut',
    });
  }

  private stopHopping(): void {
    this.hopTween?.stop();
    this.hopTween = undefined;
    this.breather.setY(0);
  }

  private addSparkles(): void {
    const stars = [0, 1, 2, 3].map((i) => {
      const a = (i / 4) * Math.PI * 2;
      return this.scene.add
        .text(Math.cos(a) * 52, Math.sin(a) * 40 - 16, '✦', {
          fontSize: '20px',
          color: ['#ffd84d', '#ff8fd0', '#8fd6ff', '#b69bff'][i] ?? '#ffd84d',
          resolution: TEXT_RESOLUTION,
        })
        .setOrigin(0.5);
    });
    this.sparkles = this.scene.add.container(0, 0, stars);
    this.addAt(this.sparkles, 2);
    if (!this.reducedMotion()) {
      this.scene.tweens.add({
        targets: stars,
        alpha: { from: 1, to: 0.25 },
        scale: { from: 1.2, to: 0.7 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        delay: (_t: unknown, _k: unknown, _v: unknown, i: number) => i * 175,
      });
    }
  }
}
