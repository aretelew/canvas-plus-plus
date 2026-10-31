// Hover states, checked in a real browser on a synthetic page (no personal
// data, so it runs anywhere). recolor.ts looks at Canvas's own color for an
// element the first time it's hovered; that look must never reach the screen.

import type { Page } from '@playwright/test';
import { expect, test } from '../extension';

const URL = 'https://fixture.instructure.com/hover';

// Canvas's hover fades, so a light frame would show up as a white flash fading
// back to dark:
// - a radio button as New Quizzes draws it: a white circle that greys on hover
// - a table row: transparent, light blue on hover
// - a button as Canvas draws it, fading everything it changes
// The theme turns those fades off; a tray's slide stays.
const PAGE = `<!doctype html><title>t</title>
<style>
  label, table { color: #2d3b45; }
  .facade {
    display: inline-block; width: 20px; height: 20px; border-radius: 50%;
    border: 1px solid #6a7883; background: #fff;
    transition: background-color 0.2s ease-out;
  }
  label:hover .facade { background: #e0e0e0; }
  tr { transition: background-color 0.3s; }
  tr:hover { background: #e0ebf5; }
  .action { color: #2d3b45; background: #d0d0d0; transition: all 0.3s; }
  .action:hover { background: #a0a0a0; }
  .tray { color: #2d3b45; transition: transform 0.3s; }
  .tray.open { transform: translateX(100px); }
</style>
<body>
  <label><span class="facade"></span> An answer</label>
  <table><tr><td>Quiz</td><td>5 / 5</td></tr></table>
  <button class="action">Submit</button>
  <div class="tray">A tray</div>
</body>`;

test.beforeEach(async ({ page, setTheme }) => {
  await setTheme('dark');
  await page.route(URL, (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGE }),
  );
  await page.goto(URL);
  await expect(page.locator('.facade')).toHaveAttribute('data-cpp-bg');
});

// every painted background of the last element matching `selector` for half a
// second, from just before `act` runs
async function framesDuring(
  page: Page,
  selector: string,
  act: () => Promise<unknown>,
): Promise<string[]> {
  const sampling = page.evaluate(
    (selector) =>
      new Promise<string[]>((resolve) => {
        const frames: string[] = [];
        const start = performance.now();
        const sample = () => {
          const el = [...document.querySelectorAll(selector)].at(-1);
          // Everything here has Canvas's dark text, so recolor tags it. While
          // untagged, recolor's callback for this frame hasn't run yet, so
          // this isn't what gets painted (first-paint.spec.ts covers that).
          if (el?.hasAttribute('data-cpp-fg')) {
            frames.push(getComputedStyle(el).backgroundColor);
          }
          if (performance.now() - start < 500) requestAnimationFrame(sample);
          else resolve(frames);
        };
        requestAnimationFrame(sample);
      }),
    selector,
  );
  await act();
  const frames = await sampling;
  expect(frames.length).toBeGreaterThan(10);
  return frames;
}

test('the first hover never paints a light frame', async ({ page }) => {
  const frames = await framesDuring(page, '.facade', () =>
    page.locator('label').hover(),
  );
  expect(frames.filter(isLight)).toEqual([]);
});

test('a row that lights up on hover never flashes light', async ({ page }) => {
  const frames = await framesDuring(page, 'tr', () =>
    page.locator('tr').hover(),
  );
  expect(frames.filter(isLight)).toEqual([]);
});

for (const [name, selector, target] of [
  ['a row', 'tr', 'td'],
  ['a button', '.action', '.action'],
] as const) {
  test(`${name} changes color and changes back at once`, async ({ page }) => {
    const hovered = page.locator(target).first();
    await hovered.hover(); // the first hover is recolor's look, which never fades
    const clearing = await framesDuring(page, selector, () =>
      page.mouse.move(0, 0),
    );
    const lighting = await framesDuring(page, selector, () => hovered.hover());
    // the color before and the color after, nothing between
    expect(new Set(clearing).size).toBeLessThanOrEqual(2);
    expect(new Set(lighting).size).toBeLessThanOrEqual(2);
    expect(lighting.at(-1)).not.toBe(clearing.at(-1));
  });
}

test('what moves keeps its transition', async ({ page }) => {
  await expect(page.locator('.tray')).toHaveAttribute('data-cpp-fg');
  const positions = await page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const tray = document.querySelector<HTMLElement>('.tray');
        if (!tray) throw new Error('no tray');
        const seen: string[] = [];
        const start = performance.now();
        tray.classList.add('open');
        const sample = () => {
          seen.push(getComputedStyle(tray).transform);
          if (performance.now() - start < 200) requestAnimationFrame(sample);
          else resolve(seen);
        };
        requestAnimationFrame(sample);
      }),
  );
  expect(new Set(positions).size).toBeGreaterThan(2);
});

test('an element added later is dark from its first frame', async ({
  page,
}) => {
  const frames = await framesDuring(page, '.facade', () =>
    page.evaluate(() => {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<label><span class="facade"></span> Another answer</label>',
      );
    }),
  );
  expect(frames.filter(isLight)).toEqual([]);
});

// Dialogs (New Quizzes' "Confirm Submission") move focus inside as they
// open, before recolor has seen them; their white is their own color, not a
// focus state, so they must stay opaque instead of taking the hover tint.
test('a dialog that takes focus as it opens stays opaque', async ({ page }) => {
  const frames = await framesDuring(page, '.dialog', () =>
    page.evaluate(() => {
      document.body.insertAdjacentHTML(
        'beforeend',
        `<div class="dialog" style="background: #fff; color: #2d3b45;
           box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3)">
           Confirm Submission <button>Submit</button>
         </div>`,
      );
      document.querySelector<HTMLElement>('.dialog button')?.focus();
    }),
  );
  expect(frames.filter((css) => isLight(css) || alpha(css) < 1)).toEqual([]);
});

// mostly opaque and brighter than mid-grey
function isLight(css: string): boolean {
  const [r = 0, g = 0, b = 0, a = 1] = (css.match(/[\d.]+/g) ?? []).map(Number);
  return a >= 0.5 && Math.min(r, g, b) > 128;
}

function alpha(css: string): number {
  return (css.match(/[\d.]+/g) ?? []).map(Number)[3] ?? 1;
}
