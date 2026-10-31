// "Courses in left sidebar" widens Canvas's global nav into a sidebar: Canvas's
// buttons stay, with the courses, groups and pages opened last listed in it. A
// course's own menu stays as it is.

import type { Page } from '@playwright/test';
import { expect, test } from '../extension';

const ORIGIN = 'https://fixture.instructure.com';
const DAY = 24 * 60 * 60 * 1000;

const button = (id: string, text: string) => `
  <li class="menu-item ic-app-header__menu-list-item">
    <a id="${id}" class="ic-app-header__menu-list-link" href="/${text}">
      <div class="menu-item-icon-container"></div>
      <div class="menu-item__text">${text}</div>
    </a>
  </li>`;

// Canvas's markup as its server sends it, and the rules the feature overrides
const canvas = (context: string, inner: string, signedIn = true) =>
  `<!doctype html><title>t</title>
  <style>
    body { margin: 0; }
    .ic-app-header { position: fixed; top: 0; left: 0; width: 54px; height: 100%; }
    body.primary-nav-expanded .ic-app-header { width: 84px; }
    .ic-Layout-wrapper { margin-left: 54px; }
    body.primary-nav-expanded .ic-Layout-wrapper { margin-left: 84px; }
  </style>
  <body class="primary-nav-expanded with-left-side ${context}">
    <header id="header" class="ic-app-header">
      <div class="ic-app-header__main-navigation">
        <ul id="menu">
          ${signedIn ? button('global_nav_profile_link', 'Account').replace('<div class="menu-item-icon-container"></div>', '<div class="menu-item-icon-container"><img alt="A Student"></div>') : ''}
          ${button('global_nav_dashboard_link', 'Dashboard')}
          ${button('global_nav_courses_link', 'Courses')}
          ${button('global_nav_groups_link', 'Groups')}
          ${button('global_nav_calendar_link', 'Calendar')}
          ${button('global_nav_help_link', 'Help')}
        </ul>
      </div>
    </header>
    <div class="ic-Layout-wrapper">
      ${inner}
    </div>
  </body>`;

const crumbs = (...names: string[]) =>
  `<nav id="breadcrumbs"><ul>${names.map((name) => `<li><span>${name}</span></li>`).join('')}</ul></nav>`;

const MENU = `
  ${crumbs('My Dashboard', 'CSDS 338', 'Modules')}
  <div id="left-side" style="display: block">
    <ul id="section-tabs">
      <li><a href="/courses/1">Home</a></li>
      <li><a href="/courses/1/modules" aria-current="page" class="active">Modules</a></li>
    </ul>
  </div>`;

const card = (id: string, code: string, name: string, original = name) => ({
  id,
  shortName: name,
  originalName: original,
  courseCode: code,
});

const CARDS = [
  card('1', 'CSDS 338', 'Intro to Operating Systems'),
  card('2', 'CSDS 373', 'Robots', 'Intro to Robotics'),
];

const work = (id: string, course: string, days: number) => ({
  course_id: course,
  plannable_id: id,
  plannable_type: 'assignment',
  plannable_date: new Date(Date.now() + days * DAY).toISOString(),
  plannable: { title: `Work ${id}` },
  html_url: `/courses/${course}/assignments/${id}`,
  submissions: { submitted: false, redo_request: false },
  planner_override: null,
});

const HISTORY = (
  [
    ['HW 4', '/courses/1/assignments/4'],
    ['Modules', '/courses/1/modules'],
    ['Plan', '/groups/7/discussion_topics/2'],
    ['Syllabus', '/courses/2/assignments/syllabus'],
    ['Slides', '/courses/2/files/5'],
  ] as const
).map(([asset_name, path]) => ({
  asset_name,
  visited_url: `${ORIGIN}${path}`,
  visited_at: '2026-01-01T12:00:00Z',
  context_name: 'A course',
}));

const serve = (p: Page, path: string, body: string) =>
  p.route(`${ORIGIN}${path}`, (route) =>
    route.fulfill({ contentType: 'text/html', body }),
  );

const nav = (p: Page) => p.locator('#header');
const courses = (p: Page) => p.locator('.cpp-nav-courses');

