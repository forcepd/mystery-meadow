import Phaser from 'phaser';
import type { GameSession } from '../bridge/gameSession';
import { COLORS, WORLD_HEIGHT, WORLD_WIDTH } from './constants';
import { YardScene } from './scenes/YardScene';

export function createGame(parent: HTMLElement, session: GameSession): Phaser.Game {
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
    scene: [new YardScene(session)],
  });
}
