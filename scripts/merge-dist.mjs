// 把内容子站（Astro）的构建产物并入游戏 SPA 的 dist/，并重建整站 sitemap.xml。
// 前置条件：已运行 `vite build`（生成 dist/）和 `astro build`（生成 site/dist/）。
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const distDir = path.join(rootDir, 'dist');
const contentDistDir = path.join(rootDir, 'site', 'dist');
const SITE_URL = 'https://minesweeper.meathill.com';

if (!existsSync(distDir) || !existsSync(contentDistDir)) {
  console.error('缺少 dist/ 或 site/dist/，请先运行 vite build 与 astro build');
  process.exit(1);
}

// 防呆：内容子站不得生成与游戏 SPA 同名的页面（根页面与 en 根页面由游戏占用）
for (const reserved of ['index.html', 'en/index.html']) {
  if (existsSync(path.join(contentDistDir, reserved))) {
    console.error(`site/dist/${reserved} 与游戏 SPA 页面冲突，请移除该页面`);
    process.exit(1);
  }
}

cpSync(contentDistDir, distDir, { recursive: true });

// 游戏多语言首页：/en/ 是真实静态文件（public/en/），其余语言复制同一 SPA 首页，
// 让 /es/ 等路径与 /en/ 一样走文件系统（rewrite 匹配不到带尾斜杠的目录路径）
for (const locale of ['es', 'ru', 'vi', 'de']) {
  mkdirSync(path.join(distDir, locale), { recursive: true });
  cpSync(path.join(distDir, 'index.html'), path.join(distDir, locale, 'index.html'));
}

/** 递归收集目录格式产物中的页面路径（形如 guide/xxx/index.html → /guide/xxx/） */
function collectPagePaths(dir, prefix = '') {
  const paths = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_astro') || entry.name.startsWith('.')) {
      continue;
    }
    const childPrefix = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      paths.push(...collectPagePaths(path.join(dir, entry.name), childPrefix));
    } else if (entry.name === 'index.html') {
      paths.push(`${prefix}/`);
    }
  }
  return paths;
}

const contentPaths = collectPagePaths(contentDistDir).sort();
const lastmod = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: '/', priority: '1.0' },
  // 游戏多语言首页由 Vercel rewrite 提供，不在静态产物里，需手动列出
  ...['/en/', '/es/', '/ru/', '/vi/', '/de/'].map((loc) => ({ loc, priority: '0.8' })),
  ...contentPaths.map((loc) => ({ loc, priority: '0.6' })),
];

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map(({ loc, priority }) =>
    [
      '  <url>',
      `    <loc>${SITE_URL}${loc}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      '    <changefreq>monthly</changefreq>',
      `    <priority>${priority}</priority>`,
      '  </url>',
    ].join('\n'),
  ),
  '</urlset>',
  '',
].join('\n');

writeFileSync(path.join(distDir, 'sitemap.xml'), xml);
console.log(`merged ${contentPaths.length} content page(s) into dist/, sitemap.xml regenerated with ${urls.length} URLs`);
