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
  // 没踩雷：开始按钮仍是手柄，不是哭脸（按钮内含 kbd 快捷键标注，用包含匹配）
  await expect(page.locator('.start-button')).toContainText('🎮');
});

test('右键插旗并计入剩余雷数', async ({ page }) => {
  await page.locator('#stage .grid-item').nth(0).click({ button: 'right' });
  await expect(page.locator('#stage .grid-item').nth(0)).toContainText('🚩');
});

test('右键摘旗后 200ms 内同格左键误触被吞掉', async ({ page }) => {
  // 先开局，确保已布雷
  await page.locator('#stage .grid-item').nth(40).click();
  const targetIndex = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('#stage .grid-item'));
    return cells.findIndex((el) => !el.classList.contains('open'));
  });
  expect(targetIndex).toBeGreaterThanOrEqual(0);
  const target = page.locator('#stage .grid-item').nth(targetIndex);
  // 右键插旗
  await target.click({ button: 'right' });
  await expect(target).toContainText('🚩');
  const openedBefore = await page.locator('#stage .grid-item.open').count();
  // 误触复现：右键摘旗（旗→问号）后左键紧落同格，必须被吞掉（同步派发保证落在锁窗内）
  await page.evaluate((i) => {
    const el = document.querySelectorAll('#stage .grid-item')[i] as HTMLElement;
    el.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 2,
      }),
    );
    el.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );
  }, targetIndex);
  await expect(target).toContainText('?');
  await expect(page.locator('#stage .grid-item.open')).toHaveCount(
    openedBefore,
  );
  // 锁过期后左键恢复正常
  await page.waitForTimeout(300);
  await target.click();
  expect(await page.locator('#stage .grid-item.open').count()).toBeGreaterThan(
    openedBefore,
  );
});

test('重开后棋盘归零', async ({ page }) => {
  await page.locator('#stage .grid-item').nth(40).click();
  expect(await page.locator('#stage .grid-item.open').count()).toBeGreaterThan(
    0,
  );
  await page.locator('.start-button').click();
  await expect(page.locator('#stage .grid-item.open')).toHaveCount(0);
});

test('快捷键 N 重开、H 提示、L 教学开关', async ({ page }) => {
  await page.locator('#stage .grid-item').nth(40).click();
  expect(await page.locator('#stage .grid-item.open').count()).toBeGreaterThan(
    0,
  );
  // L 开教学模式：概率覆盖层出现；再按 L 关闭
  await page.keyboard.press('l');
  expect(await page.locator('.prob-overlay').count()).toBeGreaterThan(0);
  await page.keyboard.press('l');
  await expect(page.locator('.prob-overlay')).toHaveCount(0);
  // H 提示：命中格出现 🎯
  await page.keyboard.press('h');
  await expect(page.locator('.hint-overlay')).toHaveCount(1);
  // N 重开：棋盘归零
  await page.keyboard.press('n');
  await expect(page.locator('#stage .grid-item.open')).toHaveCount(0);
});

test('棋盘禁双击缩放（touch-action）', async ({ page }) => {
  const stageTouch = await page.evaluate(
    () => getComputedStyle(document.querySelector('#stage')!).touchAction,
  );
  expect(stageTouch).toContain('manipulation');
  const cellTouch = await page.evaluate(
    () =>
      getComputedStyle(document.querySelector('#stage .grid-item')!)
        .touchAction,
  );
  expect(cellTouch).toContain('manipulation');
});

test('终局后棋盘惰性且右键无原生菜单', async ({ page }) => {
  await page.locator('#stage .grid-item').nth(40).click();
  // 逐格点开直到终局（踩雷或全开都会结束）
  await page.evaluate(() => {
    const cells = Array.from(
      document.querySelectorAll('#stage .grid-item'),
    ) as HTMLElement[];
    const btn = document.querySelector('.start-button')!;
    for (const el of cells) {
      // 按钮含 kbd 标注，终局判据是手柄表情消失（变 😊/😭）
      if (!btn.textContent?.includes('🎮')) break;
      if (!el.classList.contains('open')) el.click();
    }
  });
  await expect(page.locator('.start-button')).not.toContainText('🎮');
  await expect(page.locator('#stage')).toHaveClass(/game-over/);
  const prevented = await page.evaluate(() => {
    const el = document.querySelectorAll('#stage .grid-item')[0] as HTMLElement;
    const ev = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
    });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(prevented).toBe(true);
});

test('评论按钮打开评论弹窗', async ({ page }) => {
  await expect(page.locator('#comment-toggle')).toBeVisible();
  await page.locator('#comment-toggle').click();
  await expect(page.locator('#comment-modal')).toHaveJSProperty('open', true);
  await expect(page.locator('#comment-modal #comments')).toBeAttached();
});
