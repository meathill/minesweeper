import assert from 'node:assert/strict';
import test from 'node:test';
import { brandNetwork } from './brand-network.js';

test('扫雷品牌导航排除当前站、服务端点和重复产品', () => {
  assert.equal(brandNetwork.organization.name, 'Meathill Studio');
  assert.equal(brandNetwork.organization.legalName, 'Meathill LLC');
  assert.equal(brandNetwork.allProductsUrl, 'https://meathill.com/app');
  assert.equal(brandNetwork.footerLinks.some((site) => site.id === 'minesweeper'), false);
  assert.equal(brandNetwork.sites.some((site) => site.name === 'Mui Search API'), false);
  assert.equal(new Set(brandNetwork.sites.map((site) => site.id)).size, brandNetwork.sites.length);
});
