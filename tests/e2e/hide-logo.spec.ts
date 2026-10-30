// The school's logo at the top of the global nav hides while the setting is
// on, and the nav's buttons below it stay where they were.

import type { Page } from '@playwright/test';
import { expect, test } from '../extension';

const URL = 'https://fixture.instructure.com/';

// Canvas's global nav, cut down to the logo and one button
const PAGE = `<!doctype html><title>Dashboard</title>
<header id="header" class="ic-app-header">
  <div class="ic-app-header__main-navigation">
    <div class="ic-app-header__logomark-container" style="height: 85px">
      <a href="/" class="ic-app-header__logomark">School</a>
    </div>
    <ul id="menu" class="ic-app-header__menu-list">
      <li><a id="global_nav_dashboard_link" href="/">Dashboard</a></li>
    </ul>
  </div>
</header>`;

const buttonTop = async (page: Page) =>
  (await page.locator('#global_nav_dashboard_link').boundingBox())?.y;

test.beforeEach(async ({ page }) => {
  await page.route(URL, (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGE }),
  );
});

test.afterEach(async ({ setHideLogo }) => {
  await setHideLogo(false);
});

test('hides the logo without moving the nav buttons', async ({
  page,
  setHideLogo,
}) => {
  await page.goto(URL);
  const logo = page.locator('.ic-app-header__logomark');
  await expect(logo).toBeVisible();
  const before = await buttonTop(page);

  await setHideLogo(true);
  await expect(logo).toBeHidden();
  expect(await buttonTop(page)).toBe(before);

  await setHideLogo(false);
  await expect(logo).toBeVisible();
});

test('stays hidden on the next page load', async ({ page, setHideLogo }) => {
  await setHideLogo(true);
  await page.goto(URL);
  await expect(page.locator('.ic-app-header__logomark')).toBeHidden();
});

// The theme tags <html> too, taking its old tags off first: when it's turned
// on, and again whenever Canvas changes <html>'s class.
test('stays hidden with the dark theme on', async ({
  page,
  setHideLogo,
  setTheme,
}) => {
  const nextFrame = () =>
    page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve)),
    );
  await setHideLogo(true);
  await page.goto(URL);
  await setTheme('dark');
  await expect(page.locator('html')).toHaveAttribute('data-cpp-theme');
  await nextFrame();
  await page.evaluate(() => {
    document.documentElement.classList.add('touch');
  });
  await nextFrame();
  await expect(page.locator('.ic-app-header__logomark')).toBeHidden();
  await setTheme('off');
});
