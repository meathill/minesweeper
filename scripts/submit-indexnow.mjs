// 部署上线后提交 IndexNow。key 文件必须先能从站点根访问，构建期调用会被拒。
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SITE = 'https://minesweeper.meathill.com';
const HOST = 'minesweeper.meathill.com';
const KEY_FILE = /^[a-f0-9]{32}\.txt$/;

export function urlsFromSitemap(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
    match[1].trim(),
  );
}

export function readIndexNowKey(directory) {
  const names = readdirSync(directory).filter((name) => KEY_FILE.test(name));
  if (names.length !== 1) {
    throw new Error(
      `public 下应有且只有一个 32 位 IndexNow key 文件，实际 ${names.length} 个`,
    );
  }
  const key = readFileSync(path.join(directory, names[0]), 'utf8').trim();
  if (key !== names[0].slice(0, -4)) {
    throw new Error('IndexNow key 文件名与内容不一致');
  }
  return key;
}

export async function submitIndexNow() {
  const root = path.resolve(import.meta.dirname, '..');
  const key = readIndexNowKey(path.join(root, 'public'));
  const keyResponse = await fetch(`${SITE}/${key}.txt`);
  const keyBody = (await keyResponse.text()).trim();
  if (keyResponse.status !== 200 || keyBody !== key) {
    throw new Error(`IndexNow key 尚未在线上生效：HTTP ${keyResponse.status}`);
  }

  const sitemapResponse = await fetch(`${SITE}/sitemap.xml`);
  if (!sitemapResponse.ok) {
    throw new Error(`sitemap 拉取失败：HTTP ${sitemapResponse.status}`);
  }
  const urls = urlsFromSitemap(await sitemapResponse.text());
  if (urls.length === 0) {
    throw new Error('sitemap 里没有 URL');
  }

  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key,
      keyLocation: `${SITE}/${key}.txt`,
      urlList: urls,
    }),
  });
  console.log(`IndexNow HTTP ${response.status}，提交 ${urls.length} 个 URL`);
  if (response.status !== 200 && response.status !== 202) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`IndexNow 拒绝提交：HTTP ${response.status} ${detail}`);
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  submitIndexNow().catch((error) => {
    console.error(error instanceof Error ? error.message : 'IndexNow 提交失败');
    process.exit(1);
  });
}
