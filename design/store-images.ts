// Renders the Chrome Web Store screenshots (1280×800) into store/screenshots/:
// the built extension running on the recorded Canvas dashboard, with every
// course, grade, assignment, name and school mark swapped for made-up ones
// before Canvas draws them, laid out on slides with a headline each.
//
//   npm run store-images
//
// Needs the recorded fixtures (tests/fixtures/, see `npm run fixtures:record`).
// Look over every image before uploading: they're meant to hold no real data.

import type { BrowserContext, Locator, Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extensionId, launchWithExtension } from '../tests/chrome.ts';

const EXTENSION = resolve('.output/chrome-mv3');
const HAR = 'tests/fixtures/pages/dashboard.har';
const ORIGIN = 'https://fixture.instructure.com';
const OUT = 'store/screenshots';

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

// Canvas's default (unbranded) navigation, and no logo
const UNBRANDED = `
  :root {
    --ic-brand-global-nav-bgd: #2d3b45 !important;
    --ic-brand-global-nav-logo-bgd: #2d3b45 !important;
    --ic-brand-header-image: none !important;
  }
  .ic-app-header__logomark-container, #right-side-wrapper, #footer,
  #DashboardOptionsMenu_Container, .ic-Dashboard-header__actions { display: none !important; }
`;

async function openDashboard(page: Page): Promise<void> {
  await page.routeFromHAR(HAR, { notFound: 'abort' });
  // the school's own CSS and JS overrides
  await page.route('https://instructure-uploads.s3.amazonaws.com/**', (r) =>
    r.abort(),
  );
  await page.route(`${ORIGIN}/`, (r) =>
    r.fulfill({ contentType: 'text/html', body: DEMO_PAGE }),
  );
  await page.route(`${ORIGIN}/api/v1/dashboard/dashboard_cards**`, (r) =>
    r.fulfill({ json: cards }),
  );
  await page.route(`${ORIGIN}/dashboard-sidebar**`, (r) =>
    r.fulfill({ contentType: 'text/html', body: '' }),
  );
  await page.route(`${ORIGIN}/api/v1/courses/*/activity_stream/summary`, (r) =>
    r.fulfill({ json: [] }),
  );
  // the nav's Inbox and Help badges
  await page.route(`${ORIGIN}/api/v1/*/unread_count`, (r) =>
    r.fulfill({ json: { unread_count: 0 } }),
  );
  await page.route(`${ORIGIN}/api/v1/courses?**`, (r) =>
    r.fulfill({ json: scores }),
  );
  await page.route(`${ORIGIN}/api/v1/planner/items?**`, (r) =>
    r.fulfill({ json: plannerItems }),
  );
  await page.goto(`${ORIGIN}/`);
  await page.addStyleTag({ content: UNBRANDED });
  await page.locator('.cpp-card-due').first().waitFor();
  await page.locator('.cpp-card-grade').first().waitFor();
  await page.waitForLoadState('networkidle');
}

// --- the browser -------------------------------------------------------------

declare const chrome: {
  storage: { sync: { set(items: Record<string, unknown>): Promise<void> } };
};

async function settings(
  context: BrowserContext,
  values: Record<string, boolean>,
): Promise<void> {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId(EXTENSION)}/popup.html`);
  await popup.evaluate((v) => chrome.storage.sync.set(v), values);
  await popup.close();
}

// twice the pixels, so shots stay sharp when the slides scale them
const context = await launchWithExtension(EXTENSION, { deviceScaleFactor: 2 });

// --- shots of the product ------------------------------------------------------

const THEMES = {
  light: { themeEnabled: false, themeOled: false },
  dark: { themeEnabled: true, themeOled: false },
  oled: { themeEnabled: true, themeOled: true },
};

interface DashboardBuffers {
  // the dashboard up to its cards' right edge
  page: Buffer;
  // the tops of the first row of cards: color, grade and name
  row: Buffer;
  // one card on its own
  card: Buffer;
}

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (!found) throw new Error(`${locator.toString()} isn't on screen`);
  return found;
}

async function dashboardBuffers(
  theme: keyof typeof THEMES,
): Promise<DashboardBuffers> {
  await settings(context, {
    ...THEMES[theme],
    cardGrades: true,
    cardAssignments: true,
  });
  const page = await context.newPage();
  await openDashboard(page);
  const cards = page.locator('.ic-DashboardCard');
  const first = await box(cards.nth(0));
  const third = await box(cards.nth(2));
  const due = await box(page.locator('.cpp-card-due').first());
  const pad = 24;
  const shots = {
    page: await page.screenshot({
      clip: { x: 0, y: 0, width: third.x + third.width + 40, height: 800 },
    }),
    row: await page.screenshot({
      clip: {
        x: first.x - pad,
        y: first.y - pad,
        width: third.x + third.width - first.x + 2 * pad,
        height: due.y - first.y + pad,
      },
    }),
    card: await cards.nth(1).screenshot(),
  };
  await page.close();
  return shots;
}

async function popupBuffer(): Promise<Buffer> {
  await settings(context, {
    ...THEMES.dark,
    cardGrades: true,
    cardAssignments: true,
  });
  const popup = await context.newPage();
  await popup.emulateMedia({ colorScheme: 'dark' });
  await popup.goto(`chrome-extension://${extensionId(EXTENSION)}/popup.html`);
  await popup
    .getByRole('switch', { name: 'Dark theme', checked: true })
    .waitFor();
  const shot = await popup.locator('main').screenshot();
  await popup.close();
  return shot;
}

