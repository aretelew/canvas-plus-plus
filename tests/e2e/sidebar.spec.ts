// "Tidy To Do list" replaces Canvas's To Do (which fills up with
// announcements) with work to do grouped by when it's due, and restyles
// Recent Feedback to match: each row a title, its course's code and color,
// and on the right its date or score.

import type { Page } from '@playwright/test';
import { expect, test } from '../extension';

const ORIGIN = 'https://fixture.instructure.com';
const DAY = 24 * 60 * 60 * 1000;
// the content script runs on the real clock
const inDays = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString();
// noon tomorrow, whatever the time now (the browser shares this timezone)
const tomorrow = () => {
  const date = new Date(Date.now() + DAY);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
};

const feedbackRow = (course: string, title: string, details: string) => `
  <li class="event">
    <a class="recent_feedback_icon" href="/courses/${course}/assignments/${String(title.length)}">
      <i class="icon-check"></i>
      <div class="event-details">
        <b class="event-details__title recent_feedback_title">${title}</b>
        ${details}
      </div>
    </a>
  </li>`;

// Canvas's sidebar as its server sends it; Canvas's React fills the To Do
// container in later
const SIDEBAR = `
  <div class="Sidebar__TodoListContainer"><h2>Canvas To Do</h2></div>
  <div class="events_list recent_feedback">
    <div class="h2 shared-space"><h2>Recent Feedback</h2></div>
    <ul class="right-side-list events">
      ${feedbackRow('2', 'Quiz - Secure Coding', '<p class="event-details__context">CSDS 344</p><p><strong>1 out of 1</strong></p>')}
      ${feedbackRow('1', 'Analytic Essay 2', '<p><strong>95 out of 100</strong></p><p>"fantastic"</p>')}
      ${feedbackRow('1', 'Participation', '<p><strong>A</strong></p>')}
      ${feedbackRow('2', 'Midterm', '<p><strong>69 out of 78</strong></p>')}
    </ul>
  </div>
  <div><a href="/grades" class="Button button-sidebar-wide">View Grades</a></div>`;

const page = (path: string, sidebar: string) =>
  `<!doctype html><title>${path}</title>
  <body><div id="content">Course cards</div><aside id="right-side">${sidebar}</aside></body>`;

const item = (
  id: string,
  title: string,
  date: string,
  over: Record<string, unknown> = {},
) => ({
  course_id: '1',
  context_name: 'Intro to Operating Systems and Concurrent Programming',
  plannable_id: id,
  plannable_type: 'assignment',
  plannable_date: date,
  plannable: { title },
  html_url: `/courses/1/assignments/${id}`,
  submissions: { submitted: false, redo_request: false },
  planner_override: null,
  ...over,
});

const ITEMS = [
  item('1', 'Problem set 4', inDays(-3)),
  item('2', 'Class Cancelled Today', inDays(-1), {
    plannable_type: 'announcement',
  }),
  item('3', 'Lab 6: semaphores', tomorrow()),
  item('4', 'Handed in', inDays(2), {
    submissions: { submitted: true, redo_request: false },
  }),
  item('5', 'Reading response 7', inDays(9), {
    course_id: '2',
    context_name: 'Computer Security',
  }),
];

const COURSES = [
  { id: '1', name: 'Intro to Operating Systems', course_code: 'CSDS 338' },
  { id: '2', name: 'Computer Security', course_code: 'CSDS 344' },
];

const todo = (p: Page) => p.getByRole('region', { name: 'To Do' });
const feedback = (p: Page) =>
  p.getByRole('region', { name: 'Recent Feedback' });

test.beforeEach(async ({ page: p }) => {
  await p.route(`${ORIGIN}/`, (route) =>
    route.fulfill({ contentType: 'text/html', body: page('/', SIDEBAR) }),
  );
  await p.route(`${ORIGIN}/api/v1/planner/items?**`, (route) =>
    route.fulfill({ json: ITEMS }),
  );
  await p.route(`${ORIGIN}/api/v1/courses?**`, (route) =>
    route.fulfill({ json: COURSES }),
  );
  await p.route(`${ORIGIN}/api/v1/users/self/colors`, (route) =>
    route.fulfill({
      json: { custom_colors: { course_1: '#1d9e75', user_9: '#000000' } },
    }),
  );
});

test.afterEach(async ({ setTidySidebar }) => {
  await setTidySidebar(false);
});

