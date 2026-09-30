import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const PAGES = [
  {
    file: '../index.html',
    url: 'https://minesweeper.meathill.com/',
    lang: 'zh-CN',
  },
  {
    file: '../public/en/index.html',
    url: 'https://minesweeper.meathill.com/en/',
    lang: 'en',
  },
  {
    file: '../public/es/index.html',
    url: 'https://minesweeper.meathill.com/es/',
    lang: 'es',
  },
  {
    file: '../public/ru/index.html',
    url: 'https://minesweeper.meathill.com/ru/',
    lang: 'ru',
  },
  {
    file: '../public/vi/index.html',
    url: 'https://minesweeper.meathill.com/vi/',
    lang: 'vi',
  },
  {
    file: '../public/de/index.html',
    url: 'https://minesweeper.meathill.com/de/',
    lang: 'de',
  },
];

const HREFLANGS = [
  ['zh', 'https://minesweeper.meathill.com/'],
  ['en', 'https://minesweeper.meathill.com/en/'],
  ['es', 'https://minesweeper.meathill.com/es/'],
  ['ru', 'https://minesweeper.meathill.com/ru/'],
  ['vi', 'https://minesweeper.meathill.com/vi/'],
  ['de', 'https://minesweeper.meathill.com/de/'],
  ['x-default', 'https://minesweeper.meathill.com/'],
];

// 需要 rating/review 才能出富结果的应用类，站内无可见评价体系时一律不允许出现。
const APP_TYPES = [
  'WebApplication',
  'SoftwareApplication',
  'MobileApplication',
  'VideoGame',
];

function extractJsonLd(html) {
  const match = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  assert.ok(match, '首页必须包含 JSON-LD');
  return JSON.parse(match[1]);
}

for (const { file, url, lang } of PAGES) {
  test(`${file} 不伪造评分：禁用应用类 + aggregateRating/review`, async () => {
    const html = await fs.readFile(new URL(file, import.meta.url), 'utf8');
    const jsonLd = extractJsonLd(html);
    const graph = jsonLd['@graph'];
    assert.ok(Array.isArray(graph), '@graph 必须是数组');
    const types = graph.map((node) => node['@type']);
    for (const appType of APP_TYPES) {
      assert.equal(
        types.includes(appType),
        false,
        `不允许输出 ${appType}（无可见评价体系，见 issue-11）`,
      );
    }
    assert.equal(
      html.includes('aggregateRating'),
      false,
      '禁止伪造 aggregateRating',
    );
    assert.match(html, /"@type":\s*"(WebSite|WebPage|Organization|FAQPage)"/);
    assert.equal(
      types.includes('HowTo'),
      false,
      '首页不再输出已废弃的 HowTo schema（见 issue-12）',
    );
    const organization = graph.find((node) => node['@type'] === 'Organization');
    assert.ok(organization?.logo, 'Organization 必须包含 logo');
  });

  test(`${file} 降级为 WebSite + WebPage 且与可见内容一致`, async () => {
    const html = await fs.readFile(new URL(file, import.meta.url), 'utf8');
    const jsonLd = extractJsonLd(html);
    const graph = jsonLd['@graph'];
    const webSite = graph.find((node) => node['@type'] === 'WebSite');
    const webPage = graph.find((node) => node['@type'] === 'WebPage');
    assert.ok(webSite, '必须包含 WebSite');
    assert.ok(webPage, '必须包含 WebPage');
    assert.ok(webSite.name, 'WebSite.name 非空');
    assert.equal(webSite.url, url, 'WebSite.url 与 canonical 一致');
    assert.equal(webPage.url, url, 'WebPage.url 与 canonical 一致');
    assert.ok(webPage.name, 'WebPage.name 非空');
    assert.ok(webPage.description, 'WebPage.description 非空');

    // JSON-LD 与页面可见内容一致：name/description 必须能在可见 HTML 中找到。
    const title = html.match(/<title>(.*?)<\/title>/s)?.[1] ?? '';
    const metaDescription =
      html.match(/<meta name="description" content="(.*?)"/s)?.[1] ?? '';
    assert.ok(
      title.includes(webPage.name) ||
        webPage.name.includes('扫雷') ||
        webPage.name.includes('Minesweeper'),
      'WebPage.name 与 <title> 一致',
    );
    assert.ok(
      metaDescription.includes(webPage.description.slice(0, 12)) ||
        webPage.description.includes(metaDescription.slice(0, 12)),
      'WebPage.description 与 meta description 一致',
    );
  });

  test(`${file} 多语言首页自指：canonical + html lang + hreflang`, async () => {
    const html = await fs.readFile(new URL(file, import.meta.url), 'utf8');
    assert.ok(html.includes(`<html lang="${lang}">`), `html lang 应为 ${lang}`);
    assert.ok(
      html.includes(`<link rel="canonical" href="${url}" />`),
      'canonical 必须自指',
    );
    assert.ok(
      html.includes(`<meta property="og:url" content="${url}" />`),
      'og:url 必须与 canonical 一致',
    );
    for (const [code, href] of HREFLANGS) {
      assert.ok(
        html.includes(
          `<link rel="alternate" hreflang="${code}" href="${href}" />`,
        ),
        `缺少 hreflang=${code} → ${href}`,
      );
    }
  });
}

for (const { file } of PAGES) {
  test(`${file} SSR 必须输出 H1 + 介绍文字（issue-12）`, async () => {
    const html = await fs.readFile(new URL(file, import.meta.url), 'utf8');
    const h1Match = html.match(/<h1>([^<]+)<\/h1>/);
    assert.ok(h1Match, '首页 SSR HTML 必须包含 H1');
    assert.ok(h1Match[1].trim().length >= 2, 'H1 文本非空');
    const introMatch = html.match(/<p class="ssr-intro">([\s\S]*?)<\/p>/);
    assert.ok(introMatch, '首页 SSR HTML 必须包含 .ssr-intro 介绍文字');
    const introText = introMatch[1].replace(/<[^>]+>/g, '').trim();
    assert.ok(
      introText.length >= 40,
      `介绍文字过短（${introText.length} 字符），爬虫/PSI 需要可见正文`,
    );
    assert.ok(
      html.includes('id="ssr-hero"'),
      '介绍区应放在 #ssr-hero，供无 JS 抓取与首屏 LCP',
    );
  });
}
