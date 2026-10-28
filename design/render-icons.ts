// Renders the extension icons in public/icon/ from the SVGs in this folder.
//
//   npm run icons
//
// 128 and 96 keep the Chrome Web Store's 16px padding; smaller sizes crop it
// so the tile fills the toolbar slot, and 16 has its own pixel-grid drawing.

import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { chromePath } from '../tests/chrome.ts';

const icons: [size: string, source: string, viewBox: string][] = [
  ['128', 'icon.svg', '0 0 128 128'],
  ['96', 'icon.svg', '0 0 128 128'],
  ['48', 'icon.svg', '12 12 104 104'],
  ['32', 'icon.svg', '16 16 96 96'],
  ['16', 'icon-16.svg', '0 0 16 16'],
];

const browser = await chromium.launch({ executablePath: chromePath() });
const page = await browser.newPage();
for (const [size, source, viewBox] of icons) {
  const svg = readFileSync(new URL(source, import.meta.url), 'utf8').replace(
    /viewBox="[^"]*"/,
    `viewBox="${viewBox}" width="${size}" height="${size}"`,
  );
  await page.setContent(svg);
  await page
    .locator('svg')
    .screenshot({ path: `public/icon/${size}.png`, omitBackground: true });
}
await browser.close();
