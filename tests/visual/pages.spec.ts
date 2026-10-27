// Screenshots every recorded Canvas page with the theme off and on, replayed
// offline from its HAR. Fixtures and baselines are personal data and live in
// the gitignored tests/fixtures/; record them with `npm run fixtures:record`.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { expect, test } from '../extension';
import type { Har } from '../record/clean-har';

const PAGES = 'tests/fixtures/pages';

interface Fixture {
  name: string;
  har: string;
  url: string;
  recordedAt: Date;
}

const fixtures: Fixture[] = existsSync(PAGES)
  ? readdirSync(PAGES)
      .filter((f) => f.endsWith('.har'))
      .map((f) => {
        const har = join(PAGES, f);
        const [first] = (JSON.parse(readFileSync(har, 'utf8')) as Har).log
          .entries;
        if (!first) throw new Error(`${har} has no requests`);
        return {
          name: basename(f, '.har'),
          har,
          url: first.request.url,
          recordedAt: new Date(first.startedDateTime),
        };
      })
  : [];

test('fixtures are recorded', () => {
  test.skip(
    fixtures.length === 0,
    'no fixtures: run `npm run fixtures:record -- <canvas url>`',
  );
});

for (const fixture of fixtures) {
  for (const mode of ['off', 'on'] as const) {
    test(`${fixture.name} (theme ${mode})`, async ({ page, setTheme }) => {
      await setTheme(mode === 'on');
      // relative dates ("due in 2 days") render as they did when recorded
      await page.clock.install({ time: fixture.recordedAt });
      await page.routeFromHAR(fixture.har, { notFound: 'abort' });
      await page.goto(fixture.url);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot(`${fixture.name}-${mode}.png`, {
        fullPage: true,
      });
    });
  }
}
