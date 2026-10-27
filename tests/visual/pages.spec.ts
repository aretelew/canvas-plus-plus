// Replays every recorded Canvas page offline from its HAR, once with the theme
// off and once on: each time a full-page screenshot against its baseline and a
// contrast count; the theme may not add contrast problems Canvas doesn't have.
// Fixtures and baselines are personal data and live in the gitignored
// tests/fixtures/; record them with `npm run fixtures:record`.

import {
  closeSync,
  existsSync,
  openSync,
  readdirSync,
  readSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '../extension';

const PAGES = 'tests/fixtures/pages';

interface Fixture {
  name: string;
  har: string;
  url: string;
  recordedAt: Date;
}

// Only the first request (the page itself) is needed, and it sits at the start
// of a HAR that's often 15+ MB: read the first 64 KB instead of parsing it all.
function firstRequest(har: string): { url: string; startedDateTime: string } {
  const fd = openSync(har, 'r');
  const head = Buffer.alloc(64 * 1024);
  const length = readSync(fd, head, 0, head.length, 0);
  closeSync(fd);
  const text = head.toString('utf8', 0, length);
  const entry = text.slice(text.indexOf('"entries":[{'));
  const started = /"startedDateTime":"([^"]+)"/.exec(entry)?.[1];
  const url = /"url":("(?:[^"\\]|\\.)*")/.exec(entry)?.[1];
  if (!started || !url) {
    throw new Error(`${har}: no first request in its first 64 KB`);
  }
  return { url: JSON.parse(url) as string, startedDateTime: started };
}

const fixtures: Fixture[] = existsSync(PAGES)
  ? readdirSync(PAGES)
      .filter((f) => f.endsWith('.har'))
      .map((f) => {
        const har = join(PAGES, f);
        const first = firstRequest(har);
        return {
          name: basename(f, '.har'),
          har,
          url: first.url,
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

async function open(page: Page, fixture: Fixture): Promise<void> {
  // relative dates ("due in 2 days") render as they did when recorded
  await page.clock.install({ time: fixture.recordedAt });
  await page.routeFromHAR(fixture.har, { notFound: 'abort' });
  await page.goto(fixture.url);
  await page.waitForLoadState('networkidle');
  // Under load Canvas can still be rendering after the network goes quiet, so
  // also wait for the DOM to settle (attributes excluded: our theme tags them).
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let timer = setTimeout(done, 500);
        const observer = new MutationObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(done, 500);
        });
        function done() {
          observer.disconnect();
          resolve();
        }
        observer.observe(document, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }),
  );
}

async function contrastViolations(page: Page): Promise<number> {
  const { violations } = await new AxeBuilder({ page })
    .withRules(['color-contrast'])
    .analyze();
  return violations.flatMap((v) => v.nodes).length;
}

for (const fixture of fixtures) {
  test(fixture.name, async ({ context, setTheme }) => {
    let canvasProblems = 0;
    for (const mode of ['off', 'on'] as const) {
      await test.step(`theme ${mode}`, async () => {
        await setTheme(mode === 'on');
        // a fresh tab per load: the clock and HAR routes are per page
        const page = await context.newPage();
        try {
          await open(page, fixture);
          await expect
            .soft(page)
            .toHaveScreenshot(`${fixture.name}-${mode}.png`, {
              fullPage: true,
            });
          const problems = await contrastViolations(page);
          if (mode === 'off') canvasProblems = problems;
          else {
            expect
              .soft(problems, "contrast problems Canvas doesn't already have")
              .toBeLessThanOrEqual(canvasProblems);
          }
        } finally {
          // the browser is shared with the worker's other tests
          await page.close();
        }
      });
    }
  });
}
