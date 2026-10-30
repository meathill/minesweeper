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
  await expect(page.locator('#geo-faq')).toBeVisible();
  await expect(page.locator('#unblocked-faq')).toHaveCount(0);
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

test('/unblocked/ 与 /en/unblocked/ 作为独立全功能 SPA 运行，无 iframe 且正确映射', async ({
  page,
}) => {
  await page.goto('/unblocked/');
  await expect(page.locator('.play-iframe, #app iframe')).toHaveCount(0);
  await expect(page.locator('#stage .grid-item')).toHaveCount(81);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://minesweeper.meathill.com/unblocked/',
  );
  await expect(page).toHaveTitle(/扫雷在线玩/);
  await expect(page.locator('#unblocked-faq')).toBeVisible();
  await expect(page.locator('#geo-faq')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '在线扫雷，即开即玩' }),
  ).toBeVisible();

  // 语言下拉在 unblocked 下切换到英语，路由无缝切换到 /en/unblocked/
  const langTrigger = page.locator('header .coss-dropdown-trigger').filter({
    hasText: '中文',
  });
  await langTrigger.click();
  const langPanelId = await langTrigger.getAttribute('popovertarget');
  const langPanel = page.locator(`#${langPanelId}`);
  await expect(langPanel).toBeVisible();
  await langPanel.getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/unblocked\/?$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://minesweeper.meathill.com/en/unblocked/',
  );
  await expect(page).toHaveTitle(/Minesweeper Unblocked/);
  await expect(page.locator('.play-iframe, #app iframe')).toHaveCount(0);
  await expect(page.locator('#stage .grid-item')).toHaveCount(81);
  await expect(page.locator('#unblocked-faq')).toBeVisible();
  await expect(page.locator('#geo-faq')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Online Minesweeper, Zero Setup' }),
  ).toBeVisible();
});
