import Phaser from 'phaser';
import { COLORS, WORLD_HEIGHT, WORLD_WIDTH } from './constants';
import { MeadowScene } from './scenes/MeadowScene';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO, // WebGL, falling back to Canvas
    parent,
    backgroundColor: COLORS.grass,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
    },
    input: { activePointers: 3 },
    banner: false,
    scene: [MeadowScene],
  });
}