const light = await dashboardBuffers('light');
const dark = await dashboardBuffers('dark');
const oled = await dashboardBuffers('oled');
const popup = await popupBuffer();

// --- slides --------------------------------------------------------------------

const src = (shot: Buffer) =>
  `data:image/png;base64,${shot.toString('base64')}`;
// inlined, so it takes the slide's text color
const MARK = readFileSync(new URL('mark.svg', import.meta.url), 'utf8');

// the promo tile's grid of pluses, every 24px
const pluses = (color: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path stroke="${color}" stroke-width="1.5" d="M12 8v8M8 12h8"/></svg>`,
  )}")`;

interface Slide {
  file: string;
  headline: string;
  text: string;
  dark?: boolean;
  // where the art column sits; it's centered top to bottom
  left: number;
  width: number;
  art: string;
}

const frame = (inner: string) => `<div class="frame">${inner}</div>`;

const SLIDES: Slide[] = [
  {
    file: '1-calmer.png',
    headline: 'A calmer<br>Canvas',
    text: 'A dark theme made for Canvas, with no white flash between pages.',
    left: 500,
    width: 740,
    // the same dashboard, light giving way to dark
    art: frame(`
      <img src="${src(light.page)}">
      <img src="${src(dark.page)}" class="over" style="clip-path: polygon(58% 0, 100% 0, 100% 100%, 38% 100%)">`),
  },
  {
    file: '2-grades.png',
    headline: 'Your grade on every card',
    text: 'See where you stand in each course without opening Grades.',
    // large enough to read the grades, so it runs off the right edge
    left: 520,
    width: 1000,
    art: frame(`<img src="${src(dark.row)}">`),
  },
  {
    file: '3-assignments.png',
    headline: "What's due,<br>on the card",
    text: "Check work off there, and Canvas's own To Do list updates too.",
    left: 700,
    width: 420,
    art: frame(`<img src="${src(light.card)}">`),
  },
  {
    file: '4-true-black.png',
    headline: 'True black<br>for OLED',
    text: 'A pure black version of the dark theme, easy on OLED screens.',
    dark: true,
    left: 500,
    width: 740,
    art: frame(`<img src="${src(oled.page)}">`),
  },
  {
    file: '5-more-to-come.png',
    headline: 'More on<br>the way',
    text: 'Turn on only the features you want. No account, no server, no tracking.',
    left: 700,
    width: 420,
    // the popup, with a dashed card where the next feature goes
    art: `${frame(`<img src="${src(popup)}">`)}
      <div class="soon">
        <svg class="plus" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#8ab4ff"/><path d="M20 12v16M12 20h16" stroke="#1b1e24" stroke-width="3" stroke-linecap="round"/></svg>
        <div><b>More features coming soon</b><span>canvas++ is just getting started.</span></div>
      </div>`,
  },
];

const html = (slide: Slide) => `<!doctype html>
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,700&display=block" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1280px; height: 800px; overflow: hidden; position: relative;
    font-family: Satoshi, sans-serif;
    --ink: ${slide.dark ? '#f2f4f8' : '#1b1e24'};
    --muted: ${slide.dark ? '#a3abb8' : '#5a6270'};
    background: ${pluses(slide.dark ? '#16181d' : '#e3e9f3')} -12px -12px,
      ${slide.dark ? '#000' : '#f3f6fb'};
  }
  .copy { position: absolute; left: 80px; top: 0; bottom: 0; width: 380px;
    display: flex; flex-direction: column; justify-content: center; }
  h1 { font-size: 60px; line-height: 1.05; font-weight: 700; letter-spacing: -0.025em;
    color: var(--ink); }
  p { margin-top: 24px; font-size: 22px; line-height: 1.45; color: var(--muted); }
  .logo { position: absolute; left: 80px; bottom: 48px; width: 50px; height: 48px;
    color: var(--ink); }
  .logo svg { display: block; width: 100%; height: 100%; }
  .art { position: absolute; top: 50%; transform: translateY(-50%);
    display: flex; flex-direction: column; gap: 20px; }
  .frame { position: relative; border-radius: 14px; overflow: hidden;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.08), 0 24px 60px rgb(20 30 50 / ${slide.dark ? '0.6' : '0.18'});
    outline: 1px solid ${slide.dark ? '#2a2e36' : 'rgb(20 30 50 / 0.06)'}; }
  .frame img { display: block; width: 100%; }
  .frame .over { position: absolute; inset: 0; }
  .soon { display: flex; align-items: center; gap: 16px; padding: 20px 22px;
    border: 2px dashed #b9c4d4; border-radius: 14px; background: rgb(255 255 255 / 0.6); }
  .soon b { display: block; font-size: 20px; font-weight: 700; color: var(--ink); }
  .soon span { font-size: 17px; color: var(--muted); }
  .plus { flex: none; width: 44px; height: 44px; }
</style>
<body>
  <div class="copy"><h1>${slide.headline}</h1><p>${slide.text}</p></div>
  <div class="art" style="left: ${String(slide.left)}px; width: ${String(slide.width)}px">${slide.art}</div>
  <div class="logo">${MARK}</div>
</body>`;

mkdirSync(OUT, { recursive: true });
const page = await context.newPage();
await page.setViewportSize({ width: 1280, height: 800 });
for (const slide of SLIDES) {
  await page.setContent(html(slide), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${slide.file}`, scale: 'css' });
}
await context.close();
