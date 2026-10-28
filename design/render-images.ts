// Renders the PNGs the extension and its store listing use from the SVGs in
// this folder: the icons in public/icon/ and the promo tile in store/.
//
//   npm run images
//
// Icons 128 and 96 keep the Chrome Web Store's 16px padding; smaller sizes
// crop it so the tile fills the toolbar slot, and 16 has its own pixel-grid
// drawing.

import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { chromePath } from '../tests/chrome.ts';

const icon = (size: string, source: string, viewBox: string) =>
  [`public/icon/${size}.png`, source, viewBox, size, size] as const;

const images: (readonly [
  out: string,
  source: string,
  viewBox: string,
  width: string,
  height: string,
])[] = [
  icon('128', 'icon.svg', '0 0 128 128'),
  icon('96', 'icon.svg', '0 0 128 128'),
  icon('48', 'icon.svg', '12 12 104 104'),
  icon('32', 'icon.svg', '16 16 96 96'),
  icon('16', 'icon-16.svg', '0 0 16 16'),
  ['store/promo-tile.png', 'promo-tile.svg', '0 0 440 280', '440', '280'],
];

const browser = await chromium.launch({ executablePath: chromePath() });
const page = await browser.newPage();
for (const [out, source, viewBox, width, height] of images) {
  const svg = readFileSync(new URL(source, import.meta.url), 'utf8').replace(
    /viewBox="[^"]*"/,
    `viewBox="${viewBox}" width="${width}" height="${height}"`,
  );
  await page.setContent(svg);
  await page.locator('svg').screenshot({ path: out, omitBackground: true });
}
await browser.close();
