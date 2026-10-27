// Records Canvas pages as replayable HAR fixtures.
//
//   npm run fixtures:record -- https://canvas.case.edu
//
// Opens Chrome for Testing; sign in yourself (Canvas's session ends when the
// browser closes, so every run asks). It then visits a fixed set of student
// pages and saves one cleaned HAR per page to tests/fixtures/pages/.
// Everything under tests/fixtures/ is personal data and gitignored.
//
// Read-only, except that Canvas marks the opened announcement, discussion and
// inbox as read.

import { chromium, type Page } from '@playwright/test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromePath } from '../chrome.ts';
import { cleanHar, type Har } from './clean-har.ts';
import { discoverPages, type FixturePage } from './discover.ts';

const arg = process.argv[2];
if (!arg) {
  console.error('usage: npm run fixtures:record -- https://<your canvas>');
  process.exit(1);
}
const origin = new URL(arg).origin;
const outDir = resolve('tests/fixtures/pages');

async function waitForSignIn(page: Page): Promise<void> {
  await page.goto(origin);
  console.log(`Sign in to ${origin} in the browser window that just opened…`);
  for (const deadline = Date.now() + 15 * 60_000; Date.now() < deadline;) {
    const signedIn = await page
      .evaluate(() =>
        Boolean(
          (window as { ENV?: { current_user_id?: string } }).ENV
            ?.current_user_id,
        ),
      )
      .catch(() => false); // mid-redirect during SSO
    if (signedIn && new URL(page.url()).origin === origin) return;
    await page.waitForTimeout(2000);
  }
  throw new Error('Timed out waiting for sign-in');
}

async function recordAll(home: Page, tmp: string): Promise<FixturePage[]> {
  await waitForSignIn(home);
  const pages = await home.evaluate(discoverPages);
  console.log(`Recording ${String(pages.length)} pages…`);
  for (const { name, path } of pages) {
    const page = await home.context().newPage();
    await page.routeFromHAR(join(tmp, `${name}.har`), {
      update: true,
      updateContent: 'embed',
      updateMode: 'full',
    });
    await page.goto(origin + path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500); // let React parts finish rendering
    await page.close();
    console.log(`  ✓ ${name}  ${path}`);
  }
  return pages;
}

const context = await chromium.launchPersistentContext(
  resolve('tests/fixtures/.profile'),
  {
    executablePath: chromePath(),
    headless: false,
    viewport: { width: 1280, height: 800 },
  },
);

// raw HARs hold login cookies: keep them outside the repo and delete them
const tmp = mkdtempSync(join(tmpdir(), 'canvaspp-har-'));
try {
  let pages: FixturePage[];
  try {
    pages = await recordAll(
      context.pages()[0] ?? (await context.newPage()),
      tmp,
    );
  } finally {
    await context.close(); // this is what writes the HARs
  }

  mkdirSync(outDir, { recursive: true });
  for (const { name } of pages) {
    const raw = JSON.parse(
      readFileSync(join(tmp, `${name}.har`), 'utf8'),
    ) as Har;
    writeFileSync(
      join(outDir, `${name}.har`),
      JSON.stringify(cleanHar(raw, origin)),
    );
  }
  console.log(`Saved to ${outDir}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
