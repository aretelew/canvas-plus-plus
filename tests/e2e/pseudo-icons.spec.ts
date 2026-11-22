// Canvas's icon font draws each glyph in ::before, and some icons give that
// glyph a grey of its own (the Grades page's rubric and comment buttons:
// `.standalone-icon::before { color: #555 }`). With the theme on, the glyph
// takes the theme's color like the text beside it, not Canvas's dark grey.

import type { Page } from '@playwright/test';
import { expect, test } from '../extension';

const URL = 'https://fixture.instructure.com/pseudo-icons';

// - the Grades page's comment button: a #555 glyph beside #474747 text
// - a glyph that writes the same grey as its element's own, which computed
//   styles can't tell from inheriting it
// - a clearfix, whose empty ::after draws nothing
const PAGE = `<!doctype html><title>t</title>
<style>
  body { color: #2d3b45; }
  .button { color: #474747; background: #f2f4f4; border: 1px solid #e8eaec; }
  .icon::before { content: "+"; color: #555; }
  .same { color: #555; }
  .same::before { content: "+"; color: #555; }
  .clearfix::after { content: ""; display: table; clear: both; }
</style>
<body>
  <a class="button" href="#"><i class="icon"></i> <span class="count">1</span></a>
  <p class="same">Same grey</p>
  <div class="clearfix">Clearfix</div>
</body>`;

const glyph = (page: Page, selector: string) =>
  page
    .locator(selector)
    .evaluate((el) => getComputedStyle(el, '::before').color);
const text = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => getComputedStyle(el).color);

test.beforeEach(async ({ page, setTheme }) => {
  await setTheme('dark');
  await page.route(URL, (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGE }),
  );
  await page.goto(URL);
  await expect(page.locator('.icon')).toHaveAttribute('data-cpp-pseudo-fg');
});

test('an icon glyph takes the color of the text beside it', async ({
  page,
}) => {
  expect(await glyph(page, '.icon')).toBe(await text(page, '.count'));
  expect(await glyph(page, '.icon')).not.toBe('rgb(85, 85, 85)');
});

test("a glyph that writes its element's grey again follows it", async ({
  page,
}) => {
  expect(await glyph(page, '.same')).toBe(await text(page, '.same'));
  expect(await glyph(page, '.same')).not.toBe('rgb(85, 85, 85)');
});

test('an empty pseudo-element is left alone', async ({ page }) => {
  await expect(page.locator('.clearfix')).not.toHaveAttribute(
    'data-cpp-pseudo-fg',
  );
});

test('turning the theme off gives the glyph its grey back', async ({
  page,
  setTheme,
}) => {
  await setTheme('off');
  await expect.poll(() => glyph(page, '.icon')).toBe('rgb(85, 85, 85)');
});