test('To Do lists only work to do, grouped by when it is due', async ({
  page: p,
  setTidySidebar,
}) => {
  await setTidySidebar(true);
  await p.goto(`${ORIGIN}/`);

  await expect(todo(p).getByRole('heading', { level: 2 })).toHaveText('To Do3');
  await expect(todo(p).getByRole('heading', { level: 3 })).toHaveText([
    'Overdue',
    'Tomorrow',
    'Later',
  ]);
  const rows = todo(p).getByRole('listitem');
  await expect(rows).toHaveText([
    /Problem set 4\s*CSDS 338/,
    /Lab 6: semaphores\s*CSDS 338/,
    /Reading response 7\s*CSDS 344/,
  ]);
  await expect(
    todo(p).getByRole('link', { name: 'Problem set 4' }),
  ).toHaveAttribute('href', '/courses/1/assignments/1');
  // the course's color, where the user gave it one
  await expect(rows.nth(0).locator('.cpp-dot')).toHaveCSS(
    'background-color',
    'rgb(29, 158, 117)',
  );
  await expect(rows.nth(2).locator('.cpp-dot')).toHaveCount(0);
  // Canvas's own lists, and the button ours replaces, are hidden
  await expect(p.getByText('Canvas To Do')).toBeHidden();
  await expect(p.locator('.recent_feedback')).toBeHidden();
  await expect(p.getByRole('link', { name: 'View Grades' })).toBeHidden();
});

test('Recent Feedback shows three, the rest on request, and folds back', async ({
  page: p,
  setTidySidebar,
}) => {
  await setTidySidebar(true);
  await p.goto(`${ORIGIN}/`);

  const rows = feedback(p).getByRole('listitem');
  await expect(rows).toHaveText([
    /Quiz - Secure Coding\s*CSDS 344\s*1\/1/,
    /Analytic Essay 2\s*CSDS 338\s*"fantastic"\s*95\/100/,
    /Participation\s*CSDS 338\s*A/,
  ]);
  const toggle = feedback(p).getByRole('button');
  await expect(toggle).toHaveText('Show 1 more');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(rows).toHaveCount(4);
  await expect(toggle).toHaveText('Show less');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();
  await expect(rows).toHaveCount(3);
  await expect(toggle).toHaveText('Show 1 more');
  await expect(
    feedback(p).getByRole('link', { name: 'All grades' }),
  ).toHaveAttribute('href', '/grades');
});

test('the circle marks work done in Canvas, here and on its card', async ({
  page: p,
  setTidySidebar,
  setCardAssignments,
}) => {
  const saved: unknown[] = [];
  await p.route(`${ORIGIN}/api/v1/planner/overrides`, (route) => {
    saved.push(route.request().postDataJSON());
    return route.fulfill({
      status: 201,
      json: { id: '9', marked_complete: true, dismissed: false },
    });
  });
  await setTidySidebar(true);
  await setCardAssignments(true);
  await p.goto(`${ORIGIN}/`);
  await p
    .locator('#content')
    .evaluate(
      (content) =>
        (content.innerHTML = `<div class="ic-DashboardCard" aria-label="OS"><a class="ic-DashboardCard__link" href="/courses/1">OS</a></div>`),
    );

  const circles = p.getByRole('checkbox', {
    name: 'Mark Lab 6: semaphores as done',
  });
  await expect(circles).toHaveCount(2);
  await circles.first().check();
  await expect(circles.nth(1)).toBeChecked();
  await expect(circles.first()).toBeEnabled();
  expect(saved).toEqual([
    { plannable_type: 'assignment', plannable_id: '3', marked_complete: true },
  ]);
  // struck through but still listed, so a slip can be undone
  await expect(todo(p).getByRole('listitem').nth(1)).toHaveClass(/cpp-done/);
  await expect(todo(p).locator('.cpp-count')).toHaveText('2');
  await setCardAssignments(false);
});

