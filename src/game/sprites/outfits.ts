import type Phaser from 'phaser';
import { parseHex } from '../../art/palette';
import { getItem, type OutfitSlot, type PetOutfitItemDef } from '../../config/items';
import { outfitAnchors } from '../../config/species';
import type { Animal } from '../../sim/types';
import { COLORS } from '../constants';

/**
 * Pet outfit placeholder art (DESIGN 10.3), drawn at each species' outfit anchors so every
 * species can wear everything. `back` is behind the animal (capes), `front` on top.
 */
export function drawOutfit(
  back: Phaser.GameObjects.Graphics,
  front: Phaser.GameObjects.Graphics,
  animal: Pick<Animal, 'speciesId' | 'outfit'>,
): void {
  back.clear();
  front.clear();
  const anchors = outfitAnchors(animal.speciesId);
  for (const slot of ['body', 'face', 'head'] as OutfitSlot[]) {
    const id = animal.outfit[slot];
    const def = id ? getItem(id) : undefined;
    if (def?.category !== 'petOutfit') continue;
    const at = anchors[slot];
    draw(def, def.kind === 'cape' ? back : front, at.x, at.y, anchors.scale);
  }
}

function draw(
  def: PetOutfitItemDef,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
) {
  const c = parseHex(def.color);
  const c2 = parseHex(def.color2 ?? '#ffffff');
  g.lineStyle(3, COLORS.outline, 1);
  switch (def.kind) {
    // Head.
    case 'party':
      g.fillStyle(c, 1).fillTriangle(x - 14 * s, y + 6 * s, x, y - 30 * s, x + 14 * s, y + 6 * s);
      g.strokeTriangle(x - 14 * s, y + 6 * s, x, y - 30 * s, x + 14 * s, y + 6 * s);
      g.fillStyle(c2, 1)
        .fillCircle(x, y - 30 * s, 5 * s)
        .fillRect(x - 10 * s, y - 6 * s, 20 * s, 4 * s);
      break;
    case 'bow':
      g.fillStyle(c, 1);
      g.fillTriangle(x, y, x - 18 * s, y - 10 * s, x - 18 * s, y + 10 * s).strokeTriangle(
        x,
        y,
        x - 18 * s,
        y - 10 * s,
        x - 18 * s,
        y + 10 * s,
      );
      g.fillTriangle(x, y, x + 18 * s, y - 10 * s, x + 18 * s, y + 10 * s).strokeTriangle(
        x,
        y,
        x + 18 * s,
        y - 10 * s,
        x + 18 * s,
        y + 10 * s,
      );
      g.fillCircle(x, y, 5 * s).strokeCircle(x, y, 5 * s);
      break;
    case 'flower':
      g.fillStyle(c2, 1);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.fillCircle(x + 12 * s + Math.cos(a) * 7 * s, y + 2 * s + Math.sin(a) * 7 * s, 5 * s);
      }
      g.fillStyle(c, 1).fillCircle(x + 12 * s, y + 2 * s, 5 * s);
      break;
    case 'crown':
      g.fillStyle(c, 1);
      g.beginPath();
      g.moveTo(x - 16 * s, y + 4 * s);
      for (const [dx, dy] of [
        [-16, -12],
        [-8, -2],
        [0, -16],
        [8, -2],
        [16, -12],
        [16, 4],
      ] as const) {
        g.lineTo(x + dx * s, y + dy * s);
      }
      g.closePath().fillPath().strokePath();
      break;
    // Body.
    case 'sweater':
      g.fillStyle(c, 1)
        .fillEllipse(x, y, 66 * s, 38 * s)
        .strokeEllipse(x, y, 66 * s, 38 * s);
      g.fillStyle(c2, 1)
        .fillRect(x - 30 * s, y - 4 * s, 60 * s, 5 * s)
        .fillRect(x - 26 * s, y + 8 * s, 52 * s, 4 * s);
      break;
    case 'cape':
      g.fillStyle(c, 1);
      g.fillTriangle(x - 30 * s, y - 20 * s, x + 30 * s, y - 20 * s, x + 44 * s, y + 26 * s);
      g.fillTriangle(x - 30 * s, y - 20 * s, x - 44 * s, y + 26 * s, x + 44 * s, y + 26 * s);
      g.fillStyle(c2, 1).fillCircle(x, y - 18 * s, 5 * s);
      break;
    case 'tutu':
      g.fillStyle(c, 0.95)
        .fillEllipse(x, y + 8 * s, 90 * s, 20 * s)
        .strokeEllipse(x, y + 8 * s, 90 * s, 20 * s);
      break;
    case 'scarf':
      g.fillStyle(c, 1).fillRoundedRect(x - 26 * s, y - 20 * s, 52 * s, 10 * s, 5 * s);
      g.fillRect(x + 12 * s, y - 14 * s, 10 * s, 22 * s);
      g.fillStyle(c2, 1).fillRect(x + 12 * s, y + 2 * s, 10 * s, 3 * s);
      break;
    // Face.
    case 'glasses':
      g.lineStyle(3, c, 1)
        .strokeCircle(x - 9 * s, y, 7 * s)
        .strokeCircle(x + 9 * s, y, 7 * s);
      g.lineBetween(x - 2 * s, y, x + 2 * s, y);
      break;
    case 'bandana':
      g.fillStyle(c, 1).fillTriangle(x - 20 * s, y + 12 * s, x + 20 * s, y + 12 * s, x, y + 30 * s);
      g.fillStyle(c2, 1)
        .fillCircle(x - 6 * s, y + 16 * s, 2 * s)
        .fillCircle(x + 5 * s, y + 20 * s, 2 * s);
      break;
    case 'star':
      g.fillStyle(c, 1);
      for (const dx of [-9, 9]) {
        const cx = x + dx * s;
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = (i % 2 ? 4 : 9) * s;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          if (i === 0) g.moveTo(cx + Math.cos(a) * r, y + Math.sin(a) * r);
          else g.lineTo(cx + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        g.closePath().fillPath();
      }
      break;
  }
}
