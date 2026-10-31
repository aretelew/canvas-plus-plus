// The Canvas dashboard the store images show: the recorded page, with every
// course, grade, assignment, name and school mark swapped for made-up ones
// before Canvas draws them.
//
// Needs the recorded fixtures (tests/fixtures/, see `npm run fixtures:record`).

import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const HAR = 'tests/fixtures/pages/dashboard.har';
const ORIGIN = 'https://fixture.instructure.com';

// --- made-up data -----------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;
// the content script runs on the real clock, so dates are relative to now;
// six hours on, so work due today counts as upcoming, not past
const inDays = (days: number) =>
  new Date(Date.now() + days * DAY + 6 * 60 * 60 * 1000).toISOString();

interface DemoCourse {
  id: string;
  name: string;
  code: string;
  color: string;
  score: number;
  // title, due in days, done
  work: [string, number, boolean][];
}

const COURSES: DemoCourse[] = [
  {
    id: '101',
    name: 'Calculus I',
    code: 'MATH 121',
    color: '#D41E00',
    score: 94.2,
    work: [
      ['Problem Set 6', -2, true],
      ['Quiz: Chain Rule', 1, false],
      ['Problem Set 7', 5, false],
      ['Midterm Review', 9, false],
    ],
  },
  {
    id: '102',
    name: 'Intro to Psychology',
    code: 'PSYC 101',
    color: '#8F3E97',
    score: 88.67,
    work: [
      ['Reading Response 5', 0, true],
      ['Memory Lab Report', 3, false],
      ['Discussion: Sleep', 6, false],
    ],
  },
  {
    id: '103',
    name: 'Modern World History',
    code: 'HIST 210',
    color: '#0770A3',
    score: 91.5,
    work: [
      ['Primary Source Essay', 2, false],
      ['Map Quiz', 4, true],
      ['Chapter 9 Notes', 8, false],
    ],
  },
  {
    id: '104',
    name: 'Organic Chemistry',
    code: 'CHEM 223',
    color: '#0B874B',
    score: 79.3,
    work: [
      ['Lab 4: Distillation', -1, true],
      ['Problem Set 5', 2, false],
      ['Exam 2', 10, false],
    ],
  },
  {
    id: '105',
    name: 'Creative Writing',
    code: 'ENGL 180',
    color: '#E1185C',
    score: 97,
    work: [
      ['Short Story Draft', 1, true],
      ['Peer Review 3', 4, false],
      ['Poetry Portfolio', 12, false],
    ],
  },
  {
    id: '106',
    name: 'Data Structures',
    code: 'CSCI 260',
    color: '#BF5E00',
    score: 85.25,
    work: [
      ['Lab 6: Hash Maps', 0, false],
      ['Project 2: Graphs', 7, false],
      ['Quiz: Trees', -3, true],
    ],
  },
];

const cards = COURSES.map((c) => ({
  longName: `${c.name} - ${c.code}`,
  shortName: c.name,
  originalName: c.name,
  courseCode: c.code,
  assetString: `course_${c.id}`,
  href: `/courses/${c.id}`,
  term: 'Fall 2026',
  subtitle: 'enrolled as: Student',
  enrollmentState: 'active',
  enrollmentType: 'StudentEnrollment',
  observee: null,
  id: c.id,
  isFavorited: true,
  isK5Subject: false,
  isHomeroom: false,
  useClassicFont: false,
  canManage: false,
  canReadAnnouncements: true,
  image: null,
  color: null,
  position: null,
  published: true,
  links: (
    [
      ['announcements', 'icon-announcement', 'Announcements'],
      ['assignments', 'icon-assignment', 'Assignments'],
      ['discussions', 'icon-discussion', 'Discussions'],
      ['files', 'icon-folder', 'Files'],
    ] as const
  ).map(([kind, icon, label]) => ({
    css_class: kind,
    icon,
    hidden: null,
    path: `/courses/${c.id}/${kind}`,
    label,
  })),
  canChangeCoursePublishState: false,
  defaultView: 'modules',
  pagesUrl: `${ORIGIN}/courses/${c.id}/pages`,
  frontPageTitle: null,
}));

const scores = COURSES.map((c) => ({
  id: c.id,
  enrollments: [{ type: 'student', computed_current_score: c.score }],
}));

const plannerItems = COURSES.flatMap((c) =>
  c.work.map(([title, days, done], i) => ({
    course_id: c.id,
    plannable_id: `${c.id}-${String(i)}`,
    plannable_type: 'assignment',
    plannable_date: inDays(days),
    plannable: { title },
    html_url: `/courses/${c.id}/assignments/${c.id}-${String(i)}`,
    submissions: { submitted: done, redo_request: false },
    planner_override: null,
  })),
);

const groups = [
  { id: '201', name: 'Lab Group 4', can_access: true, course_id: '104' },
  { id: '202', name: 'Robotics Club', can_access: true },
];

