import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { localeFromPath } from './seo-meta.js';

describe('localeFromPath', () => {
  test('根路径和未知路径是中文', () => {
    assert.equal(localeFromPath('/'), 'zh');
    assert.equal(localeFromPath(''), 'zh');
    assert.equal(localeFromPath('/enterprise'), 'zh');
    assert.equal(localeFromPath('/guide/how-to-play/'), 'zh');
  });

  test('语言前缀只匹配完整段', () => {
    for (const code of ['en', 'es', 'ru', 'vi', 'de']) {
      assert.equal(localeFromPath(`/${code}`), code);
      assert.equal(localeFromPath(`/${code}/`), code);
      assert.equal(localeFromPath(`/${code}/guide/how-to-play/`), code);
    }
  });
});
