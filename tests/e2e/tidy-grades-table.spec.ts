// The Grades page's table gives up the room Canvas keeps for what no row
// shows: buttons hidden on every row, and empty Status, plagiarism check and
// submission progress columns. A button or column any row uses stays, on every
// row, so buttons still line up; and it follows Canvas as it changes the
// table. Turning it off gives Canvas's table back.

import type { Page } from '@playwright/test';
import { expect, test } from '../extension';

const URL = 'https://fixture.instructure.com/courses/1/grades';

const HIDDEN = 'style="visibility: hidden;"';

// a row as Canvas's server renders it: each button hidden unless `shown`
// names it, a status pill if `status`
const row = (
  id: string,
  shown: string[] = [],
  status = '',
) => `<tr class="student_assignment editable" id="row_${id}">
  <th class="title" scope="row">Assignment ${id}</th>
  <td class="due">Aug 27 by 11:59pm</td>
  <td class="submitted">Aug 27 at 9:03am</td>
  <td class="status" scope="row"> ${status} </td>
  <td class="assignment_score">5 / 5</td>
  <td class="asset_processors_cell"></td>
  <td class="details">
    ${[
      'toggle_final_grade_info',
      'toggle_score_details_link',
      'toggle_rubric_assessments_link',
      'toggle_comments_link',
    ]
      .map(
        (name) =>
          `<a href="#" class="${name} tooltip" ${shown.includes(name) ? '' : HIDDEN}><i></i></a>`,
      )
      .join(' ')}
  </td>
  <td></td>
</tr>
<tr class="comments"><td colspan="8">Comments</td></tr>`;

const gradesPage = (rows: string) => `<!doctype html><title>Grades</title>
<table id="grades_summary">
  <thead><tr>
    <th scope="col">Name</th><th scope="col">Due</th><th scope="col">Submitted</th>
    <th scope="col" class="status">Status</th>
    <th scope="col" class="assignment_score">Score</th>
    <th scope="col" id="asset_processors_header"></th>
    <th scope="col"><span class="screenreader-only">Details</span></th>
    <th scope="col"><span class="screenreader-only">Submission Progress Status</span></th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>`;

async function open(page: Page, rows: string): Promise<void> {
  await page.route(URL, (route) =>
    route.fulfill({ contentType: 'text/html', body: gradesPage(rows) }),
  );
  await page.goto(URL);
}

const shown = (page: Page, selector: string) =>
  page
    .locator(selector)
    .evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).display !== 'none'),
    );

const COLUMNS = [
  'th.status',
  'td.status',
  '#asset_processors_header',
  'td.asset_processors_cell',
  'thead th:nth-last-child(2)',
  'td.details',
  'thead th:last-child',
  'tr.student_assignment > td:last-child',
];

test.beforeEach(async ({ setTidyGradesTable }) => {
  await setTidyGradesTable(true);
});

test('columns no row fills go, header and all', async ({ page }) => {
  await open(page, row('1') + row('2'));
  await expect(page.locator('html')).toHaveAttribute('data-cpp-tidy-grades');
  for (const selector of COLUMNS) {
    expect(await shown(page, selector), selector).not.toContain(true);
  }
  // what's left still lines up: every row has as many cells as the header
  const counts = await page
    .locator('#grades_summary tr:is(thead tr, .student_assignment)')
    .evaluateAll((rows) =>
      rows.map(
        (r) =>
          [...r.children].filter((c) => getComputedStyle(c).display !== 'none')
            .length,
      ),
    );
  expect(new Set(counts)).toEqual(new Set([4]));
});

test('a button one row uses keeps its place on every row', async ({ page }) => {
  await open(page, row('1', ['toggle_comments_link']) + row('2'));
  expect(await shown(page, 'a.toggle_comments_link')).toEqual([true, true]);
  // still hidden where unused, so it holds its place without showing
  await expect(page.locator('#row_2 a.toggle_comments_link')).toBeHidden();
  for (const name of [
    'toggle_final_grade_info',
    'toggle_score_details_link',
    'toggle_rubric_assessments_link',
  ]) {
    expect(await shown(page, `a.${name}`), name).toEqual([false, false]);
  }
  expect(await shown(page, 'td.details')).toEqual([true, true]);
});

test('a status on one row keeps the Status column', async ({ page }) => {
  await open(page, row('1', [], '<span class="pill">Late</span>') + row('2'));
  expect(await shown(page, 'th.status')).toEqual([true]);
  expect(await shown(page, 'td.status')).toEqual([true, true]);
});

test('follows Canvas as it shows a button', async ({ page }) => {
  await open(page, row('1') + row('2'));
  await page
    .locator('#row_2 a.toggle_rubric_assessments_link')
    .evaluate((a) => {
      a.removeAttribute('style');
    });
  await expect
    .poll(() => shown(page, 'a.toggle_rubric_assessments_link'))
    .toEqual([true, true]);
  expect(await shown(page, 'td.details')).toEqual([true, true]);
});

test("turning it off gives Canvas's table back", async ({
  page,
  setTidyGradesTable,
}) => {
  await open(page, row('1') + row('2'));
  await setTidyGradesTable(false);
  await expect(page.locator('html')).not.toHaveAttribute(
    'data-cpp-tidy-grades',
  );
  for (const selector of COLUMNS) {
    expect(await shown(page, selector), selector).not.toContain(false);
  }
});
