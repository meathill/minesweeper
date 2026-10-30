import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { brandNetwork } from './brand-network.js';

test('扫雷品牌导航排除当前站、服务端点和重复产品', () => {
  assert.equal(brandNetwork.organization.name, 'Meathill Studio');
  assert.equal(brandNetwork.organization.legalName, 'Meathill LLC');
  assert.equal(brandNetwork.allProductsUrl, 'https://meathill.com/app');
  assert.equal(
    brandNetwork.footerLinks.some((site) => site.id === 'minesweeper'),
    false,
  );
  assert.equal(
    brandNetwork.sites.some((site) => site.name === 'Mui Search API'),
    false,
  );
  assert.equal(
    new Set(brandNetwork.sites.map((site) => site.id)).size,
    brandNetwork.sites.length,
  );
  for (const excludedId of ['muiad', 'waka', 'muirpg']) {
    assert.equal(
      brandNetwork.sites.some((site) => site.id === excludedId),
      false,
      `brandNetwork.sites 不应包含 ${excludedId}`,
    );
    assert.equal(
      brandNetwork.footerLinks.some((site) => site.id === excludedId),
      false,
      `brandNetwork.footerLinks 不应包含 ${excludedId}`,
    );
  }
});

test('Astro 页脚复用统一的过滤后品牌外链', async () => {
  const footerSource = await fs.readFile(
    new URL('../site/src/components/SiteFooter.astro', import.meta.url),
    'utf8',
  );
  assert.match(footerSource, /brandNetwork\.footerLinks/);
  assert.doesNotMatch(footerSource, /getBrandNetworkLinks/);
});

test('禁用 JavaScript 时仍提供母站和全部产品基础链接', async () => {
  const html = await fs.readFile(
    new URL('../index.html', import.meta.url),
    'utf8',
  );

  assert.match(
    html,
    /<noscript>[\s\S]*https:\/\/meathill\.com[\s\S]*https:\/\/meathill\.com\/app[\s\S]*<\/noscript>/,
  );
});
