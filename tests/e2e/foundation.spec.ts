import { expect, test, type Locator, type Page } from '@playwright/test';

/** Taps with touch on touch devices (iPad projects) and clicks with a mouse elsewhere. */
async function press(page: Page, target: Locator, position?: { x: number; y: number }) {
  const hasTouch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (hasTouch) await target.tap(position ? { position } : undefined);
  else await target.click(position ? { position } : undefined);
}

async function canvasReady(page: Page) {
  await expect(page.locator('[data-testid="game-canvas"] canvas')).toBeVisible();
  // Give Phaser a frame to boot its input system.
  await page.waitForFunction(() => {
    const c = document.querySelector('[data-testid="game-canvas"] canvas') as HTMLCanvasElement;
    return c && c.width > 0 && c.getBoundingClientRect().width > 0;
  });
  await page.waitForTimeout(250);
}

test.describe('foundation', () => {
  test('loads the world canvas with the HUD layered on top', async ({ page }) => {
    await page.goto('./');
    await canvasReady(page);
    await expect(page.getByLabel('100 coins')).toBeVisible();
    await expect(page.getByLabel('50 gems')).toBeVisible();
    await expect(page.getByTestId('rotate-screen')).toBeHidden();
  });

  test('a tap on the canvas registers in the world and only there', async ({ page }) => {
    await page.goto('./');
    await canvasReady(page);
    const canvas = page.locator('[data-testid="game-canvas"] canvas');
    const box = (await canvas.boundingBox())!;
    // Middle of the meadow, away from HUD elements.
    await press(page, canvas, { x: box.width * 0.4, y: box.height * 0.5 });
    await expect(page.getByTestId('canvas-taps')).toHaveText('1');
    await press(page, canvas, { x: box.width * 0.3, y: box.height * 0.4 });
    await expect(page.getByTestId('canvas-taps')).toHaveText('2');
    await expect(page.getByTestId('button-taps')).toHaveText('0');
  });

  test('a tap on a React button registers and does not fall through to the canvas', async ({
    page,
  }) => {
    await page.goto('./');
    await canvasReady(page);
    const button = page.getByRole('button', { name: /send a heart/i });
    await press(page, button);
    await press(page, button);
    await expect(page.getByTestId('button-taps')).toHaveText('2');
    await expect(page.getByTestId('canvas-taps')).toHaveText('0');
  });

  test('interactive elements meet the 48x48 touch target minimum', async ({ page }) => {
    await page.goto('./');
    await canvasReady(page);
    const targets = page.locator('button, a');
    const count = await targets.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = (await targets.nth(i).boundingBox())!;
      expect(box.width, `target ${i} width`).toBeGreaterThanOrEqual(48);
      expect(box.height, `target ${i} height`).toBeGreaterThanOrEqual(48);
    }
  });

  test('portrait shows the rotate screen', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('./');
    await expect(page.getByTestId('rotate-screen')).toBeVisible();
    await expect(page.getByText(/turn your screen sideways/i)).toBeVisible();
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId('rotate-screen')).toBeHidden();
  });

  test('has the iPad viewport and touch settings', async ({ page }) => {
    await page.goto('./');
    await canvasReady(page);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      'content',
      'width=device-width, initial-scale=1, viewport-fit=cover',
    );
    const touchAction = await page
      .locator('[data-testid="game-canvas"] canvas')
      .evaluate((el) => getComputedStyle(el).touchAction);
    expect(touchAction).toBe('none');
  });

  test('makes no requests to other origins', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const external: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.protocol.startsWith('http') && url.origin !== origin) external.push(req.url());
    });
    await page.goto('./');
    await canvasReady(page);
    await page.goto('./privacy.html');
    await page.waitForLoadState('networkidle');
    expect(external).toEqual([]);
  });

  test('uses the self-hosted font', async ({ page }) => {
    await page.goto('./');
    await canvasReady(page);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('800 20px Nunito'))).toBe(true);
  });

  test('serves an installable landscape web app manifest', async ({ page, request }) => {
    await page.goto('./');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const res = await request.get(new URL(href!, page.url()).toString());
    expect(res.ok()).toBe(true);
    const manifest = await res.json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('landscape');
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', /.png$/);
  });

  test('registers a service worker for offline play', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Playwright WebKit does not expose service workers.');
    await page.goto('./');
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(scope).toContain(new URL(page.url()).origin);
  });

  test('has a privacy page linked from the game', async ({ page }) => {
    await page.goto('./');
    await canvasReady(page);
    await press(page, page.getByRole('link', { name: 'Privacy' }));
    await expect(page).toHaveURL(/privacy\.html$/);
    await expect(
      page.getByText(
        "This game stores everything on your device. We don't collect any information.",
      ),
    ).toBeVisible();
  });
});
