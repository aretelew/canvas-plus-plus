// Canvas loads some of its stylesheets from script, after the page has
// started (the calendar's month grid gets its lines from one). recolor.ts may
// tag an element before such a sheet arrives, reading colors the sheet then
// changes, so what it tagged meanwhile must be looked at again once it loads.

import { expect, test } from '../extension';

const URL = 'https://fixture.instructure.com/late-stylesheet';
const SHEET = 'https://fixture.instructure.com/late.css';

// a cell with no border until the late sheet draws Canvas's light grey line
const PAGE = `<!doctype html><title>t</title>
<style>td { color: #2d3b45; }</style>
<body>
  <table><tr><td class="cell">27</td></tr></table>
  <script>
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '${SHEET}';
    document.head.append(link);
  </script>
</body>`;

test('a cell tagged before its stylesheet loads is tagged again', async ({
  page,
  setTheme,
}) => {
  await setTheme('dark');
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(SHEET, async (route) => {
    await held;
    await route.fulfill({
      contentType: 'text/css',
      body: '.cell { border-top: 1px solid #e8eaec; }',
    });
  });
  await page.route(URL, (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGE }),
  );
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  const cell = page.locator('.cell');
  // tagged while the sheet is still on its way: no border to read yet
  await expect(cell).toHaveAttribute('data-cpp-fg');
  await expect(cell).not.toHaveAttribute('data-cpp-border');

  release();
  await expect(cell).toHaveAttribute('data-cpp-border', 'border');
});
