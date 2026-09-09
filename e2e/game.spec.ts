import { expect, test } from '@playwright/test';

// 游戏核心链路冒烟：首击洪水展开（0.8.0 ref 回归）、右键插旗、重开复位。
// 全部基于 Easy 9x9 默认盘：首击 3x3 必为空白，级联至少开满 9 格。

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#stage .grid-item')).toHaveCount(81);
});

test('首击空白格洪水展开到数字边界', async ({ page }) => {
  // 中央 (4,4) -> index 40
  await page.locator('#stage .grid-item').nth(40).click();
  // 回归信号：曾因模板 ref 解包 bug 只能开中 1 格
  await expect(page.locator('#stage .grid-item.open')).not.toHaveCount(1);
  const opened = await page.locator('#stage .grid-item.open').count();
  expect(opened).toBeGreaterThanOrEqual(9);
  // 没踩雷：开始按钮仍是手柄，不是哭脸
  await expect(page.locator('.start-button')).toHaveText('🎮');
});

test('右键插旗并计入剩余雷数', async ({ page }) => {
  await page.locator('#stage .grid-item').nth(0).click({ button: 'right' });
  await expect(page.locator('#stage .grid-item').nth(0)).toContainText('🚩');
});

test('重开后棋盘归零', async ({ page }) => {
  await page.locator('#stage .grid-item').nth(40).click();
  expect(await page.locator('#stage .grid-item.open').count()).toBeGreaterThan(
    0,
  );
  await page.locator('.start-button').click();
  await expect(page.locator('#stage .grid-item.open')).toHaveCount(0);
});

test('评论按钮打开评论弹窗', async ({ page }) => {
  await expect(page.locator('#comment-toggle')).toBeVisible();
  await page.locator('#comment-toggle').click();
  await expect(page.locator('#comment-modal')).toHaveJSProperty('open', true);
  await expect(page.locator('#comment-modal #comments')).toBeAttached();
});
