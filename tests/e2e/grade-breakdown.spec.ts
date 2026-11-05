// The Grades page's sidebar shows the total with its letter and every group
// with its grade and weight, read from what Canvas's scripts write into the
// table, and follows them as they recalculate (What-If scores). Canvas's own
// sidebar hides while it's there, its controls behind a ⋯ menu that clicks
// them, and comes back when it's turned off.

import type { Page } from '@playwright/test';
import { expect, test } from '../extension';

const ORIGIN = 'https://fixture.instructure.com';

const groupRow = (name: string, grade: string, points: string) => `
  <tr class="student_assignment hard_coded group_total">
    <th class="title" scope="row">${name}</th>
    <td class="assignment_score"><span class="tooltip"><span class="grade">${grade}</span></span></td>
    <td class="details"><span class="possible points_possible">${points}</span></td>
  </tr>`;

const weightRow = (name: string, weight: string) =>
  `<tr><th scope="row">${name}</th><td>${weight}</td></tr>`;

// as Canvas's server renders it, with its scripts' grades filled in; the
// buttons' onclick stand in for what Canvas's scripts do
const GRADES = `<!doctype html><title>Grades</title>
<script>
  ENV = {"course_active_grading_scheme":{"title":"Default","points_based":false,"data":[{"name":"A","value":0.94},{"name":"A-","value":0.9},{"name":"B+","value":0.87},{"name":"B","value":0.84},{"name":"F","value":0.0}]}};
</script>
<div id="content">
  <table id="grades_summary"><tbody>
    ${groupRow('Assignments', '90.63%', '29.00 / 32.00')}
    ${groupRow('Exams', '86.84%', '66.00 / 76.00')}
    ${groupRow('Final Exam', 'N/A', '0.00 / 0.00')}
    ${groupRow('Imported Assignments', 'N/A', '0.00 / 0.00')}
  </tbody></table>
</div>
<aside id="right-side">
  <div id="student-grades-right-content">
    <div class="student_assignment final_grade">
      Total: <span class="grade">89.67%</span>
      (<span class="letter_grade" id="final_letter_grade_text">B+</span>)
    </div>
    <div id="student-grades-whatif" class="show_guess_grades exists" style="display: block;">
      <button type="button" class="show_guess_grades_link" onclick="this.parentElement.style.display = 'none'">Show Saved "What-If" Scores</button>
    </div>
    <div id="student-grades-revert" style="display: none;">
      *NOTE*: This is NOT your official score.
      <button id="revert-all-to-actual-score" onclick="this.parentElement.style.display = 'none'">Revert to Actual Score</button>
    </div>
    <div id="student-grades-show-all">
      <button id="show_all_details_button" onclick="this.textContent = this.classList.toggle('showAll') ? 'Hide All Details' : 'Show All Details'">Show All Details</button>
    </div>
    <div id="assignments-not-weighted">
      <div aria-label="Assignment Weights">
        <h2>Assignments are weighted by group:</h2>
        <table class="summary"><tbody>
          ${weightRow('Assignments', '20%')}
          ${weightRow('Exams', '40%')}
          ${weightRow('Final Exam', '40%')}
          ${weightRow('Imported Assignments', '0%')}
          <tr style="font-weight: bold;"><th scope="row">Total</th><td>100%</td></tr>
        </tbody></table>
      </div>
      <div id="only_consider_graded_assignments_wrapper">
        <input type="checkbox" id="only_consider_graded_assignments" checked>
        <label for="only_consider_graded_assignments">Calculate based only on graded assignments</label>
      </div>
    </div>
    <div id="whatif-score-description">You can view your grades based on What-If scores…</div>
  </div>
</aside>`;

const breakdown = (page: Page) => page.locator('.cpp-grades');
const groups = (page: Page) => breakdown(page).locator('li');
const more = (page: Page) =>
  page.getByRole('button', { name: 'Grade options' });
const items = (page: Page) =>
  breakdown(page).locator('.cpp-grades-item:visible');

test.beforeEach(async ({ page }) => {
  await page.route(`${ORIGIN}/courses/1/grades`, (route) =>
    route.fulfill({ contentType: 'text/html', body: GRADES }),
  );
});

test.afterEach(async ({ setGradeBreakdown }) => {
  await setGradeBreakdown(false);
});

test('the sidebar shows the total and every group that counts', async ({
  page,
  setGradeBreakdown,
}) => {
  await setGradeBreakdown(true);
  await page.goto(`${ORIGIN}/courses/1/grades`);
  await expect(breakdown(page).locator('.cpp-grades-score')).toHaveText(
    '89.67% B+',
  );
  await expect(breakdown(page).locator('.cpp-grades-note')).toHaveText([
    '0.33% to A-',
    'Based on 60% of the grade so far',
  ]);
  // the empty group worth nothing is left out
  await expect(groups(page)).toHaveText([
    /^Assignments90\.63%20% of grade · 29 \/ 32 pts$/,
    /^Exams86\.84%40% of grade · 66 \/ 76 pts$/,
    /^Final Exam–40% of grade$/,
  ]);
  await expect(
    groups(page).first().locator('.cpp-grades-bar > span'),
  ).toHaveAttribute('style', 'width: 90.63%;');
  // Canvas's sidebar gives way
  for (const canvas of [
    '.final_grade',
    'table.summary',
    '#whatif-score-description',
    '#show_all_details_button',
    '.show_guess_grades_link',
    '#only_consider_graded_assignments',
  ]) {
    await expect(page.locator(canvas)).toBeHidden();
  }
});

