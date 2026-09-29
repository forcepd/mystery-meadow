import type Phaser from 'phaser';

/** SVG art is rasterized at 2x so it stays crisp on Retina iPads (shown at 1/RESOLUTION scale). */
export const SVG_RESOLUTION = 2;

const pending = new Map<string, ((key: string) => void)[]>();

/**
 * Makes sure texture `key` exists, rasterizing `source` (an SVG data URI or an image URL from the
 * asset manifest) the first time, then calls `ready`. Each texture is built once and shared.
 * Drawn into an exact-size canvas: browsers disagree on an SVG image's own size (WebKit drew it
 * small and offset when used as a texture directly).
 */
export function ensureTexture(
  scene: Phaser.Scene,
  key: string,
  source: () => string,
  size: { w: number; h: number },
  ready: (key: string) => void,
): void {
  const textures = scene.textures;
  if (textures.exists(key)) {
    ready(key);
    return;
  }
  const waiting = pending.get(key);
  if (waiting) {
    waiting.push(ready);
    return;
  }
  pending.set(key, [ready]);
  const img = new Image();
  const finish = () => {
    const callbacks = pending.get(key) ?? [];
    pending.delete(key);
    if (!textures.exists(key)) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(size.w * SVG_RESOLUTION);
      canvas.height = Math.ceil(size.h * SVG_RESOLUTION);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      textures.addCanvas(key, canvas);
    }
    for (const cb of callbacks) cb(key);
  };
  img.onload = finish;
  img.onerror = () => pending.delete(key);
  img.src = source();
}
