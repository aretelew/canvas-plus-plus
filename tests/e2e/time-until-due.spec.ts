// Due dates are followed by how long is left: from the exact time in
// Canvas's <time datetime> on an assignment's page and the assignments list,
// and from Canvas's assignment_info request on the modules page, whose dates
// are only days. In a row of details it's a detail of its own, between
// Canvas's separators. Past dates get none.

import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../extension';

const ORIGIN = 'https://fixture.instructure.com';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// the content script runs on the real clock; half an hour over, so a slow
// test still rounds down to the same hour
const fromNow = (ms: number) =>
  new Date(Date.now() + ms + HOUR / 2).toISOString();

// Canvas's date component, as it draws it
const friendly = (iso: string, attrs = '') => `
  <span data-testid="friendly-date-time">
    <span class="screenreader-only">Due: soon</span>
    <time ${attrs} datetime="${iso}" aria-hidden="true">Due: soon</time>
  </span>`;

const ASSIGNMENT = `<!doctype html><title>Homework 3</title>
<div id="content">
  <h1>Homework 3</h1>
  <span data-testid="assignment-sub-header" style="color: rgb(45, 59, 69)">${friendly(fromNow(5 * HOUR), 'data-testid="due-date"')}</span>
</div>`;

const row = (title: string, iso: string) => `
  <li><a class="ig-title">${title}</a>
    <div class="ig-details">
      <div class="ig-details__item assignment-date-due"><span>Due</span> ${friendly(iso)}</div>
      <div class="ig-details__item js-score">-/9 pts</div>
    </div>
  </li>`;

// Canvas's separators between details, which take the row's color
const ASSIGNMENTS = `<!doctype html><title>Assignments</title>
<style>
  .ig-details { color: rgb(107, 119, 128); }
  .ig-details__item:after { content: "  |  "; }
</style>
<div id="content"><ul>
  ${row('Lab 4', fromNow(3 * DAY))}
  ${row('Quiz 5', fromNow(5 * HOUR))}
  ${row('Midterm 2', fromNow(-2 * DAY))}
</ul></div>`;

// the days are filled in after the page loads (fillModuleDates)
const MODULES = `<!doctype html><title>Modules</title>
<div id="content">
  <div class="ig-details">
    <div id="module-item-11-due-date" class="due_date_display ig-details__item"></div>
  </div>
  <div class="ig-details">
    <div id="module-item-12-due-date" class="due_date_display ig-details__item"></div>
  </div>
</div>`;

const timeLeft = (page: Page) => page.locator('.cpp-time-left');

// a label's separator, drawn before it or after it
const separator = (label: Locator, side: '::before' | '::after') =>
  label.evaluate((element, side) => {
    const style = getComputedStyle(element, side);
    return { content: style.content, color: style.color };
  }, side);

async function fillModuleDates(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const date of document.querySelectorAll('.due_date_display')) {
      date.textContent = 'Dec 4';
    }
  });
}

test.beforeEach(async ({ page }) => {
  const pages: Record<string, string> = {
    '/courses/1/assignments/3': ASSIGNMENT,
    '/courses/1/assignments': ASSIGNMENTS,
    '/courses/1/modules': MODULES,
  };
  for (const [path, body] of Object.entries(pages)) {
    await page.route(`${ORIGIN}${path}`, (route) =>
      route.fulfill({ contentType: 'text/html', body }),
    );
  }
  await page.route(
    `${ORIGIN}/courses/1/modules/items/assignment_info`,
    (route) =>
      route.fulfill({
        json: {
          '11': { due_date: fromNow(10 * DAY), points_possible: 5 },
          '12': { due_date: null, points_possible: null },
        },
      }),
  );
});

test.afterEach(async ({ setTimeUntilDue }) => {
  await setTimeUntilDue(false);
});

test("an assignment's due date says how long is left, red within a day", async ({
  page,
  setTimeUntilDue,
}) => {
  await setTimeUntilDue(true);
  await page.goto(`${ORIGIN}/courses/1/assignments/3`);
  await expect(timeLeft(page)).toHaveText('in 5 hours');
  await expect(timeLeft(page)).toHaveClass(/cpp-soon/);
  await expect(timeLeft(page).locator('span')).toHaveCSS(
    'color',
    'rgb(199, 31, 35)',
  );
  // nothing follows the date here, so it brings its own separator, in the
  // date's color
  expect(await separator(timeLeft(page), '::before')).toEqual({
    content: '"|"',
    color: 'rgb(45, 59, 69)',
  });
});

test('the assignments list labels upcoming work and not past work', async ({
  page,
  setTimeUntilDue,
}) => {
  await setTimeUntilDue(true);
  await page.goto(`${ORIGIN}/courses/1/assignments`);
  const lab = page.getByRole('listitem').filter({ hasText: 'Lab 4' });
  // a detail of its own, between the date and the points
  await expect(
    lab.locator('.assignment-date-due + .ig-details__item.cpp-time-left'),
  ).toHaveText('in 3 days');
  await expect(lab.locator('.ig-details__item')).toHaveText([
    /Due/,
    'in 3 days',
    '-/9 pts',
  ]);
  await expect(lab.locator('.cpp-time-left')).not.toHaveClass(/cpp-soon/);
  // within a day its text is red, and Canvas's separator after it isn't
  const quiz = page
    .getByRole('listitem')
    .filter({ hasText: 'Quiz 5' })
    .locator('.cpp-time-left');
  await expect(quiz).toHaveText('in 5 hours');
  await expect(quiz.locator('span')).toHaveCSS('color', 'rgb(199, 31, 35)');
  expect(await separator(quiz, '::after')).toEqual({
    content: '"  |  "',
    color: 'rgb(107, 119, 128)',
  });
  const midterm = page.getByRole('listitem').filter({ hasText: 'Midterm 2' });
  await expect(midterm.locator('.cpp-time-left')).toBeHidden();
});

test('module items get their time from Canvas once their day is shown', async ({
  page,
  setTimeUntilDue,
}) => {
  await setTimeUntilDue(true);
  await page.goto(`${ORIGIN}/courses/1/modules`);
  await fillModuleDates(page);
  await expect(
    page.locator('#module-item-11-due-date + .cpp-time-left'),
  ).toHaveText('in 10 days');
  // no due time from Canvas, no label
  await expect(timeLeft(page)).toHaveCount(1);
});

test('turning it off takes the labels away, and on brings them back', async ({
  page,
  setTimeUntilDue,
}) => {
  await setTimeUntilDue(true);
  await page.goto(`${ORIGIN}/courses/1/assignments/3`);
  await expect(timeLeft(page)).toHaveCount(1);
  await setTimeUntilDue(false);
  await expect(timeLeft(page)).toHaveCount(0);
  await setTimeUntilDue(true);
  await expect(timeLeft(page)).toHaveText('in 5 hours');
});
