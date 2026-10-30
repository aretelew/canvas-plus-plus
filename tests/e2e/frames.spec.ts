// Same-origin frames without a URL of their own, like the Rich Content
// Editor's (TinyMCE writes its document into an iframe with no src), checked
// on a synthetic page (no personal data, so it runs anywhere).

import { expect, test } from '../extension';

const URL = 'https://fixture.instructure.com/frames';

const EDITOR = `<!doctype html><html><head><style>
  body { background: #fff; color: #2d3b45; }
</style></head><body id="tinymce" class="mce-content-body"><p>A reply</p></body></html>`;

const PAGE = `<!doctype html><title>t</title>
<body>
  <iframe id="reply_ifr"></iframe>
  <script>
    const doc = document.getElementById('reply_ifr').contentDocument;
    doc.open();
    doc.write(${JSON.stringify(EDITOR)});
    doc.close();
  </script>
</body>`;

test('an editor iframe written by script is themed', async ({
  page,
  setTheme,
}) => {
  await setTheme('dark');
  await page.route(URL, (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGE }),
  );
  await page.goto(URL);
  const body = page.frameLocator('#reply_ifr').locator('body');
  await expect(body).toHaveCSS('background-color', 'rgb(21, 23, 28)');
  await expect(body.locator('p')).toHaveCSS('color', 'rgb(227, 229, 232)');
  // what the editor shows is what gets saved: nothing of ours in the content
  const tagged = await body.evaluate((body) =>
    [body, ...body.querySelectorAll('*')]
      .filter((el) =>
        [...el.attributes].some(
          ({ name, value }) =>
            name.startsWith('data-cpp') ||
            (name === 'style' && value.includes('--cpp')),
        ),
      )
      .map((el) => el.outerHTML),
  );
  expect(tagged).toHaveLength(0);
});
