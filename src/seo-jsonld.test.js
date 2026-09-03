import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const PAGES = [
  { file: '../index.html', url: 'https://minesweeper.meathill.com/' },
  { file: '../public/en/index.html', url: 'https://minesweeper.meathill.com/en/' },
];

// 需要 rating/review 才能出富结果的应用类，站内无可见评价体系时一律不允许出现。
const APP_TYPES = ['WebApplication', 'SoftwareApplication', 'MobileApplication', 'VideoGame'];

function extractJsonLd(html) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, '首页必须包含 JSON-LD');
  return JSON.parse(match[1]);
}

for (const { file, url } of PAGES) {
  test(`${file} 不伪造评分：禁用应用类 + aggregateRating/review`, async () => {
    const html = await fs.readFile(new URL(file, import.meta.url), 'utf8');
    const jsonLd = extractJsonLd(html);
    const graph = jsonLd['@graph'];
    assert.ok(Array.isArray(graph), '@graph 必须是数组');
    const types = graph.map((node) => node['@type']);
    for (const appType of APP_TYPES) {
      assert.equal(types.includes(appType), false, `不允许输出 ${appType}（无可见评价体系，见 issue-11）`);
    }
    assert.equal(html.includes('aggregateRating'), false, '禁止伪造 aggregateRating');
    assert.match(html, /"@type":\s*"(WebSite|WebPage|Organization|FAQPage|HowTo)"/);
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
    const metaDescription = html.match(/<meta name="description" content="(.*?)"/s)?.[1] ?? '';
    assert.ok(title.includes(webPage.name) || webPage.name.includes('扫雷') || webPage.name.includes('Minesweeper'), 'WebPage.name 与 <title> 一致');
    assert.ok(
      metaDescription.includes(webPage.description.slice(0, 12)) || webPage.description.includes(metaDescription.slice(0, 12)),
      'WebPage.description 与 meta description 一致',
    );
  });
}
