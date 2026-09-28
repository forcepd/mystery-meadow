import type Phaser from 'phaser';
import { COLORS } from '../constants';

/**
 * Placeholder animal drawing (simple shapes; Phase 10 replaces it with parametric SVG art).
 * Drawn around (0, 0) with the feet near y = +20. `silhouette` draws a mystery shape.
 */
export function drawCritter(
  g: Phaser.GameObjects.Graphics,
  color: number,
  silhouette = false,
): void {
  g.clear();
  const outline = silhouette ? COLORS.silhouette : COLORS.outline;
  const fill = silhouette ? COLORS.silhouette : color;
  g.lineStyle(4, outline, 1);
  g.fillStyle(fill, 1);

  // Ears, body, head (back to front).
  g.fillCircle(-17, -54, 11).strokeCircle(-17, -54, 11);
  g.fillCircle(17, -54, 11).strokeCircle(17, -54, 11);
  g.fillEllipse(0, 0, 72, 52).strokeEllipse(0, 0, 72, 52);
  g.fillCircle(0, -32, 27).strokeCircle(0, -32, 27);
  // Feet.
  g.fillEllipse(-18, 22, 18, 10).strokeEllipse(-18, 22, 18, 10);
  g.fillEllipse(18, 22, 18, 10).strokeEllipse(18, 22, 18, 10);

  if (silhouette) return;
  g.fillStyle(COLORS.outline, 1);
  g.fillCircle(-9, -34, 4);
  g.fillCircle(9, -34, 4);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(-8, -35, 1.5);
  g.fillCircle(10, -35, 1.5);
  g.fillStyle(0xff9fb5, 0.7);
  g.fillCircle(-16, -24, 5);
  g.fillCircle(16, -24, 5);
  g.lineStyle(3, COLORS.outline, 1);
  g.beginPath();
  g.arc(0, -27, 5, 0.2, Math.PI - 0.2);
  g.strokePath();
}
