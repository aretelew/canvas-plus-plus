// The "S" buttons SensusAccess Inside adds to course pages hide while the
// setting is on.

import type { Page } from '@playwright/test';
import { expect, test } from '../extension';

const URL = 'https://fixture.instructure.com/courses/1/modules';

// A module row and a page heading, with the buttons as SensusAccess adds them
const PAGE = `<!doctype html><title>Modules</title>
<div class="page-heading">
  <h1>Week 1</h1>
  <div class="sensus-button-div is-content-button sensus-access-button-item">
    <button class="sensus_access_button" aria-label="Convert the page with SensusAccess Inside">S</button>
  </div>
</div>
<div class="ig-row">
  <a class="ig-title" href="/courses/1/files/1">Reading</a>
  <div class="sensus-button-div sensus-access-button-item ig-admin">
    <button class="sensus_access_button" aria-label="Convert the file with SensusAccess Inside">S</button>
  </div>
</div>`;

const PAGES_URL = 'https://fixture.instructure.com/courses/1/pages';

// The Pages list: its buttons are table cells, and SensusAccess adds an empty
// header cell to match them
const pagesList = (cell: string) =>
  `<!doctype html><title>Pages</title>
<div class="collectionView">
  <table>
    <thead><tr class="header-row"><th>Page title</th><th>Last edit</th><th></th></tr></thead>
    <tbody class="collectionViewItems">
      <tr><td><a href="/courses/1/pages/reading">Reading</a></td><td>Oct 1</td>${cell}</tr>
    </tbody>
  </table>
</div>`;

const SENSUS_CELL = `<td class="gridcell sensus-button-td sensus-access-button-item">
  <button class="sensus_access_button" aria-label="Convert the file with SensusAccess Inside">S</button>
</td>`;

const SETTINGS_URL = 'https://fixture.instructure.com/courses/1/settings';

const SETTINGS = `<!doctype html><title>Course Settings</title>
<div id="right-side">
  <a class="Button Button--link" href="/courses/1/statistics">Course Statistics</a>
  <a class="Button Button--link Button--link--has-divider sensus-enable-disable Button--course-settings validator_link" href="#">Disable SensusAccess Inside</a>
</div>`;

const serve = async (page: Page, url: string, body: string) => {
  await page.route(url, (route) =>
    route.fulfill({ contentType: 'text/html', body }),
  );
  await page.goto(url);
};

test.afterEach(async ({ setHideSensus }) => {
  await setHideSensus(false);
});

test('hides the buttons and shows them again', async ({
  page,
  setHideSensus,
}) => {
  await serve(page, URL, PAGE);
  const buttons = page.getByRole('button', { name: /SensusAccess/ });
  await expect(buttons).toHaveCount(2);
  await expect(page.locator('.ig-title')).toBeVisible();

  await setHideSensus(true);
  await expect(buttons).toHaveCount(0);
  await expect(page.locator('.ig-title')).toBeVisible();

  await setHideSensus(false);
  await expect(buttons).toHaveCount(2);
});

test('stays hidden on the next page load', async ({ page, setHideSensus }) => {
  await setHideSensus(true);
  await serve(page, URL, PAGE);
  await expect(page.getByRole('heading', { name: 'Week 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: /SensusAccess/ })).toHaveCount(
    0,
  );
});

test('the Pages list loses its extra header cell, so columns line up', async ({
  page,
  setHideSensus,
}) => {
  await setHideSensus(true);
  await serve(page, PAGES_URL, pagesList(SENSUS_CELL));
  await expect(page.locator('.sensus-access-button-item')).toBeHidden();
  await expect(page.locator('tr.header-row > th:visible')).toHaveCount(2);
  await expect(page.locator('tbody tr > td:visible')).toHaveCount(2);
});

test("a list without the buttons keeps Canvas's own empty header cell", async ({
  page,
  setHideSensus,
}) => {
  await setHideSensus(true);
  await serve(page, PAGES_URL, pagesList('<td>⋮</td>'));
  await expect(page.locator('tr.header-row > th:visible')).toHaveCount(3);
});

test('hides the enable/disable link in Course Settings', async ({
  page,
  setHideSensus,
}) => {
  await setHideSensus(true);
  await serve(page, SETTINGS_URL, SETTINGS);
  await expect(
    page.getByRole('link', { name: 'Course Statistics' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /SensusAccess/ })).toBeHidden();
});
