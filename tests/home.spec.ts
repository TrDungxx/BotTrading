import { test } from '@playwright/test';
import { Eyes, ClassicRunner, Target } from '@applitools/eyes-playwright';

test('Home responsive visual test', async ({ page }) => {
  const runner = new ClassicRunner();
  const eyes = new Eyes(runner);

  await eyes.open(page, 'My React App', 'Home page responsive');
await page.goto('http://localhost:5173/');   // ⬅ đổi 3000 -> 5173
await eyes.check('Home - full', Target.window().fully());
await eyes.close(false);
});
