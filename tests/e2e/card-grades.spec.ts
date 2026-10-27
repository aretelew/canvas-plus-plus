// Dashboard cards show each course's current grade, from Canvas's courses API,
// in a pill linking to the course's Grades page. Canvas draws the cards with
// React after the page loads, so cards drawn later get pills too.

import type { Page } from '@playwright/test';
import { expect, test } from '../extension';

const ORIGIN = 'https://fixture.instructure.com';

const card = (id: string, name: string) => `
  <div class="ic-DashboardCard" aria-label="${name}">
    <div class="ic-DashboardCard__header" style="position: relative">
      <!-- an image card: the course color over the image, see-through -->
      <div class="ic-DashboardCard__header_hero" style="height: 146px; background: #d41e00; opacity: 0.6"></div>
      <a class="ic-DashboardCard__link" href="/courses/${id}">${name}</a>
    </div>
  </div>`;

// the dashboard as the server sends it: Canvas's scripts draw the cards later
const PAGE = `<!doctype html><title>Dashboard</title>
<body><div id="DashboardCard_Container"></div></body>`;

const COURSES = [
  {
    id: '1',
    enrollments: [{ type: 'student', computed_current_score: 89.67 }],
  },
  // no grades yet
  { id: '2', enrollments: [{ type: 'student', computed_current_score: null }] },
];

async function drawCards(page: Page): Promise<void> {
  await page.locator('#DashboardCard_Container').evaluate(
    (container, html) => {
      container.innerHTML = html;
    },
    card('1', 'Computer Security') + card('2', 'Experience Portfolio'),
  );
}

test.beforeEach(async ({ page }) => {
  await page.route(`${ORIGIN}/`, (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGE }),
  );
  await page.route(`${ORIGIN}/api/v1/courses?**`, (route) =>
    route.fulfill({ json: COURSES }),
  );
});

test.afterEach(async ({ setCardGrades }) => {
  await setCardGrades(false);
});

test('cards show their grade, linked to the Grades page', async ({
  page,
  setCardGrades,
}) => {
  await setCardGrades(true);
  await page.goto(`${ORIGIN}/`);
  await drawCards(page);

  const pill = page.getByRole('link', { name: 'Computer Security grades' });
  await expect(pill).toHaveText('89.67%');
  await expect(pill).toHaveAttribute('href', '/courses/1/grades');
  // a course with no grade gets no pill
  await expect(page.locator('.cpp-card-grade')).toHaveCount(1);
  // drawn above the card's see-through color, not under it
  const onTop = await pill.evaluate((el) => {
    const { x, y, width, height } = el.getBoundingClientRect();
    return document.elementFromPoint(x + width / 2, y + height / 2) === el;
  });
  expect(onTop).toBe(true);
});

test('cards drawn again get their pill again', async ({
  page,
  setCardGrades,
}) => {
  await setCardGrades(true);
  await page.goto(`${ORIGIN}/`);
  await drawCards(page);
  await expect(page.locator('.cpp-card-grade')).toHaveCount(1);
  // switching dashboard views redraws every card
  await drawCards(page);
  await expect(page.locator('.cpp-card-grade')).toHaveCount(1);
});

test('follows the switch without a reload', async ({ page, setCardGrades }) => {
  await page.goto(`${ORIGIN}/`);
  await drawCards(page);
  await setCardGrades(true);
  await expect(page.locator('.cpp-card-grade')).toHaveText('89.67%');
  await setCardGrades(false);
  await expect(page.locator('.cpp-card-grade')).toHaveCount(0);
  await setCardGrades(true);
  await expect(page.locator('.cpp-card-grade')).toHaveText('89.67%');
});

// the theme tags the pill like any card element
test('shows with the dark theme on', async ({
  page,
  setTheme,
  setCardGrades,
}) => {
  await setTheme(true);
  await setCardGrades(true);
  await page.goto(`${ORIGIN}/`);
  await drawCards(page);
  const pill = page.locator('.cpp-card-grade');
  await expect(pill).toHaveAttribute('data-cpp-bg');
  await expect(pill).toBeVisible();
  await setTheme(false);
});

test('stays off by default', async ({ page }) => {
  let asked = false;
  await page.route(`${ORIGIN}/api/v1/courses?**`, (route) => {
    asked = true;
    return route.fulfill({ json: COURSES });
  });
  await page.goto(`${ORIGIN}/`);
  await drawCards(page);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.cpp-card-grade')).toHaveCount(0);
  // grades off means no request for them either
  expect(asked).toBe(false);
});
