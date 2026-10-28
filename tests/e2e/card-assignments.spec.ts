// Dashboard cards list each course's assignments from Canvas's planner API:
// overdue unfinished work, then what's due soon, with finished work struck
// through. A row's circle marks it done in Canvas (a planner override). The
// card's links move onto its color to make room.

import type { Page } from '@playwright/test';
import { expect, test } from '../extension';

const ORIGIN = 'https://fixture.instructure.com';
const DAY = 24 * 60 * 60 * 1000;
// the content script runs on the real clock
const inDays = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString();

// Canvas's card: its color at a fixed 146px, then the title, then its links
const card = (id: string, name: string) => `
  <div class="ic-DashboardCard" aria-label="${name}">
    <div class="ic-DashboardCard__header">
      <div class="ic-DashboardCard__header_hero" style="height: 146px"></div>
      <a class="ic-DashboardCard__link" href="/courses/${id}">${name}</a>
    </div>
    <nav class="ic-DashboardCard__action-container" aria-label="Actions for ${name}">
      <a class="ic-DashboardCard__action" href="/courses/${id}/announcements">Announcements</a>
    </nav>
  </div>`;

// the dashboard as the server sends it: Canvas's scripts draw the cards later
const PAGE = `<!doctype html><title>Dashboard</title>
<style>
  /* Canvas's cards: fixed-width boxes that wrap, each as tall as its
     contents, and full width on narrow screens */
  .ic-DashboardCard__box__container { margin: -36px 0 0 -36px; }
  .ic-DashboardCard {
    display: inline-block; vertical-align: top; box-sizing: border-box;
    width: 262px; margin: 36px 0 0 36px;
  }
  @media only screen and (max-width: 620px) {
    .ic-DashboardCard { width: 100%; margin-left: 0; }
    .ic-DashboardCard__box__container { margin-left: 0; }
  }
  /* Canvas's link row: a set height, the links at its bottom */
  .ic-DashboardCard__action-container {
    display: flex; height: 40px; padding-bottom: 12px; align-items: flex-end;
  }
  .ic-DashboardCard__action { display: flex; height: 36px; }
</style>
<body><div id="DashboardCard_Container"></div></body>`;

const item = (id: string, title: string, date: string, submitted = false) => ({
  course_id: '1',
  plannable_id: id,
  plannable_type: 'assignment',
  plannable_date: date,
  plannable: { title },
  html_url: `/courses/1/assignments/${id}`,
  submissions: { submitted, redo_request: false },
  planner_override: null,
});

const ITEMS = [
  item('1', 'Midterm 2', inDays(-4)),
  item('2', 'Lab 4', inDays(1), true),
  item('3', 'Assignment - Shell', inDays(2)),
  {
    ...item('4', 'Class Cancelled Today', inDays(1)),
    plannable_type: 'announcement',
  },
];

async function drawCards(page: Page): Promise<void> {
  await page.locator('#DashboardCard_Container').evaluate(
    (container, html) => {
      container.innerHTML = `<div class="ic-DashboardCard__box__container">${html}</div>`;
    },
    card('1', 'Intro to Operating Systems') + card('2', 'Experience Portfolio'),
  );
}

const list = (page: Page, course: string) =>
  page.getByRole('region', { name: `Due in ${course}` });

test.beforeEach(async ({ page }) => {
  await page.route(`${ORIGIN}/`, (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGE }),
  );
  await page.route(`${ORIGIN}/api/v1/planner/items?**`, (route) =>
    route.fulfill({ json: ITEMS }),
  );
});

test.afterEach(async ({ setCardAssignments }) => {
  await setCardAssignments(false);
});

test('cards list their work, overdue first and done struck through', async ({
  page,
  setCardAssignments,
}) => {
  await setCardAssignments(true);
  await page.goto(`${ORIGIN}/`);
  await drawCards(page);

  const rows = list(page, 'Intro to Operating Systems').getByRole('listitem');
  await expect(rows).toHaveText([
    /Midterm 2.*Overdue/,
    /Lab 4/,
    /Assignment - Shell/,
  ]);
  await expect(rows.nth(0)).toHaveClass(/cpp-overdue/);
  await expect(rows.nth(1)).toHaveClass(/cpp-done/);
  await expect(
    page.getByRole('checkbox', { name: 'Mark Lab 4 as done' }),
  ).toBeChecked();
  await expect(page.getByRole('link', { name: 'Midterm 2' })).toHaveAttribute(
    'href',
    '/courses/1/assignments/1',
  );
  await expect(list(page, 'Experience Portfolio')).toHaveText(/Nothing due/);
});

test('the circle marks work done in Canvas', async ({
  page,
  setCardAssignments,
}) => {
  const saved: { body: unknown; token: string | null }[] = [];
  await page.route(`${ORIGIN}/api/v1/planner/overrides`, (route) => {
    const request = route.request();
    saved.push({
      body: request.postDataJSON(),
      token: request.headers()['x-csrf-token'] ?? null,
    });
    return route.fulfill({
      status: 201,
      json: { id: '9', marked_complete: true, dismissed: false },
    });
  });
  await setCardAssignments(true);
  await page.goto(`${ORIGIN}/`);
  // Canvas's session cookie for writes, URL-encoded as Canvas sets it
  await page.evaluate(() => (document.cookie = '_csrf_token=abc%2B123'));
  await drawCards(page);

  const circle = page.getByRole('checkbox', {
    name: 'Mark Assignment - Shell as done',
  });
  await circle.check();
  await expect(circle).toBeEnabled();
  await expect(circle).toBeChecked();
  expect(saved).toEqual([
    {
      body: {
        plannable_type: 'assignment',
        plannable_id: '3',
        marked_complete: true,
      },
      token: 'abc+123',
    },
  ]);

  // a second click updates the same override
  let updated: unknown;
  await page.route(`${ORIGIN}/api/v1/planner/overrides/9`, (route) => {
    updated = route.request().postDataJSON();
    return route.fulfill({
      json: { id: '9', marked_complete: false, dismissed: false },
    });
  });
  await circle.uncheck();
  await expect(circle).toBeEnabled();
  expect(updated).toEqual({ marked_complete: false, dismissed: false });
});

