// Canvas also changes colors by moving a class: clicking an item in the global
// nav moves its white "active" highlight there. recolor.ts tags each element
// once, so such an element must be looked at again when its class changes.

import { expect, test } from '../extension';

const URL = 'https://fixture.instructure.com/class-change';

// the global nav as Canvas draws it: navy, with the active link white
const PAGE = `<!doctype html><title>t</title>
<style>
  nav { background: #0a2a5c; }
  a { display: block; padding: 8px; color: #fff; }
  .active a { background: #fff; color: #2d3b45; }
</style>
<body>
  <nav>
    <div id="inbox" class="active"><a href="#">Inbox</a></div>
    <div id="groups"><a href="#">Groups</a></div>
  </nav>
</body>`;

test.beforeEach(async ({ page, setTheme }) => {
  await setTheme('dark');
  await page.route(URL, (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGE }),
  );
  await page.goto(URL);
  await expect(page.locator('#inbox a')).toHaveAttribute('data-cpp-bg');
});

test('moving the active class moves the dark highlight', async ({ page }) => {
  await page.evaluate(() => {
    document.querySelector('#inbox')?.classList.remove('active');
    document.querySelector('#groups')?.classList.add('active');
  });
  const background = (selector: string) =>
    page
      .locator(selector)
      .evaluate((el) => getComputedStyle(el).backgroundColor);
  // the new highlight is dark like the old one was
  await expect
    .poll(() => background('#groups a'))
    .toBe(
      await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
    );
  // the old one is back to Canvas's own (the navy shows through)
  expect(await background('#inbox a')).toBe('rgba(0, 0, 0, 0)');
});
