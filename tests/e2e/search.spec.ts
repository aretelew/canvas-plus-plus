// "Search with ⌘K" opens a search box over any Canvas page: the user's
// courses, the pages in each, their work and groups, found by a few letters of
// each, and opened with Enter.

import type { Page } from '@playwright/test';
import { expect, test } from '../extension';

const ORIGIN = 'https://fixture.instructure.com';
const DAY = 24 * 60 * 60 * 1000;
const SHORTCUT = 'ControlOrMeta+k';

const page = (body: string) =>
  `<!doctype html><title>t</title>
  <body>
    <header id="header">
      <a id="global_nav_profile_link" href="/profile"><img alt="A Student"></a>
    </header>
    <main>${body}</main>
  </body>`;

const tab = (course: string, id: string, label: string) => ({
  id,
  label,
  html_url: `/courses/${course}/${id}`,
});

const COURSES = [
  {
    id: '1',
    name: 'General Chemistry',
    course_code: 'CHEM 105',
    tabs: [tab('1', 'home', 'Home'), tab('1', 'grades', 'Grades')],
  },
  {
    id: '2',
    name: 'Robots',
    original_name: 'Intro to Robotics',
    course_code: 'CSDS 373',
    tabs: [tab('2', 'modules', 'Modules'), tab('2', 'grades', 'Grades')],
  },
];

const WORK = {
  course_id: '1',
  plannable_id: '4',
  plannable_type: 'assignment',
  plannable_date: new Date(Date.now() + DAY).toISOString(),
  plannable: { title: 'Lab 4: Titration' },
  html_url: '/courses/1/assignments/4',
  submissions: { submitted: false, redo_request: false },
  planner_override: null,
};

const box = (p: Page) => p.getByRole('dialog', { name: 'Search Canvas' });
const field = (p: Page) => box(p).getByRole('combobox');
const results = (p: Page) => box(p).getByRole('option');

// Presses the shortcut until the box opens: the first page after the switch
// is turned on hears it only once the setting has loaded.
const openBox = (p: Page) =>
  expect(async () => {
    if (!(await box(p).isVisible())) await p.keyboard.press(SHORTCUT);
    await expect(box(p)).toBeVisible({ timeout: 500 });
  }).toPass();

// each course's assignments, by id; Lab 4 is the To Do's work
const ASSIGNMENTS: Record<string, Record<string, string>> = {
  '1': { '4': 'Lab 4: Titration', '11': 'Lab 1: Safety' },
  '2': { '21': 'Robot arm report' },
};

let courseRequests = 0;
let graphqlBody: { query: string; variables: Record<string, string> };

test.beforeEach(async ({ page: p }) => {
  courseRequests = 0;
  await p.route(`${ORIGIN}/api/v1/courses?**`, (route) => {
    courseRequests += 1;
    return route.fulfill({ json: COURSES });
  });
  await p.route(`${ORIGIN}/api/graphql`, (route) => {
    graphqlBody = route.request().postDataJSON() as typeof graphqlBody;
    const data = Object.fromEntries(
      Object.entries(graphqlBody.variables).map(([alias, course]) => [
        alias,
        {
          assignmentsConnection: {
            nodes: Object.entries(ASSIGNMENTS[course] ?? {}).map(
              ([id, name]) => ({
                _id: id,
                name,
                dueAt: null,
                htmlUrl: `${ORIGIN}/courses/${course}/assignments/${id}`,
              }),
            ),
          },
        },
      ]),
    );
    return route.fulfill({ json: { data } });
  });
  await p.route(`${ORIGIN}/api/v1/users/self/groups?**`, (route) =>
    route.fulfill({ json: [] }),
  );
  await p.route(`${ORIGIN}/api/v1/users/self/colors`, (route) =>
    route.fulfill({ json: { custom_colors: { course_1: '#1d9e75' } } }),
  );
  await p.route(`${ORIGIN}/api/v1/planner/items?**`, (route) =>
    route.fulfill({ json: [WORK] }),
  );
  for (const path of [
    '/',
    '/courses/1/grades',
    '/courses/2/grades',
    '/courses/2/modules',
  ]) {
    await p.route(`${ORIGIN}${path}`, (route) =>
      route.fulfill({ contentType: 'text/html', body: page(path) }),
    );
  }
});

test.afterEach(async ({ page: p, setQuickSearch }) => {
  await setQuickSearch(false);
  await p.goto('about:blank');
});

test('the shortcut opens it on the courses and what is due', async ({
  page: p,
  setQuickSearch,
}) => {
  await setQuickSearch(true);
  await p.goto(`${ORIGIN}/`);
  await openBox(p);

  await expect(field(p)).toBeFocused();
  await expect(results(p)).toHaveText([
    'CHEM 105',
    'Robots',
    /^Lab 4: TitrationCHEM 105/,
  ]);
  await expect(results(p).first()).toHaveAttribute('aria-selected', 'true');
  await expect(results(p).first().locator('.dot')).toHaveCSS(
    'background-color',
    'rgb(29, 158, 117)',
  );
});

