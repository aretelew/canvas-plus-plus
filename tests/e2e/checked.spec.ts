// Checking a radio button or checkbox restyles it through :checked: InstUI's
// facade sits beside the real input and is drawn only while the input is
// checked, with no class to go with it. A selected radio's black ring is
// recolored by recolor.ts, which tags each element once, so the facade must be
// looked at again when its input is checked, and so must the radio that
// unchecks beside it. A checked checkbox's dark fill is themed by theme.css.

import type { Page } from '@playwright/test';
import { expect, test } from '../extension';
import { tokenColor } from '../tokens';

const URL = 'https://fixture.instructure.com/checked';

async function open(page: Page, body: string): Promise<void> {
  await page.route(URL, (route) =>
    route.fulfill({ contentType: 'text/html', body }),
  );
  await page.goto(URL);
}

// a New Quizzes multiple choice question, as InstUI draws it
const RADIO_PAGE = `<!doctype html><title>t</title>
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

test.beforeEach(async ({ setTheme }) => {
  await setTheme('dark');
});

test("a checked radio's ring takes the theme's strongest mark", async ({
  page,
}) => {
  await open(page, RADIO_PAGE);
  await expect(page.locator('#facade-a')).toHaveAttribute('data-cpp-border');
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

// a New Quizzes multiple answer question: InstUI fills the checked box with
// Canvas's dark text grey behind a white check (currentColor)
const CHECKBOX_PAGE = `<!doctype html><title>t</title>
<style>
  input { position: absolute; opacity: 0; }
  .css-1-checkboxFacade__facade {
    display: inline-flex; width: 20px; height: 20px; border-radius: 4px;
    border: 1px solid #6a7883; background: #fff; color: #fff;
  }
  input:checked + label .css-1-checkboxFacade__facade {
    background: #273540; border-color: #273540;
  }
</style>
<body>
  <div><input type="checkbox" id="c"><label for="c"><span class="css-1-checkboxFacade"><span class="css-1-checkboxFacade__facade" id="facade-c"><svg viewBox="0 0 10 10" fill="currentColor"><rect width="10" height="10"/></svg></span> Using a mutex</span></label></div>
</body>`;

test('a checked checkbox fills with the strongest mark', async ({ page }) => {
  await open(page, CHECKBOX_PAGE);
  const facade = page.locator('#facade-c');
  await expect(facade).toHaveAttribute('data-cpp-bg', 'control');
  const [emphasis, bg] = await Promise.all([
    tokenColor(page, '--cpp-emphasis'),
    tokenColor(page, '--cpp-bg'),
  ]);

  await page.locator('#c').check({ force: true });
  await expect
    .poll(() =>
      facade.evaluate((el) => {
        const { backgroundColor, borderTopColor, color } = getComputedStyle(el);
        return [backgroundColor, borderTopColor, color];
      }),
    )
    .toEqual([emphasis, emphasis, bg]);
});
