// 按语言生成 OG 图（1200×630）：Playwright 截 scripts/og-template.html。
// 用法：node scripts/generate-og.mjs [es|ru|vi|de|all]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const templatePath = path.join(rootDir, 'scripts', 'og-template.html');
const publicDir = path.join(rootDir, 'public');

const COPY = {
  es: {
    badge: 'Aprende jugando',
    titleW: 'Meathill',
    titleY: 'Minesweeper',
    sub1: 'Buscaminas moderno · Mapa de calor · Eficiencia',
    sub2: 'Sin clic derecho · Doble clic · Trackpad y móvil',
    pills: ['75% Calor', '0–10 Eficiencia', '6s Repetición', '🎯 Trackpad'],
  },
  ru: {
    badge: 'Учись играя',
    titleW: 'Meathill',
    titleY: 'Minesweeper',
    sub1: 'Современный Сапёр · Карта вероятностей',
    sub2: 'Без правой кнопки · Двойной щелчок · Тачпад',
    pills: ['75% Карта', '0–10 Очки', '6с Повтор', '🎯 Тачпад'],
  },
  vi: {
    badge: 'Vừa chơi vừa học',
    titleW: 'Meathill',
    titleY: 'Minesweeper',
    sub1: 'Dò Mìn hiện đại · Bản đồ nhiệt · Hiệu quả',
    sub2: 'Không chuột phải · Nháy đúp · Touchpad & mobile',
    pills: ['75% Nhiệt', '0–10 Điểm', '6s Xem lại', '🎯 Touchpad'],
  },
  de: {
    badge: 'Lernen beim Spielen',
    titleW: 'Meathill',
    titleY: 'Minesweeper',
    sub1: 'Modernes Minesweeper · Heatmap · Effizienz',
    sub2: 'Ohne Rechtsklick · Doppelklick · Trackpad & Handy',
    pills: ['75% Heatmap', '0–10 Effizienz', '6s Replay', '🎯 Trackpad'],
  },
};

const langs =
  process.argv[2] && process.argv[2] !== 'all'
    ? [process.argv[2]]
    : Object.keys(COPY);

for (const lang of langs) {
  if (!COPY[lang]) {
    console.error(`未知语言: ${lang}`);
    process.exit(1);
  }
}

const template = readFileSync(templatePath, 'utf8');
const browser = await chromium.launch();
try {
  for (const lang of langs) {
    const copy = COPY[lang];
    const html = template
      .replace('{{BADGE}}', copy.badge)
      .replace('{{TITLE_W}}', copy.titleW)
      .replace('{{TITLE_Y}}', copy.titleY)
      .replace('{{SUB1}}', copy.sub1)
      .replace('{{SUB2}}', copy.sub2)
      .replace('{{P1}}', copy.pills[0])
      .replace('{{P2}}', copy.pills[1])
      .replace('{{P3}}', copy.pills[2])
      .replace('{{P4}}', copy.pills[3]);
    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 },
    });
    await page.setContent(html, { waitUntil: 'networkidle' });
    const out = path.join(publicDir, `og-image-${lang}.png`);
    await page.screenshot({ path: out, fullPage: false });
    await page.close();
    console.log(`generated: og-image-${lang}.png`);
  }
} finally {
  await browser.close();
}