const history = (
  [
    ['Problem Set 7', '/courses/101/assignments/7', 'Calculus I'],
    ['Modules', '/courses/104/modules', 'Organic Chemistry'],
    ['Project 2: Graphs', '/courses/106/assignments/2', 'Data Structures'],
  ] as const
).map(([asset_name, path, context_name], i) => ({
  asset_name,
  context_name,
  visited_url: `${ORIGIN}${path}`,
  visited_at: inDays(-i),
}));

const feedbackRow = (
  course: string,
  code: string,
  title: string,
  score: string,
  comment = '',
) => `
  <li class="event">
    <a class="recent_feedback_icon" href="/courses/${course}/assignments/1">
      <div class="event-details">
        <b class="event-details__title recent_feedback_title">${title}</b>
        <p class="event-details__context">${code}</p>
        <p><strong>${score}</strong></p>
        ${comment && `<p>${comment}</p>`}
      </div>
    </a>
  </li>`;

// what Canvas's server sends for the dashboard's right sidebar
const SIDEBAR = `
  <div class="Sidebar__TodoListContainer"></div>
  <div class="events_list recent_feedback">
    <ul class="right-side-list events">
      ${feedbackRow('105', 'ENGL 180', 'Short Story Draft', '47 out of 50', 'Love the ending.')}
      ${feedbackRow('101', 'MATH 121', 'Problem Set 6', '19 out of 20')}
      ${feedbackRow('104', 'CHEM 223', 'Lab 4: Distillation', 'A-')}
    </ul>
  </div>`;

// --- the recorded page, scrubbed ---------------------------------------------

interface HarEntry {
  request: { url: string };
  response: { content: { text?: string } };
}
const entries = (
  JSON.parse(readFileSync(HAR, 'utf8')) as { log: { entries: HarEntry[] } }
).log.entries;

const recordedPage = entries.find((e) => e.request.url === `${ORIGIN}/`)
  ?.response.content.text;
if (!recordedPage) throw new Error(`${HAR}: no dashboard page`);

// The page's ENV carries the user's courses and their colors: swap them for
// the made-up ones (the school's logo and colors are hidden by UNBRANDED).
const colors = Object.fromEntries(
  COURSES.map((c) => [`course_${c.id}`, c.color]),
);
const DEMO_PAGE = recordedPage
  .replace(
    /"custom_colors":\{[^}]*\}/g,
    `"custom_colors":${JSON.stringify(colors)}`,
  )
  .replace(
    /"STUDENT_PLANNER_COURSES":\[.*?\],"STUDENT_PLANNER_GROUPS":\[.*?\]/s,
    `"STUDENT_PLANNER_COURSES":${JSON.stringify(cards)},"STUDENT_PLANNER_GROUPS":[]`,
  );

// Canvas's default (unbranded) colors, and no logo
const UNBRANDED = `
  :root {
    --ic-brand-primary: #0374b5 !important;
    --ic-brand-header-image: none !important;
  }
  html:not([data-cpp-theme]) {
    --ic-brand-global-nav-bgd: #2d3b45 !important;
    --ic-brand-global-nav-logo-bgd: #2d3b45 !important;
    --ic-link-color: #0374b5 !important;
  }
  .ic-app-header__logomark-container, #footer,
  #DashboardOptionsMenu_Container, .ic-Dashboard-header__actions { display: none !important; }
`;

// the API calls the page and the extension make, with what each answers
const API: [path: string, json: unknown][] = [
  ['dashboard/dashboard_cards**', cards],
  ['users/self/colors', { custom_colors: colors }],
  ['users/self/groups?**', groups],
  ['users/self/history**', history],
  ['courses/*/activity_stream/summary', []],
  // the nav's Inbox and Help badges
  ['*/unread_count', { unread_count: 0 }],
  ['courses?**', scores],
  ['planner/items?**', plannerItems],
];

export async function openDashboard(page: Page): Promise<void> {
  await page.routeFromHAR(HAR, { notFound: 'abort' });
  // the school's own CSS and JS overrides
  await page.route('https://instructure-uploads.s3.amazonaws.com/**', (r) =>
    r.abort(),
  );
  await page.route(`${ORIGIN}/`, (r) =>
    r.fulfill({ contentType: 'text/html', body: DEMO_PAGE }),
  );
  await page.route(`${ORIGIN}/dashboard-sidebar**`, (r) =>
    r.fulfill({ contentType: 'text/html', body: SIDEBAR }),
  );
  for (const [path, json] of API) {
    await page.route(`${ORIGIN}/api/v1/${path}`, (r) => r.fulfill({ json }));
  }
  await page.goto(`${ORIGIN}/`);
  await page.addStyleTag({ content: UNBRANDED });
  await page.locator('.cpp-card-due').first().waitFor();
  await page.locator('.cpp-card-grade').first().waitFor();
  await page.waitForLoadState('networkidle');
}
