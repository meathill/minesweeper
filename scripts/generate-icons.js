// 从 public/favicon.png 生成 favicon 集（macOS sips 缩放 + 手工封装 PNG-compressed ICO）
// 用法：node scripts/generate-icons.js
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicDir = path.join(rootDir, 'public');
const sourceIcon = path.join(publicDir, 'favicon.png');

const sizes = [16, 32, 48, 180, 192, 512];

for (const size of sizes) {
  execFileSync('sips', ['-z', String(size), String(size), sourceIcon, '--out', path.join(publicDir, `icon-${size}.png`)], { stdio: 'pipe' });
}

function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const directory = Buffer.alloc(16 * entries.length);
  let imageOffset = 6 + directory.length;
  const blobs = [];
  entries.forEach(({ size, data }, index) => {
    const entry = directory.subarray(index * 16, index * 16 + 16);
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(imageOffset, 12);
    imageOffset += data.length;
    blobs.push(data);
  });
  return Buffer.concat([header, directory, ...blobs]);
}

writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), readFileSync(path.join(publicDir, 'icon-180.png')));

const icoEntries = [16, 32, 48].map((size) => ({ size, data: readFileSync(path.join(publicDir, `icon-${size}.png`)) }));
writeFileSync(path.join(publicDir, 'favicon.ico'), buildIco(icoEntries));
console.log(`generated: icon-{${sizes.join(',')}}.png + apple-touch-icon.png + favicon.ico`);
