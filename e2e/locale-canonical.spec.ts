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

test('/pt/ 与 /fr/ 新语种首页自指且设置对应 lang', async ({ page }) => {
  await page.goto('/pt/');
  await expect(page.locator('#stage .grid-item')).toHaveCount(81);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://minesweeper.meathill.com/pt/',
  );
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.locator('header')).not.toContainText('产品网络');
  await expect(page.locator('header')).toContainText('Produtos');

  await page.goto('/fr/');
  await expect(page.locator('#stage .grid-item')).toHaveCount(81);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://minesweeper.meathill.com/fr/',
  );
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('header')).not.toContainText('产品网络');
  await expect(page.locator('header')).toContainText('Produits');
});
