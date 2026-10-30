import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const LOCALES_DIR = path.join(ROOT_DIR, 'src/locales');
const LOCALES = ['zh', 'en', 'es', 'ru', 'vi', 'de', 'pt', 'fr'] as const;

describe('首页与 Unblocked 落地页文案解耦及核心游戏组件分离', () => {
  test('扫雷核心游戏组件 minesweeper-game.vue 独立封装操作区、棋盘与图表', () => {
    const gameComponentPath = path.join(ROOT_DIR, 'src/minesweeper-game.vue');
    assert.equal(
      fs.existsSync(gameComponentPath),
      true,
      '必须存在 src/minesweeper-game.vue 核心组件',
    );
    const content = fs.readFileSync(gameComponentPath, 'utf8');
    assert.ok(
      content.includes('id="stage"'),
      '核心游戏组件必须包含棋盘网格 stage',
    );
    assert.ok(
      content.includes('start-button'),
      '核心游戏组件必须包含笑脸重新开局按钮',
    );
    assert.ok(
      content.includes('learningStore.showProbability'),
      '核心游戏组件必须包含概率热力图开关',
    );
    assert.ok(
      content.includes('operation-chart'),
      '核心游戏组件必须挂载对局图表与回放',
    );
    assert.ok(
      !content.includes('seo.whatIsTitle'),
      '核心游戏组件严禁耦合首页 SEO 介绍正文',
    );
    assert.ok(
      !content.includes('unblockedContent'),
      '核心游戏组件严禁耦合 unblocked 落地页文案',
    );
  });

  test('首页与 unblocked 页面拥有独立的 SEO 文案组件，互不污染', () => {
    const homeSeoPath = path.join(ROOT_DIR, 'src/seo-home-content.vue');
    const unblockedSeoPath = path.join(
      ROOT_DIR,
      'src/seo-unblocked-content.vue',
    );
    assert.equal(
      fs.existsSync(homeSeoPath),
      true,
      '必须存在 src/seo-home-content.vue',
    );
    assert.equal(
      fs.existsSync(unblockedSeoPath),
      true,
      '必须存在 src/seo-unblocked-content.vue',
    );

    const homeSeo = fs.readFileSync(homeSeoPath, 'utf8');
    const unblockedSeo = fs.readFileSync(unblockedSeoPath, 'utf8');

    assert.ok(
      homeSeo.includes('seo.whatIsTitle'),
      '首页 SEO 组件必须承载经典扫雷规则与教学',
    );
    assert.ok(
      homeSeo.includes('id="geo-faq"'),
      '首页 SEO 组件必须包含 GEO FAQ',
    );
    assert.ok(
      unblockedSeo.includes('unblockedContent.title'),
      'Unblocked SEO 组件必须承载免下载/零安装专属说明',
    );
    assert.ok(
      unblockedSeo.includes('id="unblocked-faq"'),
      'Unblocked SEO 组件必须包含 Unblocked 专属 FAQ',
    );
  });

  test('8 种语言的 unblockedContent 结构齐备且文案与首页内容 100% 差异化', () => {
    for (const locale of LOCALES) {
      const jsonPath = path.join(LOCALES_DIR, `${locale}.json`);
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

      assert.ok(
        data.unblockedContent,
        `${locale} 缺少 unblockedContent 多语言对象`,
      );
      assert.ok(
        data.unblockedContent.title,
        `${locale} unblockedContent 缺少 title`,
      );
      assert.ok(
        data.unblockedContent.features?.length >= 3,
        `${locale} unblocked 特性清单至少应有 3 项`,
      );
      assert.ok(
        data.unblockedContent.faqItems?.length >= 4,
        `${locale} unblocked FAQ 至少应有 4 题`,
      );

      // 验证首页与 unblocked 标题不同，避免门页判定
      assert.notEqual(
        data.unblockedContent.title,
        data.seo.whatIsTitle,
        `${locale} 的 unblockedContent.title 与 seo.whatIsTitle 严禁雷同`,
      );

      // 验证 FAQ 问题完全不同
      const homeFaqQuestions = new Set(
        data.faq.items.map((i: { q: string }) => i.q),
      );
      for (const item of data.unblockedContent.faqItems) {
        assert.equal(
          homeFaqQuestions.has(item.q),
          false,
          `${locale} 的 unblocked FAQ [${item.q}] 与首页 FAQ 重复`,
        );
      }
    }
  });

  test('Unblocked 文案严禁使用 ad-free 等违规虚假宣称', () => {
    const forbiddenPattern = /\bad-free\b|sin anuncios|sem anúncios|sans pub/i;
    for (const locale of LOCALES) {
      const jsonPath = path.join(LOCALES_DIR, `${locale}.json`);
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const text = JSON.stringify(data.unblockedContent);
      assert.equal(
        forbiddenPattern.test(text),
        false,
        `${locale} unblockedContent 不得宣称无广告`,
      );
    }
  });
});