test.beforeEach(async ({ page: p }) => {
  await p.route(`${ORIGIN}/api/v1/dashboard/dashboard_cards`, (route) =>
    route.fulfill({ json: CARDS }),
  );
  await p.route(`${ORIGIN}/api/v1/users/self/groups?**`, (route) =>
    route.fulfill({
      json: [
        {
          id: '7',
          name: 'Lab team 4',
          can_access: true,
          concluded: false,
          course_id: '1',
        },
        {
          id: '8',
          name: 'Old project',
          can_access: true,
          concluded: false,
          course_id: '99',
        },
      ],
    }),
  );
  await p.route(`${ORIGIN}/api/v1/users/self/colors`, (route) =>
    route.fulfill({ json: { custom_colors: { course_1: '#1d9e75' } } }),
  );
  await p.route(`${ORIGIN}/api/v1/planner/items?**`, (route) =>
    route.fulfill({
      json: [work('1', '1', -1), work('2', '2', 1), work('3', '2', 2)],
    }),
  );
  await p.route(`${ORIGIN}/api/v1/users/self/history`, (route) =>
    route.fulfill({ json: HISTORY }),
  );
  await serve(p, '/', canvas('context-user_1', '<main>Dashboard</main>'));
  await serve(p, '/courses/1/modules', canvas('context-course_1', MENU));
  await serve(p, '/courses/5', canvas('context-course_5', MENU));
});

test.afterEach(async ({ page: p, setCourseNav }) => {
  await setCourseNav(false);
  await p.goto('about:blank');
});

test('it lists the courses and groups in place of their buttons', async ({
  page: p,
  setCourseNav,
}) => {
  await setCourseNav(true);
  await p.goto(`${ORIGIN}/`);

  await expect(courses(p).getByRole('listitem')).toHaveText([
    /CSDS 338.*1 late/,
    /Robots.*2 due/,
  ]);
  await expect(
    courses(p).getByRole('link', { name: 'Robots' }),
  ).toHaveAttribute('href', '/courses/2');
  await expect(
    courses(p).getByRole('link', { name: 'Robots' }),
  ).toHaveAttribute('title', 'Intro to Robotics');
  await expect(courses(p).locator('.cpp-nav-dot').first()).toHaveCSS(
    'background-color',
    'rgb(29, 158, 117)',
  );
  await expect(p.locator('.cpp-nav-groups .cpp-nav-name')).toHaveText([
    'Lab team 4',
  ]);
  await expect(nav(p).locator('#global_nav_courses_link')).toBeHidden();
  await expect(nav(p).locator('#global_nav_groups_link')).toBeHidden();
  await expect(nav(p).locator('#global_nav_dashboard_link')).toBeVisible();
  expect((await nav(p).boundingBox())?.width).toBe(184);
  expect((await p.locator('.ic-Layout-wrapper').boundingBox())?.x).toBe(184);
});

test("the courses come in the dashboard's order", async ({
  page: p,
  setCourseNav,
}) => {
  await p.route(`${ORIGIN}/api/v1/dashboard/dashboard_cards`, (route) =>
    route.fulfill({ json: CARDS.toReversed() }),
  );
  await setCourseNav(true);
  await p.goto(`${ORIGIN}/`);

  await expect(courses(p).locator('.cpp-nav-name')).toHaveText([
    'Robots',
    'CSDS 338',
  ]);
});

test("a course's own menu stays, and its row is marked", async ({
  page: p,
  setCourseNav,
}) => {
  await setCourseNav(true);
  await p.goto(`${ORIGIN}/courses/1/modules`);

  await expect(courses(p).locator('.cpp-nav-here')).toHaveText(/CSDS 338/);
  await expect(p.locator('#left-side')).toBeVisible();
});

test('a course that is not listed marks no row', async ({
  page: p,
  setCourseNav,
}) => {
  await setCourseNav(true);
  await p.goto(`${ORIGIN}/courses/5`);

  await expect(courses(p).getByRole('listitem')).toHaveCount(2);
  await expect(p.locator('.cpp-nav-here')).toHaveCount(0);
});

test('it lists the last pages, and marks the one that is open', async ({
  page: p,
  setCourseNav,
}) => {
  await setCourseNav(true);
  await p.goto(`${ORIGIN}/courses/1/modules`);

  const recent = p.locator('.cpp-nav-recent');
  await expect(recent.locator('.cpp-nav-name')).toHaveText([
    'Modules',
    'HW 4',
    'Plan',
  ]);
  await expect(recent.locator('.cpp-nav-where')).toHaveText([
    'CSDS 338',
    'CSDS 338',
    'Lab team 4',
  ]);
  await expect(recent.locator('.cpp-nav-dot').first()).toHaveCSS(
    'background-color',
    'rgb(29, 158, 117)',
  );
  await expect(recent.locator('.cpp-nav-here')).toHaveText(/Modules/);
});