test('a save Canvas refuses is taken back', async ({
  page,
  setCardAssignments,
}) => {
  await page.route(`${ORIGIN}/api/v1/planner/overrides`, (route) =>
    route.fulfill({ status: 422, json: {} }),
  );
  await setCardAssignments(true);
  await page.goto(`${ORIGIN}/`);
  await drawCards(page);

  const circle = page.getByRole('checkbox', {
    name: 'Mark Midterm 2 as done',
  });
  await circle.click();
  await expect(circle).toBeEnabled();
  await expect(circle).not.toBeChecked();
  await expect(page.getByRole('listitem').first()).toHaveClass(/cpp-overdue/);
});

test("the card's links move onto its color while it lists work", async ({
  page,
  setCardAssignments,
}) => {
  await page.goto(`${ORIGIN}/`);
  await drawCards(page);
  const hero = page.locator('.ic-DashboardCard__header_hero').first();
  const links = page.getByRole('navigation', {
    name: 'Actions for Intro to Operating Systems',
  });
  const bottom = async () => {
    const [h, l] = [await hero.boundingBox(), await links.boundingBox()];
    return h && l ? l.y + l.height <= h.y + h.height : undefined;
  };
  expect(await bottom()).toBe(false);
  await setCardAssignments(true);
  await expect(page.locator('.cpp-card-due')).toHaveCount(2);
  await expect.poll(bottom).toBe(true);
  // in the middle of their pill, which Canvas's row height would push down
  const [pill, link] = [
    await links.boundingBox(),
    await links.getByRole('link').boundingBox(),
  ];
  expect(pill && link && link.y - pill.y).toBeCloseTo(
    pill && link ? pill.y + pill.height - (link.y + link.height) : NaN,
  );
  await setCardAssignments(false);
  await expect.poll(bottom).toBe(false);
});

test('every card is as tall as the tallest', async ({
  page,
  setCardAssignments,
}) => {
  await setCardAssignments(true);
  await page.goto(`${ORIGIN}/`);
  await drawCards(page);
  // a list of three and "Nothing due"
  await expect(page.locator('.cpp-card-due')).toHaveCount(2);
  // where the two cards are, and the width they're laid out in
  const layout = async () => {
    const {
      cards: [first, second],
      width,
    } = await page.evaluate(() => {
      // DOMRect's fields are getters, which don't survive leaving the page
      const rect = (e: Element) => {
        const { x, y, width, height } = e.getBoundingClientRect();
        return { x, y, width, height };
      };
      const container = document.querySelector(
        '.ic-DashboardCard__box__container',
      );
      return {
        cards: [...document.querySelectorAll('.ic-DashboardCard')].map(rect),
        width: container ? rect(container).width : NaN,
      };
    });
    if (!first || !second) throw new Error('expected two cards');
    return { first, second, width };
  };

  // side by side, in Canvas's own columns
  const wide = await layout();
  expect(wide.second.height).toBe(wide.first.height);
  expect([wide.first.width, wide.second.x - wide.first.x]).toEqual([262, 298]);

  // one above the other, full width, as Canvas lays them out on a phone
  await page.setViewportSize({ width: 400, height: 800 });
  const narrow = await layout();
  expect(narrow.second.y).toBeGreaterThan(narrow.first.y);
  expect(narrow.second.height).toBe(narrow.first.height);
  expect(narrow.first.width).toBe(narrow.width);
});

test('cards drawn again get their list again', async ({
  page,
  setCardAssignments,
}) => {
  await setCardAssignments(true);
  await page.goto(`${ORIGIN}/`);
  await drawCards(page);
  await expect(page.locator('.cpp-card-due')).toHaveCount(2);
  // switching dashboard views redraws every card
  await drawCards(page);
  await expect(page.locator('.cpp-card-due')).toHaveCount(2);
});

test('follows the switch without a reload', async ({
  page,
  setCardAssignments,
}) => {
  await page.goto(`${ORIGIN}/`);
  await drawCards(page);
  await setCardAssignments(true);
  await expect(page.locator('.cpp-card-due')).toHaveCount(2);
  await setCardAssignments(false);
  await expect(page.locator('.cpp-card-due')).toHaveCount(0);
});

test('stays off by default', async ({ page }) => {
  let asked = false;
  await page.route(`${ORIGIN}/api/v1/planner/items?**`, (route) => {
    asked = true;
    return route.fulfill({ json: ITEMS });
  });
  await page.goto(`${ORIGIN}/`);
  await drawCards(page);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.cpp-card-due')).toHaveCount(0);
  // off means no request for them either
  expect(asked).toBe(false);
});
