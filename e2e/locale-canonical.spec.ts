import { expect, test } from '@playwright/test';

// 英文爬虫/浏览器打开 / 时，hydration 不得把 canonical 改成 /en/。
test.use({ locale: 'en-US' });

test('英文浏览器且记下 en，打开 / 仍自指中文首页', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('locale', 'en');
  });
  await page.goto('/');
  await expect(page.locator('#stage .grid-item')).toHaveCount(81);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://minesweeper.meathill.com/',
  );
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('header h1')).toHaveText('肉山扫雷');
});

test('/en/ 的 canonical 自指英文首页', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('#stage .grid-item')).toHaveCount(81);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://minesweeper.meathill.com/en/',
  );
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
