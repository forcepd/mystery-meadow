import Phaser from 'phaser';
import { parseHex } from '../../art/palette';
import { displayName, variantOf } from '../../bridge/describe';
import { getIllness, type SymptomFx } from '../../config/illnesses';
import type { Badge } from '../../sim/GameSim';
import type { Animal, Vec2 } from '../../sim/types';
import { COLORS, FONT, TEXT_RESOLUTION } from '../constants';
import { drawCritter } from './critter';
import { drawOutfit } from './outfits';
import { showSymptom, type SymptomHandle } from './symptoms';
import type { TrickMove } from '../../config/tricks';

const BABY_SCALE = 0.65;
const WALK_SPEED = 110; // world px per second
const AMBLE_RADIUS = 30;
const MAX_WALK_MS = 2500;

/** Below this, a need shows as a thought bubble over the animal (render-only cue). */
const LOW_NEED = 25;

type Icon = Badge | 'hungry' | 'sad';
const ICONS: Partial<Record<Icon, string>> = {
  sick: '🤒', // Replaced by the illness's own symptom icon when known.
  hungry: '🍽️',
  sad: '😢',
  pregnant: '🍼',
  readyToSell: '🪙',
  kept: '❤️',
  new: '✨',
};
const ICON_ORDER: Icon[] = ['sick', 'hungry', 'sad', 'pregnant', 'readyToSell', 'kept', 'new'];

/**
 * One animal in the yard. Its sim position is its "home"; between sim moves it ambles
 * around home for life (render-only). Tap target is at least 96x120 world px.
 */
export class AnimalSprite extends Phaser.GameObjects.Container {
  readonly animalId: string;
  private readonly figure: Phaser.GameObjects.Container;
  private readonly breather: Phaser.GameObjects.Container;
  /** Body motion from symptoms (limp, shiver), separate from breathing and hopping. */
  private readonly pose: Phaser.GameObjects.Container;
  private readonly symptomLayer: Phaser.GameObjects.Container;
  /** Pet outfits (DESIGN 10.3): capes behind the animal, everything else in front. */
  private readonly outfitBack: Phaser.GameObjects.Graphics;
  private readonly outfitFront: Phaser.GameObjects.Graphics;
  private outfitKey = '';
  private symptom: { key: string; handle: SymptomHandle } | undefined;
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
  private dragging = false;
  private lastKey = '';