test('To Do shows seven, and a row behind "more" still follows its card', async ({
  page: p,
  setTidySidebar,
  setCardAssignments,
}) => {
  await p.route(`${ORIGIN}/api/v1/planner/items?**`, (route) =>
    route.fulfill({
      // the last two in the course with a card, past the sidebar's seven
      json: Array.from({ length: 9 }, (_, i) =>
        item(String(i + 1), `Lab ${String(i + 1)}`, inDays(2 + i), {
          course_id: i < 7 ? '2' : '1',
        }),
      ),
    }),
  );
  await p.route(`${ORIGIN}/api/v1/planner/overrides`, (route) =>
    route.fulfill({
      status: 201,
      json: { id: '9', marked_complete: true, dismissed: false },
    }),
  );
  await setTidySidebar(true);
  await setCardAssignments(true);
  await p.goto(`${ORIGIN}/`);
  await p
    .locator('#content')
    .evaluate(
      (content) =>
        (content.innerHTML = `<div class="ic-DashboardCard" aria-label="OS"><a class="ic-DashboardCard__link" href="/courses/1">OS</a></div>`),
    );

  const rows = todo(p).getByRole('listitem');
  await expect(rows).toHaveCount(7);
  await expect(todo(p).locator('.cpp-count')).toHaveText('9');
  await p
    .locator('.cpp-card-due')
    .getByRole('checkbox', { name: 'Mark Lab 8 as done' })
    .check();
  await expect(todo(p).locator('.cpp-count')).toHaveText('8');
  await todo(p).getByRole('button', { name: 'Show 2 more' }).click();
  await expect(rows).toHaveCount(9);
  await expect(
    todo(p).getByRole('checkbox', { name: 'Mark Lab 8 as done' }),
  ).toBeChecked();
  // and fold back to seven
  await todo(p).getByRole('button', { name: 'Show less' }).click();
  await expect(rows).toHaveCount(7);
  await setCardAssignments(false);
});

test("on a course's page, only its work and no course labels", async ({
  page: p,
  setTidySidebar,
}) => {
  let askedCourses = false;
  await p.route(`${ORIGIN}/courses/2`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: page('/courses/2', SIDEBAR),
    }),
  );
  await p.route(`${ORIGIN}/api/v1/courses?**`, (route) => {
    askedCourses = true;
    return route.fulfill({ json: COURSES });
  });
  await setTidySidebar(true);
  await p.goto(`${ORIGIN}/courses/2`);

  await expect(todo(p).getByRole('listitem')).toHaveText([
    /^Reading response 7/,
  ]);
  await expect(p.locator('.cpp-course')).toHaveCount(0);
  await expect(
    feedback(p).getByRole('link', { name: 'All grades' }),
  ).toHaveCount(0);
  expect(askedCourses).toBe(false);
});

test("Canvas's list stays when the work can't be loaded", async ({
  page: p,
  setTidySidebar,
}) => {
  await p.route(`${ORIGIN}/api/v1/planner/items?**`, (route) =>
    route.fulfill({ status: 500, json: {} }),
  );
  await setTidySidebar(true);
  await p.goto(`${ORIGIN}/`);
  await expect(p.getByText('Canvas To Do')).toBeVisible();
  await expect(todo(p)).toHaveCount(0);
  await expect(feedback(p)).toBeVisible();
});

test('a sidebar Canvas sends after the page loads gets them too', async ({
  page: p,
  setTidySidebar,
}) => {
  // the dashboard's sidebar comes from /dashboard-sidebar once the page is up
  await p.route(`${ORIGIN}/`, (route) =>
    route.fulfill({ contentType: 'text/html', body: page('/', '') }),
  );
  await setTidySidebar(true);
  await p.goto(`${ORIGIN}/`);
  await p
    .locator('#right-side')
    .evaluate((side, html) => (side.innerHTML = html), SIDEBAR);
  await expect(todo(p).getByRole('listitem')).toHaveCount(3);
  await expect(feedback(p).getByRole('listitem')).toHaveCount(3);
});

test('follows the switch without a reload', async ({
  page: p,
  setTidySidebar,
}) => {
  await p.goto(`${ORIGIN}/`);
  await expect(p.getByText('Canvas To Do')).toBeVisible();
  await setTidySidebar(true);
  await expect(todo(p)).toBeVisible();
  await expect(p.getByText('Canvas To Do')).toBeHidden();
  await setTidySidebar(false);
  await expect(p.locator('.cpp-sidebar')).toHaveCount(0);
  await expect(p.getByText('Canvas To Do')).toBeVisible();
  await expect(p.locator('.recent_feedback')).toBeVisible();
});

test('stays off by default', async ({ page: p }) => {
  let asked = false;
  await p.route(`${ORIGIN}/api/v1/**`, (route) => {
    asked = true;
    return route.fulfill({ json: [] });
  });
  await p.goto(`${ORIGIN}/`);
  await p.waitForLoadState('networkidle');
  await expect(p.locator('.cpp-sidebar')).toHaveCount(0);
  await expect(p.getByText('Canvas To Do')).toBeVisible();
  expect(asked).toBe(false);
});
