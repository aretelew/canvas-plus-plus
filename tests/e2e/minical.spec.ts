// The calendar's small month (#minical), on a synthetic page with Canvas's
// own markup and rules for it: the theme rings days with events on their
// number, in its border color, and circles today in its link color.

import type { Page } from '@playwright/test';
import { expect, test } from '../extension';
import { tokenColor } from '../tokens';

const URL = 'https://fixture.instructure.com/calendar';

// a day as Canvas draws it: an empty background cell, which carries `event`,
// under a cell with the number's button; both carry `fc-today`
const day = (date: string, { today = false, event = false } = {}) => {
  const todayClass = today ? ' fc-today' : '';
  const eventClass = event ? ' event' : '';
  return {
    bg: `<td class="fc-day fc-widget-content${todayClass}${eventClass}" data-date="${date}"></td>`,
    top: `<td class="fc-day-top${todayClass}" data-date="${date}"><button class="day-wrapper-button fc-day-number"><span class="day-number-text">${date.slice(-2)}</span></button></td>`,
  };
};
const DAYS = [
  day('2026-11-04'),
  day('2026-11-05', { today: true, event: true }),
  day('2026-11-06', { event: true }),
];

const PAGE = `<!doctype html><title>Calendar</title>
<style>
  /* Canvas's rules for the small month (agenda_view.css) */
  #minical { width: 230px; background-color: #fff; border: 1px solid #e8eaec; }
  #minical .fc-row { position: relative; height: 25px; }
  #minical .fc-bg { position: absolute; inset: 0; }
  #minical table { width: 100%; border-spacing: 8px 2px; table-layout: fixed; }
  #minical .fc-widget-content { background: none; border: 1px solid #fff; }
  #minical .event { position: relative; }
  #minical .event::after {
    position: absolute; top: 1px; left: 1px; height: 1.2em; right: 1px;
    border: 1px solid #273540; content: " ";
  }
  #minical .day-wrapper-button {
    border: none; background: rgba(0, 0, 0, 0); padding: 0; margin: 0;
    font: inherit; color: inherit; display: inline-block; text-align: center;
    width: 24px; height: 24px; line-height: 24px;
  }
  #minical .day-number-text { display: block; width: 100%; height: 100%; }
  #minical .fc-today .day-number-text {
    border-radius: 50%; background: #003071; color: #fff;
  }
  #minical td { padding: 0; }
  #minical .fc-content-skeleton { position: relative; }
</style>
<body>
  <div id="minical">
    <div class="fc-row">
      <div class="fc-bg"><table><tr>${DAYS.map((d) => d.bg).join('')}</tr></table></div>
      <div class="fc-content-skeleton"><table><tr>${DAYS.map((d) => d.top).join('')}</tr></table></div>
    </div>
  </div>
</body>`;

test.beforeEach(async ({ page }) => {
  await page.route(URL, (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGE }),
  );
});

test.afterEach(async ({ setTheme }) => {
  await setTheme('off');
});

// the middle of a day's number, and of its event ring (an ::after can't be
// located, so its offsets are read from its computed style)
const centers = (page: Page, date: string) =>
  page.evaluate((date) => {
    const bg = document.querySelector(`.fc-bg [data-date="${date}"]`);
    const button = document.querySelector(
      `.fc-content-skeleton [data-date="${date}"] button`,
    );
    if (!bg || !button) throw new Error(`no ${date}`);
    const cell = bg.getBoundingClientRect();
    const ring = getComputedStyle(bg, '::after');
    const border = parseFloat(getComputedStyle(bg).borderLeftWidth);
    const number = button.getBoundingClientRect();
    return {
      number: {
        x: number.x + number.width / 2,
        y: number.y + number.height / 2,
      },
      ring: {
        x: cell.x + border + parseFloat(ring.left) + parseFloat(ring.width) / 2,
        y: cell.y + border + parseFloat(ring.top) + parseFloat(ring.height) / 2,
      },
      color: ring.borderTopColor,
    };
  }, date);

test('a day with events is ringed on its number, in the border color', async ({
  page,
  setTheme,
}) => {
  await setTheme('dark');
  await page.goto(URL);
  const { number, ring, color } = await centers(page, '2026-11-06');
  // within a pixel: Canvas's cells fall on half pixels
  expect(Math.abs(ring.x - number.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(ring.y - number.y)).toBeLessThanOrEqual(1);
  expect(color).toBe(await tokenColor(page, '--cpp-border-strong'));
});

test("today is circled in the link color, not the school's button color", async ({
  page,
  setTheme,
}) => {
  await setTheme('dark');
  await page.goto(URL);
  const today = page.locator('.fc-day-top.fc-today .day-number-text');
  await expect(today).toHaveCSS(
    'background-color',
    await tokenColor(page, '--cpp-link'),
  );
  await expect(today).toHaveCSS('color', await tokenColor(page, '--cpp-bg'));
});

test('with the theme off, Canvas keeps its own marks', async ({ page }) => {
  await page.goto(URL);
  const { color } = await centers(page, '2026-11-06');
  expect(color).toBe('rgb(39, 53, 64)');
  await expect(page.locator('.fc-day-top.fc-today .day-number-text')).toHaveCSS(
    'background-color',
    'rgb(0, 48, 113)',
  );
});
