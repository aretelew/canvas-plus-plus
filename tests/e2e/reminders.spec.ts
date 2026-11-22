// Due date reminders: the switch is the browser's permission to show
// notifications. While it's on, a Canvas page sends its site's upcoming work
// to the background, which keeps it to remind the user of; work that's done
// or past due isn't kept. A test can't answer the browser's prompt, so the
// notices themselves go untested here (schedule.test.ts has what they say).

import { expect, openPopup, test } from '../extension';

// the extension's storage, from the popup
declare const chrome: {
  storage: {
    local: {
      get(key: string): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
};

const ORIGIN = 'https://fixture.instructure.com';
const DAY = 24 * 60 * 60 * 1000;
// the content script runs on the real clock
const inDays = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString();

const item = (id: string, title: string, date: string, submitted = false) => ({
  course_id: '1',
  context_name: 'Intro to Operating Systems',
  plannable_id: id,
  plannable_type: 'assignment',
  plannable_date: date,
  plannable: { title },
  html_url: `/courses/1/assignments/${id}`,
  submissions: { submitted, redo_request: false },
  planner_override: null,
});

test.beforeEach(async ({ page }) => {
  await page.route(`${ORIGIN}/`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Dashboard</title><div id="content"></div>',
    }),
  );
  await page.route(`${ORIGIN}/api/v1/planner/items?**`, (route) =>
    route.fulfill({
      json: [
        item('1', 'Midterm 2', inDays(-1)),
        item('2', 'Lab 4', inDays(1), true),
        item('3', 'Assignment - Shell', inDays(2)),
      ],
    }),
  );
});

test('the switch starts off', async ({ context }) => {
  const popup = await openPopup(context);
  await popup.getByRole('button', { name: 'Courses' }).click();
  await expect(
    popup.getByRole('switch', { name: 'Due date reminders' }),
  ).not.toBeChecked();
  await popup.close();
});

test('its hint shows from the info button, not the row', async ({
  context,
}) => {
  const popup = await openPopup(context);
  await popup.getByRole('button', { name: 'Courses' }).click();
  const hint = popup.getByRole('tooltip');
  // the row's label text, at its start
  await popup
    .getByRole('switch', { name: 'Due date reminders' })
    .locator('xpath=ancestor::label')
    .hover({ position: { x: 24, y: 12 } });
  await expect(hint).toBeHidden();
  await popup.getByRole('button', { name: 'About Due date reminders' }).hover();
  await expect(hint).toHaveText(/allow your browser's notifications/);
  await popup.close();
});

test('a Canvas page sends its upcoming work while reminders are on', async ({
  context,
  page,
}) => {
  const popup = await openPopup(context);
  // as the background has it once notifications are allowed
  await popup.evaluate(() =>
    chrome.storage.local.set({ reminders: { sites: {}, sent: {} } }),
  );
  await page.goto(`${ORIGIN}/`);

  await expect
    .poll(() =>
      popup.evaluate(async (origin) => {
        const { reminders } = (await chrome.storage.local.get('reminders')) as {
          reminders?: { sites: Record<string, { works: unknown[] }> };
        };
        return reminders?.sites[origin]?.works;
      }, ORIGIN),
    )
    .toEqual([
      {
        id: 'assignment/3',
        title: 'Assignment - Shell',
        url: '/courses/1/assignments/3',
        course: 'Intro to Operating Systems',
        due: expect.any(Number) as unknown,
      },
    ]);
  await popup.close();
});
