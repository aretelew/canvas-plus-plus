// Canvas also colors some elements with an inline style: the inbox marks the
// selected conversation by setting a light blue background on its row's div,
// with no class to go with it. recolor.ts tags each element once, so such an
// element must be looked at again when its inline colors change.

import { expect, test } from '../extension';
import { tokenColor } from '../tokens';

const URL = 'https://fixture.instructure.com/inline-style';

// an inbox row as Canvas draws it: dark text, selected by an inline background
const PAGE = `<!doctype html><title>t</title>
<style>
  .row { padding: 8px; color: #2d3b45; transition: background-color 0.2s; }
</style>
<body>
  <div class="row" id="first">Peter Hovmand</div>
  <div class="row" id="second">Course evaluations</div>
</body>`;

const background = (el: Element) => getComputedStyle(el).backgroundColor;

test.beforeEach(async ({ page, setTheme }) => {
  await setTheme('dark');
  await page.route(URL, (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGE }),
  );
  await page.goto(URL);
  await expect(page.locator('#first')).toHaveAttribute('data-cpp-fg');
});

test('a row selected by an inline background takes the hover tint', async ({
  page,
}) => {
  await page.evaluate(() => {
    const row = document.querySelector<HTMLElement>('#first');
    if (row) row.style.backgroundColor = 'rgb(229,242,248)';
  });
  // the hover tint, as a row lit up on hover has it
  const hover = await tokenColor(page, '--cpp-hover');
  await expect
    .poll(() => page.locator('#first').evaluate(background))
    .toBe(hover);

  // and back to Canvas's own when it's deselected
  await page.evaluate(() => {
    document
      .querySelector<HTMLElement>('#first')
      ?.style.removeProperty('background-color');
  });
  await expect
    .poll(() => page.locator('#first').evaluate(background))
    .toBe('rgba(0, 0, 0, 0)');
});

test('the styles recolor.ts sets itself are not looked at again', async ({
  page,
}) => {
  await page.evaluate(() => {
    const row = document.querySelector<HTMLElement>('#first');
    if (row) row.style.backgroundColor = 'rgb(229,242,248)';
  });
  await expect(page.locator('#first')).toHaveAttribute('data-cpp-bg');
  // its custom properties and the transitions it pauses are inline styles too:
  // looking again at those would retag the row every frame
  const retags = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let count = 0;
        new MutationObserver((records) => {
          count += records.length;
        }).observe(document.body, {
          subtree: true,
          attributeFilter: ['data-cpp-bg', 'data-cpp-fg'],
        });
        setTimeout(() => {
          resolve(count);
        }, 500);
      }),
  );
  expect(retags).toBe(0);
});