test('a page opened here is listed from the next page on', async ({
  page: p,
  setCourseNav,
}) => {
  await p.route(`${ORIGIN}/api/v1/users/self/history`, (route) =>
    route.fulfill({ json: [] }),
  );
  await serve(
    p,
    '/courses/1/grades',
    canvas(
      'context-course_1',
      crumbs('My Dashboard', 'CSDS 338', 'Grades', 'A Student'),
    ),
  );
  await serve(
    p,
    '/courses/2/files',
    canvas('context-course_2', crumbs('My Dashboard', 'CSDS 373')).replace(
      '<title>t</title>',
      '<title>Files</title>',
    ),
  );
  await setCourseNav(true);
  await p.goto(`${ORIGIN}/courses/1/modules`);
  await expect(p.locator('.cpp-nav-recent .cpp-nav-name')).toHaveText([
    'Modules',
  ]);
  await p.goto(`${ORIGIN}/courses/1/grades`);
  await p.goto(`${ORIGIN}/courses/2/files`);
  await p.goto(`${ORIGIN}/`);

  const recent = p.locator('.cpp-nav-recent');
  await expect(recent.locator('.cpp-nav-name')).toHaveText([
    'Files',
    'Grades',
    'Modules',
  ]);
  await expect(recent.locator('.cpp-nav-where')).toHaveText([
    'Robots',
    'CSDS 338',
    'CSDS 338',
  ]);
  await expect(recent.locator('.cpp-nav-dot').nth(1)).toHaveCSS(
    'background-color',
    'rgb(29, 158, 117)',
  );
});

test('pages opened here are kept per user, and go when it is off', async ({
  page: p,
  setCourseNav,
}) => {
  await setCourseNav(true);
  await p.goto(`${ORIGIN}/courses/1/modules`);
  await expect(p.locator('.cpp-nav-recent')).toBeVisible();
  const saved = () =>
    p.evaluate(() => localStorage.getItem('canvas++:course-nav-visits'));
  expect(await saved()).toContain('A Student');

  await setCourseNav(false);
  await expect(p.locator('.cpp-nav')).toHaveCount(0);
  expect(await saved()).toBeNull();
});

test("the active button is marked like the current course, not in Canvas's white", async ({
  page: p,
  setCourseNav,
}) => {
  await setCourseNav(true);
  await p.goto(`${ORIGIN}/`);
  await expect(courses(p)).toBeVisible();
  await p.addStyleTag({
    content: `
      :root {
        --ic-brand-global-nav-menu-item__text-color: #fff;
        --ic-brand-global-nav-menu-item__text-color--active: #123;
      }
      .ic-app-header__menu-list-item.ic-app-header__menu-list-item--active
        .ic-app-header__menu-list-link { background: #fff; }
      .ic-app-header__menu-list-item--active .menu-item__text {
        color: var(--ic-brand-global-nav-menu-item__text-color--active);
      }`,
  });
  const link = nav(p).locator('#global_nav_calendar_link');
  await link.evaluate((button) => {
    button.parentElement?.classList.add(
      'ic-app-header__menu-list-item--active',
    );
  });

  await expect(link).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(link.locator('.menu-item__text')).toHaveCSS(
    'color',
    'rgb(255, 255, 255)',
  );
});

test('what it saved goes on the next visit if it was turned off away from Canvas', async ({
  page: p,
  setCourseNav,
}) => {
  await setCourseNav(true);
  await p.goto(`${ORIGIN}/courses/1/modules`);
  await expect(p.locator('.cpp-nav-courses')).toBeVisible();
  await p.goto('about:blank');
  await setCourseNav(false);

  await p.goto(`${ORIGIN}/`);
  await expect
    .poll(() =>
      p.evaluate(() =>
        Object.keys(localStorage).filter((key) =>
          key.startsWith('canvas++:course-nav-'),
        ),
      ),
    )
    .toEqual([]);
});

test('it looks further back when a batch of history has too few pages', async ({
  page: p,
  setCourseNav,
}) => {
  const asked: string[] = [];
  await p.route(`${ORIGIN}/api/v1/users/self/history**`, (route) => {
    const { search } = new URL(route.request().url());
    asked.push(search);
    return route.fulfill({
      json: search === '' ? HISTORY.slice(0, 1) : HISTORY.slice(1),
      headers: {
        Link: `<${ORIGIN}/api/v1/users/self/history?page=2>; rel="next"`,
      },
    });
  });
  await setCourseNav(true);
  await p.goto(`${ORIGIN}/`);

  await expect(p.locator('.cpp-nav-recent .cpp-nav-name')).toHaveCount(3);
  expect(asked).toEqual(['', '?page=2']);
});

test('it stops looking back after a few batches', async ({
  page: p,
  setCourseNav,
}) => {
  let asked = 0;
  await p.route(`${ORIGIN}/api/v1/users/self/history**`, (route) => {
    asked += 1;
    return route.fulfill({
      json: HISTORY.slice(0, 1),
      headers: {
        Link: `<${ORIGIN}/api/v1/users/self/history?page=${String(asked + 1)}>; rel="next"`,
      },
    });
  });
  await setCourseNav(true);
  await p.goto(`${ORIGIN}/`);

  await expect(p.locator('.cpp-nav-recent .cpp-nav-name')).toHaveCount(1);
  expect(asked).toBe(4);
});

