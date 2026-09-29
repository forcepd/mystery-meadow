import { expect, test } from '@playwright/test';
import {
  buildSave,
  canvasReady,
  gateTapPoint,
  press,
  seedSave,
  tapWorld,
  testVisitor,
} from './helpers';

test.describe('sound (DESIGN 16.3)', () => {
  test('taps start the sound without errors; mute and volumes are saved', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedSave(
      page,
      buildSave(() => {}),
    );
    await page.goto('./');
    await canvasReady(page);
    // The first tap unlocks audio (iOS needs a user gesture).
    await tapWorld(page, { x: 640, y: 600 });

    await press(page, page.getByRole('button', { name: 'Settings' }));
    const screen = page.getByRole('dialog', { name: 'Settings' });
    const music = screen.getByLabel('🎵 Music');
    const sounds = screen.getByLabel('🔊 Sounds');
    await expect(music).toHaveValue('10');
    await music.fill('3');
    await sounds.fill('0');
    await expect(sounds).toHaveAttribute('aria-valuetext', 'Off');
    const mute = screen.getByLabel('🔇 All sounds off');
    await press(page, mute);
    await expect(mute).toBeChecked();
    await expect(music).toBeDisabled();
    await page.waitForTimeout(300); // Settings save right away.

    await page.reload();
    await canvasReady(page);
    await press(page, page.getByRole('button', { name: 'Settings' }));
    await expect(screen.getByLabel('🔇 All sounds off')).toBeChecked();
    await expect(screen.getByLabel('🎵 Music')).toHaveValue('3');
    await expect(screen.getByLabel('🔊 Sounds')).toHaveValue('0');
    expect(errors).toEqual([]);
  });

  test('audio starts on the first tap and a reveal makes a sound', async ({ page }) => {
    // Count what the game asks Web Audio for, without changing how it works.
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      const Base = window.AudioContext;
      w.__oscillators = 0;
      window.AudioContext = class extends Base {
        constructor(options?: AudioContextOptions) {
          super(options);
          w.__audio = this;
        }
        override createOscillator() {
          w.__oscillators = (w.__oscillators as number) + 1;
          return super.createOscillator();
        }
      };
    });
    await seedSave(
      page,
      buildSave((s, now) => {
        s.world.nextVisitorAt = now + 99 * 3_600_000;
        s.world.gateQueue.push(testVisitor(now));
      }),
    );
    await page.goto('./');
    await canvasReady(page);
    // Nothing plays before the first tap (iOS rule).
    expect(await page.evaluate(() => (window as unknown as { __audio?: unknown }).__audio)).toBe(
      undefined,
    );
    await tapWorld(page, gateTapPoint(0));
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { __audio?: AudioContext }).__audio?.state),
      )
      .toBe('running');
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { __oscillators: number }).__oscillators),
      )
      .toBeGreaterThan(3);
  });
});
