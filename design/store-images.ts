// Renders the Chrome Web Store images into store/: the 1280×800 screenshots, the
// small promo tile and the marquee. Each is built from the extension running on
// the made-up dashboard (store-demo.ts), laid out by store-slides.ts.
//
//   npm run store-images
//
// Look over every image before uploading: they're meant to hold no real data.

import type { BrowserContext, Locator } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { extensionId, launchWithExtension } from '../tests/chrome.ts';
import { openDashboard } from './store-demo.ts';
import {
  type Box,
  type Theme,
  THEMES,
  type Shots,
  slides,
  VIEWPORT,
} from './store-slides.ts';

const EXTENSION = resolve('.output/chrome-mv3');
const OUT = 'store';

declare const chrome: {
  storage: { sync: { set(items: Record<string, unknown>): Promise<void> } };
};

async function settings(
  context: BrowserContext,
  values: Record<string, boolean | string>,
): Promise<void> {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId(EXTENSION)}/popup.html`);
  await popup.evaluate((v) => chrome.storage.sync.set(v), values);
  await popup.close();
}

async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox();
  if (!found) throw new Error(`${locator.toString()} isn't on screen`);
  return found;
}

// Every feature on: the slides crop what they show out of these.
const FEATURES = {
  cardGrades: true,
  cardAssignments: true,
  courseNav: true,
  tidySidebar: true,
};

async function dashboard(context: BrowserContext, theme: Theme) {
  await settings(context, { ...FEATURES, theme });
  const page = await context.newPage();
  await page.setViewportSize(VIEWPORT);
  await openDashboard(page);
  await page.locator('.cpp-nav').first().waitFor();
  await page.locator('.cpp-todo li').first().waitFor();
  await page.locator('.cpp-feedback li').first().waitFor();
  const cards = page.locator('.ic-DashboardCard');
  const regions = {
    cards: await Promise.all((await cards.all()).map(box)),
    todo: await box(page.locator('.cpp-todo')),
    feedback: await box(page.locator('.cpp-feedback')),
  };
  const palette = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(`--cpp-${name}`);
    return {
      bg: token('bg'),
      border: token('border'),
      text: token('text'),
      muted: token('muted'),
      link: token('link'),
    };
  });
  const shot = await page.screenshot();
  await page.close();
  return { look: { shot, palette }, regions };
}

async function popupShots(context: BrowserContext): Promise<Shots['popups']> {
  await settings(context, { ...FEATURES, theme: 'sea' });
  const popup = await context.newPage();
  await popup.emulateMedia({ colorScheme: 'dark' });
  await popup.goto(`chrome-extension://${extensionId(EXTENSION)}/popup.html`);
  const shot = () => popup.locator('main').screenshot();
  const open = (name: string) =>
    popup.getByRole('button', { name, exact: true }).click();
  const back = () => popup.getByRole('button', { name: 'Back' }).click();
  // onto the header's name, so nothing is highlighted
  const rest = () => popup.mouse.move(144, 20);

  await popup.getByRole('button', { name: 'Appearance' }).waitFor();
  await open('Dashboard');
  await rest();
  const features = await shot();
  await back();
  await open('Appearance');
  await open('Themes');
  await popup
    .getByRole('switch', { name: 'Deep Sea', checked: true })
    .waitFor();
  // the page scrolls, and the theme that's on is at the end of it
  await popup.locator('[class*="overflow-y-auto"]:visible').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await rest();
  const themes = await shot();
  await popup.close();
  return { features, themes };
}

// twice the pixels, so shots stay sharp when the slides scale them
const context = await launchWithExtension(EXTENSION, { deviceScaleFactor: 2 });

const looks = {} as Shots['looks'];
let regions: Shots['regions'] | undefined;
for (const theme of THEMES) {
  const captured = await dashboard(context, theme);
  looks[theme] = captured.look;
  regions = captured.regions;
}
if (!regions) throw new Error('no themes to capture');
const shots: Shots = {
  looks,
  regions,
  popups: await popupShots(context),
};

mkdirSync(`${OUT}/screenshots`, { recursive: true });
const page = await context.newPage();
for (const { file, width, height, html } of slides(shots)) {
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${file}`, scale: 'css' });
}
await context.close();
