import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const PAGES = [
  'site/src/pages/tools/probability-calculator.astro',
  'site/src/pages/guide/google-minesweeper.astro',
  'site/src/pages/guide/how-to-play.astro',
  'site/src/pages/unblocked.astro',
];

describe('中文内容页 description', () => {
  test('长度落在 Bing 120 字门槛和 160 字之间', () => {
    for (const file of PAGES) {
      const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      const description = text.match(/description="([^"]*)"/)?.[1] ?? '';
      const length = [...description].length;
      assert.ok(
        length >= 120 && length <= 160,
        `${file} description 长度为 ${length}`,
      );
    }
  });
});
