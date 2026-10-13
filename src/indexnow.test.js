import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  readIndexNowKey,
  urlsFromSitemap,
} from '../scripts/submit-indexnow.mjs';

describe('IndexNow', () => {
  test('从 sitemap 取出 loc', () => {
    const xml = `<?xml version="1.0"?>
<urlset>
  <url><loc>https://minesweeper.meathill.com/</loc></url>
  <url><loc>https://minesweeper.meathill.com/en/</loc></url>
</urlset>`;
    assert.deepEqual(urlsFromSitemap(xml), [
      'https://minesweeper.meathill.com/',
      'https://minesweeper.meathill.com/en/',
    ]);
  });

  test('仓库里的 key 文件名与内容一致', () => {
    const directory = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../public',
    );
    assert.match(readIndexNowKey(directory), /^[a-f0-9]{32}$/);
  });
});