test('the ⋯ menu holds Canvas’s controls and clicks them', async ({
  page,
  setGradeBreakdown,
}) => {
  await setGradeBreakdown(true);
  await page.goto(`${ORIGIN}/courses/1/grades`);
  await expect(breakdown(page).locator('.cpp-grades-panel')).toBeHidden();
  await more(page).click();
  await expect(more(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(items(page)).toHaveText([
    'Calculate based only on graded assignments',
    'Show All Details',
    'Show Saved "What-If" Scores',
  ]);
  await expect(breakdown(page).locator('.cpp-grades-tip')).toHaveText(
    'Click a score in the table to try a What-If grade.',
  );

  // the checkboxes follow Canvas's switches and keep the menu open; the
  // share goes with the first
  const checkbox = breakdown(page).getByRole('checkbox');
  const onlyGraded = checkbox.first();
  const details = checkbox.nth(1);
  await expect(onlyGraded).toBeChecked();
  await onlyGraded.click();
  await expect(
    page.locator('#only_consider_graded_assignments'),
  ).not.toBeChecked();
  await expect(breakdown(page).locator('.cpp-grades-note')).toHaveText([
    '0.33% to A-',
  ]);
  await expect(details).not.toBeChecked();
  await details.click();
  await expect(page.locator('#show_all_details_button')).toHaveText(
    'Hide All Details',
  );
  await expect(details).toBeChecked();
  await expect(items(page).nth(1)).toHaveText('Show All Details');
  await details.click();
  await expect(details).not.toBeChecked();
  await expect(breakdown(page).locator('.cpp-grades-panel')).toBeVisible();

  // the saved What-If scores close the menu, and go once Canvas hides its
  // button
  await items(page).filter({ hasText: 'Saved' }).click();
  await expect(breakdown(page).locator('.cpp-grades-panel')).toBeHidden();
  await more(page).click();
  await expect(items(page)).toHaveCount(2);

  await page.keyboard.press('Escape');
  await expect(breakdown(page).locator('.cpp-grades-panel')).toBeHidden();
  await expect(more(page)).toBeFocused();
  await more(page).click();
  await page.locator('#grades_summary').click();
  await expect(breakdown(page).locator('.cpp-grades-panel')).toBeHidden();
});

test('it follows Canvas as What-If scores change the grades', async ({
  page,
  setGradeBreakdown,
}) => {
  await setGradeBreakdown(true);
  await page.goto(`${ORIGIN}/courses/1/grades`);
  await expect(groups(page)).toHaveCount(3);
  // what Canvas's scripts do for a What-If score of 0 on an assignment
  await page.evaluate(() => {
    const set = (selector: string, text: string) => {
      const element = document.querySelector(selector);
      if (element) element.textContent = text;
    };
    set('.final_grade .grade', '86.35%');
    set('#final_letter_grade_text', 'B');
    set('#grades_summary tr:first-child .grade', '70.73%');
    document
      .getElementById('student-grades-revert')
      ?.style.setProperty('display', '');
  });
  await expect(breakdown(page).locator('.cpp-grades-label')).toHaveText(
    'Total with What-If',
  );
  await expect(breakdown(page).locator('.cpp-grades-score')).toHaveText(
    '86.35% B',
  );
  await expect(breakdown(page).locator('.cpp-grades-note').first()).toHaveText(
    'Actual 89.67% · Revert',
  );
  await expect(groups(page).first().locator('.cpp-grades-value')).toHaveText(
    '70.73%',
  );
  await expect(page.locator('#student-grades-revert')).toBeHidden();
  // ours clicks Canvas's, which hides its note
  await breakdown(page).getByRole('button', { name: 'Revert' }).click();
  await expect(breakdown(page).locator('.cpp-grades-label')).toHaveText(
    'Total',
  );
});

test('turning it off gives Canvas its sidebar back', async ({
  page,
  setGradeBreakdown,
}) => {
  await setGradeBreakdown(true);
  await page.goto(`${ORIGIN}/courses/1/grades`);
  await expect(breakdown(page)).toBeVisible();
  await setGradeBreakdown(false);
  await expect(breakdown(page)).toHaveCount(0);
  await expect(page.locator('.final_grade')).toBeVisible();
  await expect(page.locator('table.summary')).toBeVisible();
  await expect(page.locator('#whatif-score-description')).toBeVisible();
  await expect(page.locator('#show_all_details_button')).toBeVisible();
});
