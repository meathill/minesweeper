import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  applyGoogleAnalytics,
  readGoogleAnalyticsId,
} from '../scripts/google-analytics.mjs';

const SAMPLE = `<!-- ga:start -->
<script async src="https://www.googletagmanager.com/gtag/js?id=__GA_ID__"></script>
<script>gtag('config', '__GA_ID__');</script>
<!-- ga:end -->
<script>observer</script>`;

const SOURCE_FILES = [
  'index.html',
  'public/en/index.html',
  'public/es/index.html',
  'public/ru/index.html',
  'public/vi/index.html',
  'public/de/index.html',
  'site/src/layouts/BaseLayout.astro',
];

describe('google analytics 注入', () => {
  test('假 ID 替换占位，观察器还在', () => {
    const html = applyGoogleAnalytics(SAMPLE, 'G-TEST123456');
    assert.match(html, /id=G-TEST123456/);
    assert.match(html, /G-TEST123456/);
    assert.equal(html.includes('__GA_ID__'), false);
    assert.match(html, /observer/);
  });

  test('未设置时去掉 gtag，观察器还在', () => {
    const html = applyGoogleAnalytics(SAMPLE, '');
    assert.equal(html.includes('gtag/js'), false);
    assert.equal(html.includes('__GA_ID__'), false);
    assert.match(html, /observer/);
  });

  test('源码不再写死 Measurement ID', () => {
    for (const file of SOURCE_FILES) {
      const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      assert.equal(/G-[A-Z0-9]{6,}/.test(text), false, file);
    }
  });

  test('游戏壳保留占位块', () => {
    for (const file of SOURCE_FILES.slice(0, 6)) {
      const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      assert.match(text, /<!-- ga:start -->/);
      assert.match(text, /__GA_ID__/);
    }
  });

  test('空值和合法 ID', () => {
    assert.equal(readGoogleAnalyticsId({}), '');
    assert.equal(
      readGoogleAnalyticsId({ NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: '  ' }),
      '',
    );
    assert.equal(
      readGoogleAnalyticsId({
        NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: ' G-TEST123456 ',
      }),
      'G-TEST123456',
    );
  });

  test('非法 ID 拒绝注入且不回显原值', () => {
    const bad = 'not-a-ga-id';
    assert.throws(
      () => readGoogleAnalyticsId({ NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: bad }),
      (error) => {
        assert.equal(String(error.message).includes(bad), false);
        return true;
      },
    );
  });
});
