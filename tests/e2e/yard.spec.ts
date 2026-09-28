import { expect, test } from '@playwright/test';
import {
  animalTapPoint,
  buildSave,
  canvasReady,
  gateTapPoint,
  press,
  seedSave,
  tapWorld,
  testAnimal,
  testVisitor,
} from './helpers';

// Reduced motion stops the render-only ambling, so animals stay exactly where the sim put them.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('first playable yard', () => {
  test('a new game starts with the HUD and a visitor countdown', async ({ page }) => {
    await page.goto('./');
    await canvasReady(page);
    await expect(page.getByTestId('coins')).toHaveText('100');
    await expect(page.getByTestId('gems')).toHaveText('50');
    await expect(page.getByTestId('capacity')).toHaveText('🐾0/6');
    await expect(page.getByTestId('next-visitor')).toContainText(/Next visitor in (10:00|9:\d\d)/);
  });

  test('tapping a mystery visitor reveals it and it walks into the yard', async ({ page }) => {
    await seedSave(
      page,
      buildSave((s, now) => s.world.gateQueue.push(testVisitor(now))),
    );
    await page.goto('./');
    await canvasReady(page);
    await expect(page.getByTestId('next-visitor')).toContainText('A visitor is at the gate!');
    await expect(page.getByTestId('capacity')).toHaveText('🐾0/6');
    await tapWorld(page, gateTapPoint(0));
    await expect(page.getByTestId('capacity')).toHaveText('🐾1/6');
    await expect(page.getByTestId('next-visitor')).toContainText('Next visitor in');
  });

  test('sells a ready animal for coins, and the sale survives a reload', async ({ page }) => {
    await seedSave(
      page,
      buildSave((s, now) => s.world.animals.push(testAnimal(now))),
    );
    await page.goto('./');
    await canvasReady(page);
    await expect(page.getByTestId('capacity')).toHaveText('🐾1/6');

    await tapWorld(page, animalTapPoint({ x: 0.5, y: 0.5 }));
    const card = page.getByRole('complementary', { name: /bunny card/i });
    await expect(card).toBeVisible();
    await expect(card.getByTestId('hold-status')).toHaveText(/Ready to sell!/);
    await expect(card.getByText('Common')).toBeVisible();

    // Every button on the card meets the touch target minimum.
    for (const button of await card.getByRole('button').all()) {
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(48);
      expect(box.height).toBeGreaterThanOrEqual(48);
    }

    await press(page, card.getByRole('button', { name: /sell for 20/i }));
    await expect(card).toBeHidden();
    await expect(page.getByTestId('coins')).toHaveText('120');
    await expect(page.getByTestId('capacity')).toHaveText('🐾0/6');

    // DESIGN 18.4: sales save immediately.
    await page.waitForTimeout(300);
    await page.reload();
    await canvasReady(page);
    await expect(page.getByTestId('coins')).toHaveText('120');
    await expect(page.getByTestId('capacity')).toHaveText('🐾0/6');
  });

  test('a disabled Sell button explains why when tapped', async ({ page }) => {
    await seedSave(
      page,
      buildSave((s, now) =>
        s.world.animals.push(testAnimal(now, { arrivedAt: now, holdUntil: now + 20 * 60_000 })),
      ),
    );
    await page.goto('./');
    await canvasReady(page);
    await tapWorld(page, animalTapPoint({ x: 0.5, y: 0.5 }));
    const card = page.getByRole('complementary', { name: /bunny card/i });
    await expect(card.getByTestId('hold-status')).toHaveText(/Ready to sell in (20:00|19:\d\d)/);
    const sell = card.getByRole('button', { name: /sell for/i });
    await expect(sell).toHaveAttribute('aria-disabled', 'true');
    await press(page, sell, { force: true });
    await expect(card.getByText('Not ready to sell yet.')).toBeVisible();
    await expect(page.getByTestId('coins')).toHaveText('100');
  });

  test('tapping empty ground closes the card', async ({ page }) => {
    await seedSave(
      page,
      buildSave((s, now) => s.world.animals.push(testAnimal(now))),
    );
    await page.goto('./');
    await canvasReady(page);
    await tapWorld(page, animalTapPoint({ x: 0.5, y: 0.5 }));
    const card = page.getByRole('complementary', { name: /bunny card/i });
    await expect(card).toBeVisible();
    await tapWorld(page, animalTapPoint({ x: 0.1, y: 0.9 }));
    await expect(card).toBeHidden();
  });

  test('a pregnant visitor that comes in has babies (toast)', async ({ page }) => {
    await seedSave(
      page,
      buildSave((s, now) =>
        s.world.animals.push(
          testAnimal(now, { name: 'Biscuit', pregnancy: { birthAt: now + 2000, litterSize: 3 } }),
        ),
      ),
    );
    await page.goto('./');
    await canvasReady(page);
    await expect(page.getByText('Biscuit had 3 babies!')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('capacity')).toHaveText('🐾4/6');
  });

  test('the dev Debug Panel is not in the production build', async ({ page }) => {
    await page.goto('./');
    await canvasReady(page);
    await expect(page.getByRole('button', { name: /debug/i })).toHaveCount(0);
  });
});