test('a few letters of a course and its page find it, and Enter opens it', async ({
  page: p,
  setQuickSearch,
}) => {
  await setQuickSearch(true);
  await p.goto(`${ORIGIN}/`);
  await openBox(p);
  await field(p).fill('chem gr');

  await expect(results(p)).toHaveText(['GradesCHEM 105']);
  await p.keyboard.press('Enter');
  await expect(p).toHaveURL(`${ORIGIN}/courses/1/grades`);
});

test('the arrow keys pick a result', async ({ page: p, setQuickSearch }) => {
  await setQuickSearch(true);
  await p.goto(`${ORIGIN}/`);
  await openBox(p);
  await field(p).fill('grades');
  await expect(results(p)).toHaveText([
    'GradesCHEM 105',
    'GradesRobots',
    'All grades',
  ]);

  await p.keyboard.press('ArrowDown');
  await expect(results(p).nth(1)).toHaveAttribute('aria-selected', 'true');
  await p.keyboard.press('ArrowUp');
  await p.keyboard.press('ArrowUp');
  await expect(results(p).nth(2)).toHaveAttribute('aria-selected', 'true');
  await p.keyboard.press('ArrowUp');
  await p.keyboard.press('Enter');
  await expect(p).toHaveURL(`${ORIGIN}/courses/2/grades`);
});

test('every assignment in the courses is found, past or done', async ({
  page: p,
  setQuickSearch,
}) => {
  await setQuickSearch(true);
  await p.goto(`${ORIGIN}/`);
  await openBox(p);
  await field(p).fill('lab');

  // Lab 4 is in the To Do, so it's listed once, from there
  await expect(results(p)).toHaveText([
    /^Lab 4: TitrationCHEM 105/,
    'Lab 1: SafetyCHEM 105',
  ]);
  await expect(results(p).nth(1).getByRole('link')).toHaveAttribute(
    'href',
    '/courses/1/assignments/11',
  );
  expect(Object.values(graphqlBody.variables)).toEqual(['1', '2']);
  expect(graphqlBody.query).toContain('gradingPeriodId: null');
});

test('Escape, the shortcut again, or a click beside it closes it', async ({
  page: p,
  setQuickSearch,
}) => {
  await setQuickSearch(true);
  await p.goto(`${ORIGIN}/`);
  for (const close of [
    () => p.keyboard.press('Escape'),
    () => p.keyboard.press(SHORTCUT),
    () => p.mouse.click(5, 5),
  ]) {
    await openBox(p);
    await close();
    await expect(box(p)).toBeHidden();
  }
});

test("what's typed in it doesn't reach the page's own key handlers", async ({
  page: p,
  setQuickSearch,
}) => {
  await setQuickSearch(true);
  await p.goto(`${ORIGIN}/`);
  await openBox(p);
  // from here on, past the shortcut's own modifier key
  await p.evaluate(() => {
    const keys: string[] = [];
    document.addEventListener('keydown', (event) => keys.push(event.key));
    Object.assign(window, { keys });
  });
  await p.keyboard.type('jk');
  await p.keyboard.press('Escape');

  expect(
    await p.evaluate(() => (window as unknown as { keys: string[] }).keys),
  ).toEqual([]);
});

test("it's asked for once and kept for the next page", async ({
  page: p,
  setQuickSearch,
}) => {
  await setQuickSearch(true);
  await p.goto(`${ORIGIN}/`);
  await openBox(p);
  await expect(results(p)).toHaveCount(3);
  await p.goto(`${ORIGIN}/courses/2/modules`);
  await openBox(p);

  await expect(results(p)).toHaveCount(3);
  expect(courseRequests).toBe(1);
});

test("it's loaded in the background before it first opens", async ({
  page: p,
  setQuickSearch,
}) => {
  await setQuickSearch(true);
  await p.goto(`${ORIGIN}/`);
  await expect.poll(() => courseRequests).toBe(1);
  await expect
    .poll(() => p.evaluate(() => localStorage.getItem('canvas++:search-saved')))
    .not.toBeNull();
  await openBox(p);

  await expect(results(p)).toHaveCount(3);
  await expect(box(p)).not.toContainText('Loading');
  expect(courseRequests).toBe(1);
});

test('the shortcut is left to the browser while it is off', async ({
  page: p,
}) => {
  await p.goto(`${ORIGIN}/`);
  await p.keyboard.press(SHORTCUT);
  await expect(box(p)).toHaveCount(0);
  expect(courseRequests).toBe(0);
});
