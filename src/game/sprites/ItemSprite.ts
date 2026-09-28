import Phaser from 'phaser';
import { parseHex } from '../../art/palette';
import { layerOf, type PlaceableItemDef } from '../../config/items';
import type { PlacedItem } from '../../sim/types';
import { COLORS, TEXT_RESOLUTION } from '../constants';
import type { Rect } from '../layout';

/** Depth bands: rugs lie under everything, wall art hangs behind the room. */
const RUG_DEPTH = -500;
const WALL_DEPTH = -600;

/**
 * A placed item (placeholder art: its footprint as a soft shape plus its icon; Phase 10 swaps
 * in real art). Positioned by its footprint rectangle; floor items depth-sort by their bottom.
 */
export class ItemSprite extends Phaser.GameObjects.Container {
  readonly placedId: string;
  private readonly art: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Text;
  private key = '';

  constructor(
    scene: Phaser.Scene,
    item: PlacedItem,
    private readonly def: PlaceableItemDef,
    rect: Rect,
  ) {
    super(scene, 0, 0);
    this.placedId = item.id;
    this.art = scene.add.graphics();
    this.icon = scene.add
      .text(0, 0, def.icon, { fontSize: '34px', resolution: TEXT_RESOLUTION })
      .setOrigin(0.5);
    this.add([this.art, this.icon]);
    scene.add.existing(this);
    this.sync(item, rect);
  }

  sync(item: PlacedItem, rect: Rect): void {
    const key = `${rect.x},${rect.y},${rect.w},${rect.h},${item.rotation}`;
    if (key === this.key) return;
    this.key = key;
    this.setPosition(rect.x + rect.w / 2, rect.y + rect.h / 2);
    this.setSize(rect.w, rect.h);
    this.draw(rect.w, rect.h, item.rotation);
    const layer = layerOf(this.def);
    this.setDepth(layer === 'rug' ? RUG_DEPTH : layer === 'wall' ? WALL_DEPTH : rect.y + rect.h);
    // Hit area = the footprint (re-set because the size can change on rotation).
    this.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, rect.w, rect.h),
      Phaser.Geom.Rectangle.Contains,
    );
  }

  private draw(w: number, h: number, rotation: number): void {
    const g = this.art.clear();
    const color = parseHex(this.def.color);
    const pad = 6;
    const x = -w / 2 + pad;
    const y = -h / 2 + pad;
    const iw = w - pad * 2;
    const ih = h - pad * 2;
    const layer = layerOf(this.def);
    this.icon.setFontSize(Math.max(22, Math.min(46, Math.min(w, h) * 0.55)));

    if (layer === 'rug') {
      g.fillStyle(color, 0.85).fillEllipse(0, 0, iw, ih);
      g.lineStyle(4, 0xffffff, 0.7).strokeEllipse(0, 0, iw - 16, ih - 12);
      this.icon.setAlpha(0.5);
      return;
    }
    if (layer === 'wall') {
      g.fillStyle(0x8b5e3c, 1).fillRoundedRect(x, y + 10, iw, ih - 20, 8);
      g.fillStyle(color, 1).fillRoundedRect(x + 7, y + 17, iw - 14, ih - 34, 5);
      return;
    }
    // Floor items: a soft shadow, then the body.
    g.fillStyle(0x000000, 0.12).fillEllipse(0, ih / 2 - 2, iw * 0.9, 18);
    g.fillStyle(color, 1).lineStyle(4, COLORS.outline, 1);
    if (this.def.category === 'bed') {
      g.fillRoundedRect(x, y + ih * 0.2, iw, ih * 0.8, 18).strokeRoundedRect(
        x,
        y + ih * 0.2,
        iw,
        ih * 0.8,
        18,
      );
      g.fillStyle(0xffffff, 0.9).fillEllipse(0, y + ih * 0.42, iw * 0.55, ih * 0.3);
      this.icon.setVisible(false);
      return;
    }
    g.fillRoundedRect(x, y, iw, ih, 16).strokeRoundedRect(x, y, iw, ih, 16);
    // A little mark on the "front" so rotation is visible.
    const mark = {
      0: [0, ih / 2 - 8],
      90: [-iw / 2 + 8, 0],
      180: [0, -ih / 2 + 8],
      270: [iw / 2 - 8, 0],
    }[rotation as 0 | 90 | 180 | 270];
    g.fillStyle(0xffffff, 0.8).fillCircle(mark[0]!, mark[1]!, 5);
  }
}
