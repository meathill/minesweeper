import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const PAGES_DIR = path.join(ROOT_DIR, 'site/src/pages');
const LOCALES_DIR = path.join(ROOT_DIR, 'src/locales');

const LOCALES = ['zh', 'en', 'es', 'ru', 'vi', 'de', 'pt', 'fr'] as const;
const CONTENT_ROUTES = [
  'guide/google-minesweeper.astro',
  'guide/how-to-play.astro',
  'tools/probability-calculator.astro',
  'unblocked.astro',
] as const;

function resolveAstroPagePath(
  locale: (typeof LOCALES)[number],
  route: string,
): string {
  return locale === 'zh'
    ? path.join(PAGES_DIR, route)
    : path.join(PAGES_DIR, locale, route);
}

describe('多语言内容子站与 SEO 验收约束', () => {
  test('8 种语言的 4 类内容页全部齐备，确保双向 hreflang 零死链', () => {
    for (const locale of LOCALES) {
      for (const route of CONTENT_ROUTES) {
        const fullPath = resolveAstroPagePath(locale, route);
        assert.equal(
          fs.existsSync(fullPath),
          true,
          `缺少内容页: ${path.relative(ROOT_DIR, fullPath)}`,
        );
      }
    }
  });

  test('所有 how-to-play 教程正文内均包含指向同语种 google-minesweeper 的关键词内链', () => {
    for (const locale of LOCALES) {
      const filePath = resolveAstroPagePath(locale, 'guide/how-to-play.astro');
      const source = fs.readFileSync(filePath, 'utf8');
      const expectedHref =
        locale === 'zh'
          ? '/guide/google-minesweeper/'
          : `/${locale}/guide/google-minesweeper/`;
      assert.equal(
        source.includes(`href="${expectedHref}"`),
        true,
        `${locale} 的 how-to-play 正文缺少指向 ${expectedHref} 的内链`,
      );
    }
  });

  test('8 语言游戏首页 #ssr-hero 均向无 JS 爬虫直出 google-minesweeper 教程内链', () => {
    for (const locale of LOCALES) {
      const htmlPath =
        locale === 'zh'
          ? path.join(ROOT_DIR, 'index.html')
          : path.join(ROOT_DIR, 'public', locale, 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');
      const expectedHref =
        locale === 'zh'
          ? '/guide/google-minesweeper/'
          : `/${locale}/guide/google-minesweeper/`;
      assert.equal(
        html.includes(`href="${expectedHref}"`),
        true,
        `${path.relative(ROOT_DIR, htmlPath)} 缺少指向 ${expectedHref} 的 SSR 内链`,
      );
    }
  });

  test('西语 /es/guide/google-minesweeper 满足精选摘要、2026 标题与三大本地化 FAQ', () => {
    const esSource = fs.readFileSync(
      resolveAstroPagePath('es', 'guide/google-minesweeper.astro'),
      'utf8',
    );
    assert.ok(
      esSource.includes(
        'title="Buscaminas de Google: Cómo Jugar Gratis Online, Trucos y Controles (2026)"',
      ),
      '西语 Title 必须匹配 2026 CTR 优化标题',
    );
    const snippetMatch = esSource.match(
      /<p>\s*(El <strong>Buscaminas de Google<\/strong>[\s\S]*?)<\/p>/,
    );
    assert.ok(snippetMatch, '西语首段必须包含加粗的 Buscaminas de Google 定义');
    const plainSnippet = snippetMatch[1]
      .replace(/<[^>]+>/g, '')
      .trim()
      .split(/\s+/);
    assert.ok(
      plainSnippet.length >= 40 && plainSnippet.length <= 52,
      `西语精选摘要定义词数应在 40-52 词之间，当前为 ${plainSnippet.length}`,
    );
    assert.ok(esSource.includes('<ol>'), '西语页必须包含有序步骤列表 <ol>');
    for (const requiredFaq of [
      '¿Cómo poner banderas en el Buscaminas de Google (PC y Celular)?',
      '¿Cómo jugar al Buscaminas de Google sin conexión?',
      '¿Cuáles son los récords y niveles del Buscaminas de Google?',
    ]) {
      assert.ok(
        esSource.includes(requiredFaq),
        `西语 FAQ 缺少问题: ${requiredFaq}`,
      );
    }
  });

  test('英语 /en/guide/google-minesweeper 满足无鼠标插旗 H2/H3、对照表与配图 Alt', () => {
    const enSource = fs.readFileSync(
      resolveAstroPagePath('en', 'guide/google-minesweeper.astro'),
      'utf8',
    );
    assert.ok(
      enSource.includes('<h2>How to Place a Flag in Google Minesweeper</h2>'),
      '英语页缺少 H2: How to Place a Flag in Google Minesweeper',
    );
    assert.ok(
      enSource.includes(
        '<h3>How to Flag in Minesweeper Without a Mouse (Laptop Trackpad &amp; Chromebook)</h3>',
      ),
      '英语页缺少 H3: How to Flag in Minesweeper Without a Mouse',
    );
    assert.ok(
      enSource.includes(
        'alt="how to place a flag in google minesweeper without a mouse"',
      ),
      '英语页缺少精确长尾 alt 属性配图',
    );
    assert.equal(
      fs.existsSync(path.join(ROOT_DIR, 'public/guide-flag-controls.svg')),
      true,
      '缺少配图资源 public/guide-flag-controls.svg',
    );
  });

  test('全站内容页与语言包严禁虚假宣称无广告（Ad-Free / sin anuncios）', () => {
    const forbiddenPattern = /\bad-free\b|sin anuncios|sem anúncios|sans pub/i;
    for (const locale of LOCALES) {
      const localeJson = fs.readFileSync(
        path.join(LOCALES_DIR, `${locale}.json`),
        'utf8',
      );
      assert.equal(
        forbiddenPattern.test(localeJson),
        false,
        `src/locales/${locale}.json 不得宣称无广告`,
      );
      for (const route of CONTENT_ROUTES) {
        const astroContent = fs.readFileSync(
          resolveAstroPagePath(locale, route),
          'utf8',
        );
        assert.equal(
          forbiddenPattern.test(astroContent),
          false,
          `${locale}/${route} 不得宣称无广告`,
        );
      }
    }
  });

  test('GuideLayout 挂载首屏 MiniBoard、滚动 StickyPlayCta 与 RelatedGuides', () => {
    const layoutSource = fs.readFileSync(
      path.join(ROOT_DIR, 'site/src/layouts/GuideLayout.astro'),
      'utf8',
    );
    assert.ok(
      layoutSource.includes('<MiniBoard lang={lang} path={seo.path} />'),
    );
    assert.ok(layoutSource.includes('<RelatedGuides lang={lang}'));
    assert.ok(
      layoutSource.includes('<StickyPlayCta lang={lang} path={seo.path} />'),
    );
  });

  test('响应式表格在小屏容器查询下同步将 caption 设为 block 防止窄列塌缩', () => {
    const globalCss = fs.readFileSync(
      path.join(ROOT_DIR, 'site/src/styles/global.css'),
      'utf8',
    );
    assert.match(
      globalCss,
      /@container\s*\(width\s*<\s*540px\)\s*\{[\s\S]*?\.guide-table-wrapper caption[\s\S]*?display:\s*block/,
    );
  });

  test('品牌切换器与页脚组件使用 vue-i18n，避免外语首页残留硬编码中文', () => {
    const switcher = fs.readFileSync(
      path.join(ROOT_DIR, 'src/brand-site-switcher.vue'),
      'utf8',
    );
    const footer = fs.readFileSync(
      path.join(ROOT_DIR, 'src/brand-footer.vue'),
      'utf8',
    );
    assert.ok(switcher.includes('useI18n'));
    assert.ok(footer.includes('useI18n'));
  });
});
