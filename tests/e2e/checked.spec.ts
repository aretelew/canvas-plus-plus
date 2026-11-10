// A quiz's answers, as InstUI draws them: a facade beside each hidden input,
// restyled through :checked with no class to go with it.
//
// On screen, a selected radio's black ring is recolored by recolor.ts, which
// tags each element once, so the facade must be looked at again when its input
// is checked, and so must the radio that unchecks beside it. A checked
// checkbox's dark fill is themed by theme.css.
//
// On paper, the theme is off: its dark fills would print as solid marks, so
// every unselected answer would look filled in.

import { expect, test } from '../extension';
import { tokenColor } from '../tokens';

const URL = 'https://fixture.instructure.com/checked';

// a multiple choice question (radios) and a multiple answer one (checkboxes:
// InstUI fills the checked box with Canvas's dark text grey behind a white
// check, drawn in currentColor)
const PAGE = `<!doctype html><title>t</title>
<style>
  input { position: absolute; opacity: 0; }
  .facade, .css-1-checkboxFacade__facade {
    display: inline-block; width: 20px; height: 20px;
    border: 2px solid #6b7780; background: #fff; color: #fff;
  }
  .facade { border-radius: 50%; }
  input:checked + label .facade {
    border-color: #000; box-shadow: inset 0 0 0 4px #000;
  }
  input:checked + label .css-1-checkboxFacade__facade {
    background: #273540; border-color: #273540;
  }
</style>
<body>
  <div><input type="radio" name="q3" id="a"><label for="a"><span class="facade" id="facade-a"></span> No impact</label></div>
  <div><input type="radio" name="q3" id="b"><label for="b"><span class="facade" id="facade-b"></span> 512</label></div>
  <div><input type="checkbox" id="c"><label for="c"><span class="css-1-checkboxFacade__facade" id="facade-c"></span> Using a mutex</label></div>
  <div><input type="checkbox" id="d"><label for="d"><span class="css-1-checkboxFacade__facade" id="facade-d"></span> Using a monitor</label></div>
</body>`;

const colors = (el: Element) => {
  const { backgroundColor, borderTopColor, boxShadow, color } =
    getComputedStyle(el);
  return { backgroundColor, borderTopColor, boxShadow, color };
};

test.beforeEach(async ({ page, setTheme }) => {
  await setTheme('dark');
  await page.route(URL, (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGE }),
  );
  await page.goto(URL);
  await expect(page.locator('#facade-d')).toHaveAttribute('data-cpp-border');
});

test("a checked radio's ring takes the theme's strongest mark", async ({
  page,
}) => {
  const emphasis = await tokenColor(page, '--cpp-emphasis');
  const ring = (id: string) =>
    page
      .locator(`#facade-${id}`)
      .evaluate(colors)
      .then(({ boxShadow }) => boxShadow);

  await page.locator('#a').check({ force: true });
  await expect.poll(() => ring('a')).toBe(`${emphasis} 0px 0px 0px 4px inset`);

  // choosing another answer moves the ring, and the first is back to none
  await page.locator('#b').check({ force: true });
  await expect.poll(() => ring('b')).toBe(`${emphasis} 0px 0px 0px 4px inset`);
  await expect.poll(() => ring('a')).toBe('none');
});

test('a checked checkbox fills with the strongest mark', async ({ page }) => {
  const [emphasis, bg] = await Promise.all([
    tokenColor(page, '--cpp-emphasis'),
    tokenColor(page, '--cpp-bg'),
  ]);

  await page.locator('#c').check({ force: true });
  await expect
    .poll(() => page.locator('#facade-c').evaluate(colors))
    .toMatchObject({
      backgroundColor: emphasis,
      borderTopColor: emphasis,
      color: bg,
    });
});

test('a printed quiz shows its answers in Canvas’s own colors', async ({
  page,
}) => {
  await page.locator('#a').check({ force: true });
  await page.locator('#c').check({ force: true });
  const facade = (id: string) => page.locator(`#facade-${id}`).evaluate(colors);
  const unchecked = {
    backgroundColor: 'rgb(255, 255, 255)',
    borderTopColor: 'rgb(107, 119, 128)',
    boxShadow: 'none',
  };

  await page.emulateMedia({ media: 'print' });
  expect(await facade('a')).toMatchObject({
    backgroundColor: 'rgb(255, 255, 255)',
    borderTopColor: 'rgb(0, 0, 0)',
    boxShadow: 'rgb(0, 0, 0) 0px 0px 0px 4px inset',
  });
  expect(await facade('b')).toMatchObject(unchecked);
  expect(await facade('c')).toMatchObject({
    backgroundColor: 'rgb(39, 53, 64)',
    borderTopColor: 'rgb(39, 53, 64)',
  });
  expect(await facade('d')).toMatchObject(unchecked);

  // back on screen, the theme is as it was
  await page.emulateMedia({ media: 'screen' });
  const [emphasis, bg] = await Promise.all([
    tokenColor(page, '--cpp-emphasis'),
    tokenColor(page, '--cpp-bg'),
  ]);
  await expect
    .poll(() => facade('a'))
    .toMatchObject({
      backgroundColor: bg,
      boxShadow: `${emphasis} 0px 0px 0px 4px inset`,
    });
  expect(await facade('b')).toMatchObject({ backgroundColor: bg });
  expect(await facade('c')).toMatchObject({ backgroundColor: emphasis });
});
