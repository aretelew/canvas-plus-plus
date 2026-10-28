// The no-flash guarantee, checked in a real browser on a synthetic page (no
// personal data, so it runs anywhere). The first requestAnimationFrame runs
// before the first paint, so whatever it sees is what the user sees first.
// This catches the CSS or script landing too late; on a page this small,
// extension storage beats the first frame anyway, so the cached-copy path
// itself is covered by src/features/themes/page.test.ts instead.

import type { Page } from '@playwright/test';
import { expect, test } from '../extension';

const URL = 'https://fixture.instructure.com/first-paint';

// a browser nothing ran in yet: no stored setting, no cached copy on the page
test.use({ isolated: true });

test.beforeEach(async ({ page }) => {
  await page.route(URL, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>t</title><body><p>Canvas</p></body>',
    }),
  );
  await page.addInitScript(() => {
    requestAnimationFrame(() => {
      document.documentElement.dataset.firstFrameBg = getComputedStyle(
        document.body,
      ).backgroundColor;
    });
  });
});

const firstFrameBg = (page: Page) =>
  page.locator('html[data-first-frame-bg]').getAttribute('data-first-frame-bg');

test('stays out of the way while off', async ({ page }) => {
  await page.goto(URL);
  expect(await firstFrameBg(page)).toBe('rgba(0, 0, 0, 0)');
  await expect(page.locator('html')).not.toHaveAttribute('data-cpp-theme');
});

test('is dark from the first frame on reload', async ({ page, setTheme }) => {
  await setTheme(true);
  await page.goto(URL);
  await expect(page.locator('html')).toHaveAttribute('data-cpp-theme', 'dark');

  await page.reload();
  expect(await firstFrameBg(page)).toBe('rgb(21, 23, 28)');
});

test('follows the switch without a reload', async ({ page, setTheme }) => {
  await page.goto(URL);
  await setTheme(true);
  await expect(page.locator('html')).toHaveAttribute('data-cpp-theme', 'dark');
  await setTheme(false);
  await expect(page.locator('html')).not.toHaveAttribute('data-cpp-theme');
});

test('is true black from the first frame with OLED on', async ({
  page,
  setTheme,
  setOled,
}) => {
  await setTheme(true);
  await setOled(true);
  await page.goto(URL);
  await expect(page.locator('html')).toHaveAttribute('data-cpp-theme', 'oled');

  await page.reload();
  expect(await firstFrameBg(page)).toBe('rgb(0, 0, 0)');
});