  constructor(
    scene: Phaser.Scene,
    animal: Animal,
    start: Vec2,
    home: Vec2,
    private readonly reducedMotion: () => boolean,
    /** False keeps it standing still (the patient on the vet's table). */
    private readonly amble = true,
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
    this.symptomLayer = scene.add.container(0, 0);
    this.outfitBack = scene.add.graphics();
    this.outfitFront = scene.add.graphics();
    this.breather = scene.add.container(0, 0, [
      this.outfitBack,
      this.art,
      this.outfitFront,
      this.symptomLayer,
    ]);
    this.pose = scene.add.container(0, 0, [this.breather]);
    this.figure = scene.add.container(0, 0, [this.pose]);
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
    const active = new Set<Icon>(badges);
    if (animal.needs.hunger < LOW_NEED) active.add('hungry');
    if (animal.needs.happiness < LOW_NEED) active.add('sad');
    const illness = animal.sickness && getIllness(animal.sickness.illnessId);
    const sickIcon = animal.sickness?.atClinicUntil !== undefined ? '🏥' : illness?.symptomIcon;
    const icons = ICON_ORDER.filter((i) => active.has(i))
      .slice(0, 2)
      .map((i) => (i === 'sick' && sickIcon) || ICONS[i])
      .join('');
    this.syncSymptom(illness?.symptomFx);
    const outfitKey = JSON.stringify(animal.outfit);
    if (outfitKey !== this.outfitKey) {
      this.outfitKey = outfitKey;
      drawOutfit(this.outfitBack, this.outfitFront, animal);
    }
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
      if (!this.dragging) this.walkTo(home);
    }
    if (!this.dragging) this.setDepth(this.y);
  }

  preUpdate(time: number): void {
    this.setDepth(this.dragging ? 10_000 : this.y);
    if (!this.amble || this.leaving || this.dragging) return;
    if (this.walkTween?.isPlaying() || this.reducedMotion()) return;
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
    // Long trips (e.g. to the food bowl) speed up so they never take more than a few seconds.
    const duration = Math.min(MAX_WALK_MS, Math.max(250, (dist / WALK_SPEED) * 1000));
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

  /** Starts or stops the illness look (only when it changes). */
  private syncSymptom(kind: SymptomFx | undefined): void {
    if (this.symptom?.key === kind) return;
    this.symptom?.handle.stop();
    this.symptom = undefined;
    if (!kind) return;
    const handle = showSymptom(kind, {
      scene: this.scene,
      layer: this.symptomLayer,
      pose: this.pose,
      reducedMotion: this.reducedMotion(),
    });
    this.symptom = { key: kind, handle };
  }

  override destroy(fromScene?: boolean): void {
    // A closing scene cleans up its own tweens and timers.
    if (!fromScene) this.symptom?.handle.stop();
    this.symptom = undefined;
    super.destroy(fromScene);
  }

  setSelected(selected: boolean): void {
    this.selectRing.setVisible(selected);
  }

  /** A trick (DESIGN 11): a little move, then back to normal. */
  perform(move: TrickMove): void {
    if (this.reducedMotion() || this.leaving) return;
    const s = this.scene;
    s.tweens.killTweensOf(this.pose);
    this.pose.setAngle(0).setScale(1).setPosition(0, 0);
    const done = () => this.pose.setAngle(0).setScale(1).setPosition(0, 0);
    switch (move) {
      case 'hop':
        s.tweens.add({
          targets: this.pose,
          y: -50,
          duration: 220,
          yoyo: true,
          repeat: 1,
          ease: 'Quad.easeOut',
          onComplete: done,
        });
        break;
      case 'spin':
        s.tweens.add({
          targets: this.pose,
          scaleX: -1,
          duration: 160,
          yoyo: true,
          repeat: 2,
          onComplete: done,
        });
        break;
      case 'wiggle':
        s.tweens.add({
          targets: this.pose,
          angle: { from: -15, to: 15 },
          duration: 140,
          yoyo: true,
          repeat: 3,
          onComplete: done,
        });
        break;
      case 'roll':
        s.tweens.add({
          targets: this.pose,
          angle: 360,
          duration: 700,
          ease: 'Sine.easeInOut',
          onComplete: done,
        });
        break;
      case 'bow':
        s.tweens.add({
          targets: this.pose,
          scaleY: 0.75,
          y: 8,
          duration: 260,
          yoyo: true,
          hold: 200,
          onComplete: done,
        });
        break;
    }
  }

  /** Picked up by the player's finger (drag-to-door). */
  startDrag(): void {
    this.dragging = true;
    this.walkTween?.stop();
    this.stopHopping();
    this.figure.setScale(this.baseScale * this.facing * 1.1, this.baseScale * 1.1);
  }

  dragTo(x: number, y: number): void {
    this.setPosition(x, y);
  }

  /** Put down: walks back home unless it's leaving through a door. */
  endDrag(goHome = true): void {
    this.dragging = false;
    this.figure.setScale(this.baseScale * this.facing, this.baseScale);
    if (goHome) this.walkTo(this.home);
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  /** Walks to a door and fades out (it's going to the other zone). Removes itself. */
  exitThrough(door: Vec2): void {
    this.leaving = true;
    this.disableInteractive();
    this.dragging = false;
    this.walkTo(door, () => {
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        duration: 350,
        onComplete: () => this.destroy(),
      });
    });
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
