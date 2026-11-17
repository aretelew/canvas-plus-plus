// The Rich Content Editor's toolbar (TinyMCE) colors its buttons and fills
// their icons with the same dark grey, each written out: not currentColor,
// though computed styles can't tell the two apart. The icons must still turn
// light with the button's text, or they're dark on the dark toolbar.

import { expect, test } from '../extension';
import { tokenColor } from '../tokens';

const URL = 'https://fixture.instructure.com/rce-toolbar';

// TinyMCE's own rules for a toolbar button (oxide skin)
const PAGE = `<!doctype html><title>t</title>
<style>
  .tox .tox-toolbar { background: #fff; }
  .tox .tox-tbtn { background: 0 0; border: 0; color: #222f3e; width: 34px; height: 34px; }
  .tox .tox-tbtn svg { display: block; fill: #222f3e; }
  .tox .tox-tbtn:hover { background: #dee0e2; }
</style>
<body>
  <div class="tox"><div class="tox-toolbar">
    <button class="tox-tbtn" id="italic"><svg width="24" height="24"><path id="icon" d="M0 0h24v24H0z"/></svg></button>
  </div></div>
</body>`;

test.beforeEach(async ({ page, setTheme }) => {
  await setTheme('dark');
  await page.route(URL, (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGE }),
  );
  await page.goto(URL);
  await expect(page.locator('#italic')).toHaveAttribute('data-cpp-fg');
});

test("a toolbar icon is filled with the theme's text", async ({ page }) => {
  const text = await tokenColor(page, '--cpp-text');
  await expect
    .poll(() =>
      page.locator('#icon').evaluate((el) => getComputedStyle(el).fill),
    )
    .toBe(text);
});
