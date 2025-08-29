import { test, expect } from '@playwright/test';
import { Eyes, ClassicRunner, Target } from '@applitools/eyes-playwright';

test('Trading Terminal responsive', async ({ page, baseURL }) => {
  test.setTimeout(60_000);

  const eyes = new Eyes(new ClassicRunner());
  await eyes.open(page, 'My React App', 'Trading Terminal responsive');

  // Nếu dùng HashRouter thì đổi thành `${baseURL}/#/terminal`
  await page.goto(`${baseURL}/#/terminal`);
  await expect(page).toHaveURL(/terminal/);

  // 1) Đảm bảo root mount
  const root = page.locator('[data-test="trading-terminal"]');
  await root.waitFor({ state: 'attached', timeout: 10_000 }).catch(() => {});
  console.log('root count =', await root.count());
  console.log('data-ready =', await root.first().getAttribute('data-ready'));

  // 2) Fallback: chờ chart mount (đặt id trong trang: <div id="tv-chart">)
  await page.waitForSelector('#tv-chart, #tv-chart canvas', { timeout: 20_000 }).catch(() => {});

  // 3) Cuối cùng vẫn chụp để xem nó đang dừng ở đâu
  await eyes.check('Trading Terminal - full', Target.window().fully());

  await eyes.close(false);
});
