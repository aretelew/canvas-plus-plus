// On a New Quizzes result, a multiple choice question answered wrong gets its
// correct answer boxed in green, and the notes under wrong picks hide, while
// the setting is on.

import { expect, test } from '../extension';

const URL =
  'https://fixture.instructure.com/courses/1/assignments/2/submissions/3';
const RESULTS =
  'https://fixture.instructure.com/courses/1/assignments/2/taking/4/results';

// the submission page, which shows the results in a frame
const PAGE = `<!doctype html><title>Submission</title>
<iframe src="${RESULTS}" style="width: 800px; height: 600px"></iframe>`;

// New Quizzes' markup for the question, trimmed: the correct answer plain, the
// wrong one picked and boxed in red with the note under it
const option = (text: string, picked = false) => `
  <div data-cid="RadioInput"><div>
    <input type="radio" name="q" disabled ${picked ? 'checked' : ''}>
    <label><span><div class="user_content"><p>${text}</p></div></span></label>
  </div></div>`;
const FRAME = `<!doctype html><title>Results</title>
<div data-automation="sdk-app">
  <div data-automation="sdk-item-wrapper"><div>
    <p>What is the purpose of inet_pton?</p>
    <div class="right">${option('Presentation format to network format')}</div>
    <div><div class="fs-mask">
      <div style="border: 2px solid #e62429">${option('Network format to presentation format', true)}</div>
      <div class="note"><span>Correct Answer:</span>
        <div class="user_content"><p>Presentation format to network format</p></div></div>
    </div></div>
    <div>${option('Network short to host')}</div>
  </div></div>
  <div data-automation="sdk-item-wrapper"><div>
    <p>Which socket families are available on Linux?</p>
    <div><div class="fs-mask">
      <div style="border: 2px solid #e62429"><div data-cid="Checkbox"><div>
        <input type="checkbox" disabled checked>
        <label><span><div class="user_content"><p>Echogram Sockets</p></div></span></label>
      </div></div></div>
      <div class="verdict"><span></span>
        <div class="user_content">Selected Answer - Incorrect</div></div>
    </div></div>
  </div></div>
</div>`;

test.beforeEach(async ({ page }) => {
  await page.route(URL, (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGE }),
  );
  await page.route(RESULTS, (route) =>
    route.fulfill({ contentType: 'text/html', body: FRAME }),
  );
});

const GREEN = 'rgb(3, 137, 61)';

test('boxes the correct answer and hides the notes', async ({
  page,
  setQuizAnswers,
}) => {
  await page.goto(URL);
  const frame = page.frameLocator('iframe');
  const right = frame.locator('.right');
  const note = frame.locator('.note');
  const verdict = frame.locator('.verdict');
  await expect(right).not.toHaveCSS('border-top-color', GREEN);

  await setQuizAnswers(true);
  await expect(right).toHaveCSS('border-top-color', GREEN);
  await expect(note).toBeHidden();
  await expect(verdict).toBeHidden();

  await setQuizAnswers(false);
  await expect(right).not.toHaveCSS('border-top-color', GREEN);
  await expect(note).toBeVisible();
  await expect(verdict).toBeVisible();
});

test('boxes answers drawn after the page loads', async ({
  page,
  setQuizAnswers,
}) => {
  await setQuizAnswers(true);
  // New Quizzes draws the results after its frame loads
  await page.route(RESULTS, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><div id="app"></div><script>
        setTimeout(() => {
          document.getElementById('app').innerHTML = ${JSON.stringify(FRAME)};
        }, 300);
      </script>`,
    }),
  );
  await page.goto(URL);
  await expect(page.frameLocator('iframe').locator('.right')).toHaveAttribute(
    'data-cpp-correct-answer',
  );
});

test('boxes answers on a results page of their own', async ({
  page,
  setQuizAnswers,
}) => {
  await setQuizAnswers(true);
  await page.goto(RESULTS);
  await expect(page.locator('.right')).toHaveAttribute(
    'data-cpp-correct-answer',
  );
});
