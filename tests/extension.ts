// Playwright fixtures: a Chromium with the built extension loaded, and a way to
// flip the theme through the real popup.
//
// Launching Chrome takes about a second, so each worker shares one browser
// across its tests (every test still gets its own tab). Tests that need a
// browser nothing has run in yet, like first-paint checks, opt out with
// `test.use({ isolated: true })`.

import {
  test as base,
  chromium,
  expect,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { chromePath } from './chrome';

const EXTENSION = resolve('.output/chrome-mv3');

// The one extension API setTheme calls inside the popup (extension types
// aren't loaded for tests).
declare const chrome: {
  storage: { sync: { get(key: string): Promise<Record<string, unknown>> } };
};

// Chromium derives an unpacked extension's id from its absolute path.
const extensionId = createHash('sha256')
  .update(EXTENSION)
  .digest('hex')
  .slice(0, 32)
  .replace(/[0-9a-f]/g, (c) => String.fromCharCode(97 + parseInt(c, 16)));

function launch(): Promise<BrowserContext> {
  return chromium.launchPersistentContext('', {
    executablePath: chromePath(),
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
    ],
  });
}

export const test = base.extend<
  {
    isolated: boolean;
    context: BrowserContext;
    page: Page;
    setTheme: (on: boolean) => Promise<void>;
  },
  { sharedContext: () => Promise<BrowserContext> }
>({
  // started on first use, so workers that only run isolated tests skip it
  sharedContext: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires destructuring here
    async ({}, use) => {
      let shared: Promise<BrowserContext> | undefined;
      await use(() => (shared ??= launch()));
      await (await shared)?.close();
    },
    { scope: 'worker' },
  ],

  isolated: [false, { option: true }],

  context: async ({ isolated, sharedContext }, use) => {
    if (!isolated) return use(await sharedContext());
    const context = await launch();
    await use(context);
    await context.close();
  },

  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
    await page.close();
  },

  setTheme: async ({ context }, use) => {
    await use(async (on) => {
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${extensionId}/popup.html`);
      const toggle = popup.getByRole('switch', { name: 'Dark theme' });
      // it shows "off" until storage answers; setChecked decides whether to
      // click from the state it sees first, so let it see the real one
      await expect(toggle).toBeEnabled();
      await toggle.setChecked(on);
      // the switch flips at once but the setting is saved asynchronously;
      // closing the popup first could lose it to the next test
      await expect
        .poll(() =>
          popup.evaluate(async () => {
            const { themeEnabled } =
              await chrome.storage.sync.get('themeEnabled');
            return themeEnabled === true;
          }),
        )
        .toBe(on);
      await popup.close();
    });
  },
});

export { expect };
