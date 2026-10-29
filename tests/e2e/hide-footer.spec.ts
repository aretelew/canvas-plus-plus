// The bar of Instructure's links at the bottom of every page hides while the
// setting is on.

import { expect, test } from '../extension';

const URL = 'https://fixture.instructure.com/';

// Canvas's footer, as on every page, after a little content
const PAGE = `<!doctype html><title>Dashboard</title>
<div id="content">Dashboard</div>
<footer role="contentinfo" id="footer" class="ic-app-footer">
  <a href="http://www.instructure.com" class="footer-logo ic-app-footer__logo-link">
    <span class="screenreader-only">By Instructure</span>
  </a>
  <div id="footer-links" class="ic-app-footer__links">
    <a href="https://fixture.instructure.com/privacy_policy">Privacy Policy</a>
    <a href="https://www.instructure.com/policies/canvas-lms-cookie-notice">Cookie Notice</a>
  </div>
</footer>`;

test.beforeEach(async ({ page }) => {
  await page.route(URL, (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGE }),
  );
});

test.afterEach(async ({ setHideFooter }) => {
  await setHideFooter(false);
});

test('hides the footer and shows it again', async ({ page, setHideFooter }) => {
  await page.goto(URL);
  const footer = page.locator('#footer');
  await expect(footer).toBeVisible();

  await setHideFooter(true);
  await expect(footer).toBeHidden();

  await setHideFooter(false);
  await expect(footer).toBeVisible();
});

test('stays hidden on the next page load', async ({ page, setHideFooter }) => {
  await setHideFooter(true);
  await page.goto(URL);
  await expect(page.locator('#footer')).toBeHidden();
});
