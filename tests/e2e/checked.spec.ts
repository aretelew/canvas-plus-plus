// Checking a radio button or checkbox restyles it through :checked: Canvas's
// round facade sits beside the real input and draws the selected radio's black
// ring only while the input is checked, with no class to go with it.
// recolor.ts tags each element once, so the facade must be looked at again
// when its input is checked, and so must the radio that unchecks beside it.

import { expect, test } from '../extension';
import { tokenColor } from '../tokens';

const URL = 'https://fixture.instructure.com/checked';

// a New Quizzes multiple choice question, as InstUI draws it
const PAGE = `<!doctype html><title>t</title>
<style>
  input { position: absolute; opacity: 0; }
  .facade {
    display: inline-block; width: 20px; height: 20px; border-radius: 50%;
    border: 2px solid #6b7780; background: #fff;
  }
  input:checked + label .facade {
    border-color: #000; box-shadow: inset 0 0 0 4px #000;
  }
</style>
<body>
  <div><input type="radio" name="q3" id="a"><label for="a"><span class="facade" id="facade-a"></span> No impact</label></div>
  <div><input type="radio" name="q3" id="b"><label for="b"><span class="facade" id="facade-b"></span> 512</label></div>
</body>`;

const ring = (el: Element) => getComputedStyle(el).boxShadow;

test.beforeEach(async ({ page, setTheme }) => {
  await setTheme(true);
  await page.route(URL, (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGE }),
  );
  await page.goto(URL);
  await expect(page.locator('#facade-a')).toHaveAttribute('data-cpp-border');
});

test("a checked radio's ring takes the theme's strongest mark", async ({
  page,
}) => {
  const emphasis = await tokenColor(page, '--cpp-emphasis');

  await page.locator('#a').check({ force: true });
  await expect
    .poll(() => page.locator('#facade-a').evaluate(ring))
    .toBe(`${emphasis} 0px 0px 0px 4px inset`);

  // choosing another answer moves the ring, and the first is back to none
  await page.locator('#b').check({ force: true });
  await expect
    .poll(() => page.locator('#facade-b').evaluate(ring))
    .toBe(`${emphasis} 0px 0px 0px 4px inset`);
  await expect
    .poll(() => page.locator('#facade-a').evaluate(ring))
    .toBe('none');
});
