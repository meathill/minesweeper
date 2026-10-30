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

test('顶栏 Coss UI 下拉支持锚点定位、Escape 关闭、难度切换且不含已下架站点', async ({
  page,
}) => {
  await page.goto('/');
  const networkTrigger = page
    .locator('header .coss-dropdown-trigger')
    .filter({ hasText: '产品网络' });
  await expect(networkTrigger).toHaveAttribute('aria-expanded', 'false');
  await networkTrigger.click();
  await expect(networkTrigger).toHaveAttribute('aria-expanded', 'true');

  const panelId = await networkTrigger.getAttribute('popovertarget');
  expect(panelId).toBeTruthy();
  const panel = page.locator(`#${panelId}`);
  await expect(panel).toBeVisible();

  const triggerBox = await networkTrigger.boundingBox();
  const panelBox = await panel.boundingBox();
  expect(triggerBox).toBeTruthy();
  expect(panelBox).toBeTruthy();
  if (triggerBox && panelBox) {
    expect(
      Math.abs(panelBox.y - (triggerBox.y + triggerBox.height)),
    ).toBeLessThan(20);
  }

  for (const removed of ['MuiAD', 'Waka', 'MuiRPG']) {
    await expect(panel).not.toContainText(removed);
    await expect(page.locator('.brand-footer-links')).not.toContainText(
      removed,
    );
  }

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(networkTrigger).toHaveAttribute('aria-expanded', 'false');

  const levelTrigger = page
    .locator('header .coss-dropdown-trigger')
    .filter({ hasText: '简单' });
  await levelTrigger.click();
  const levelPanelId = await levelTrigger.getAttribute('popovertarget');
  const levelPanel = page.locator(`#${levelPanelId}`);
  await expect(levelPanel).toBeVisible();
  await levelPanel.getByRole('button', { name: /中等/ }).click();
  await expect(levelPanel).toBeHidden();
  await expect(page.locator('#stage .grid-item')).toHaveCount(256);

  const learnTrigger = page.locator('.coss-dropdown-trigger-toolbar');
  await expect(learnTrigger).toHaveAttribute('aria-expanded', 'false');
  await learnTrigger.click();
  await expect(learnTrigger).toHaveAttribute('aria-expanded', 'true');
  const learnPanelId = await learnTrigger.getAttribute('popovertarget');
  const learnPanel = page.locator(`#${learnPanelId}`);
  await expect(learnPanel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(learnPanel).toBeHidden();
});