test('a school without page history just has no recent pages', async ({
  page: p,
  setCourseNav,
}) => {
  await p.route(`${ORIGIN}/api/v1/users/self/history`, (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await setCourseNav(true);
  await p.goto(`${ORIGIN}/`);

  await expect(courses(p)).toBeVisible();
  await expect(p.locator('.cpp-nav-recent')).toHaveCount(0);
});

test("Canvas's buttons stay when the courses can't be loaded", async ({
  page: p,
  setCourseNav,
}) => {
  await p.route(`${ORIGIN}/api/v1/dashboard/dashboard_cards`, (route) =>
    route.fulfill({ status: 500, body: '' }),
  );
  await setCourseNav(true);
  await p.goto(`${ORIGIN}/`);

  await expect(nav(p).locator('#global_nav_courses_link')).toBeVisible();
  await expect(courses(p)).toHaveCount(0);
});

test('the list comes from the saved copy, and another user gets their own', async ({
  page: p,
  setCourseNav,
}) => {
  await setCourseNav(true);
  await p.goto(`${ORIGIN}/`);
  await expect(courses(p).getByRole('listitem')).toHaveCount(2);

  let asked = 0;
  await p.route(`${ORIGIN}/api/v1/dashboard/dashboard_cards`, (route) => {
    asked += 1;
    return route.fulfill({ json: CARDS.slice(0, 1) });
  });
  await p.reload();
  await expect(courses(p).getByRole('listitem')).toHaveCount(2);
  expect(asked).toBe(0);

  await serve(
    p,
    '/',
    canvas('context-user_2', '<main>Dashboard</main>').replace(
      'A Student',
      'Someone Else',
    ),
  );
  await p.reload();
  await expect(courses(p).getByRole('listitem')).toHaveCount(1);
  expect(asked).toBe(1);
});

test('turning it off puts the nav back, without a reload', async ({
  page: p,
  setCourseNav,
}) => {
  await setCourseNav(true);
  await p.goto(`${ORIGIN}/courses/1/modules`);
  await expect(courses(p)).toBeVisible();

  await setCourseNav(false);
  await expect(p.locator('.cpp-nav')).toHaveCount(0);
  await expect(p.locator('#left-side')).toBeVisible();
  await expect(nav(p).locator('#global_nav_courses_link')).toBeVisible();
  expect((await nav(p).boundingBox())?.width).toBe(84);
});

test('collapsed, it keeps a dot and number for each course', async ({
  page: p,
  setCourseNav,
}) => {
  await setCourseNav(true);
  await p.goto(`${ORIGIN}/courses/1/modules`);
  await expect(courses(p)).toBeVisible();
  await p.evaluate(() => {
    document.body.classList.remove('primary-nav-expanded');
  });

  await expect(courses(p).locator('.cpp-nav-short').first()).toHaveText('338');
  await expect(courses(p).locator('.cpp-nav-name').first()).toBeHidden();
  await expect(p.locator('.cpp-nav-groups')).toBeHidden();
  await expect(p.locator('.cpp-nav-recent')).toBeHidden();
  expect((await nav(p).boundingBox())?.width).toBe(54);
});

test('a tray starts in place, without sliding', async ({
  page: p,
  setCourseNav,
}) => {
  await serve(
    p,
    '/',
    canvas(
      'context-user_1',
      `<style>
        .transition--slide-left-exited {
          opacity: 0.01 !important;
          transform: translateX(-100%) !important;
          transition: transform 0.3s !important;
        }
      </style>
      <div id="nav-tray-portal">
        <span data-cid="Tray">
          <span class="transition--slide-left-exited" style="display: block">
            Tray
          </span>
        </span>
      </div>`,
    ),
  );
  await setCourseNav(true);
  await p.goto(`${ORIGIN}/`);

  const tray = p.locator('.transition--slide-left-exited');
  await expect(tray).toHaveCSS('transform', 'none');
  await expect(tray).toHaveCSS('opacity', '1');
  await expect(tray).toHaveCSS('transition-duration', '0s');
});

test('a signed-out page and a narrow window are left alone', async ({
  page: p,
  setCourseNav,
}) => {
  await serve(p, '/', canvas('context-user_1', '', false));
  await setCourseNav(true);
  await p.goto(`${ORIGIN}/`);
  await expect(p.locator('html')).toHaveAttribute('data-cpp-course-nav', '');
  await expect(p.locator('.cpp-nav')).toHaveCount(0);
  expect((await nav(p).boundingBox())?.width).toBe(84);

  await serve(p, '/', canvas('context-user_1', ''));
  await p.setViewportSize({ width: 700, height: 800 });
  await p.goto(`${ORIGIN}/`);
  await expect(courses(p)).toHaveCount(1);
  expect((await nav(p).boundingBox())?.width).toBe(84);
  await p.setViewportSize({ width: 1280, height: 800 });
});
