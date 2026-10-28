// Playwright fixtures: a Chromium with the built extension loaded, and a way to
// flip settings through the real popup.
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

// built by `npm run test:browser`, apart from the store build (see wxt.config.ts)
const EXTENSION = resolve('.output/chrome-mv3-test');

// The one extension API setSwitch calls inside the popup (extension types
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
    setOled: (on: boolean) => Promise<void>;
    setCardGrades: (on: boolean) => Promise<void>;
    setCardAssignments: (on: boolean) => Promise<void>;
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
    await use((on) => setSwitch(context, 'Dark theme', 'themeEnabled', on));
  },

  setOled: async ({ context }, use) => {
    await use((on) => setSwitch(context, 'True black (OLED)', 'themeOled', on));
  },

  setCardGrades: async ({ context }, use) => {
    await use((on) => setSwitch(context, 'Grades on cards', 'cardGrades', on));
  },

  setCardAssignments: async ({ context }, use) => {
    await use((on) =>
      setSwitch(context, 'Assignments on cards', 'cardAssignments', on),
    );
  },
});

// The popup, opened in a tab of its own.
export async function openPopup(context: BrowserContext): Promise<Page> {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  return popup;
}

// Flips one of the popup's switches and waits until the setting is saved.
async function setSwitch(
  context: BrowserContext,
  name: string,
  key: string,
  on: boolean,
): Promise<void> {
  const popup = await openPopup(context);
  const toggle = popup.getByRole('switch', { name });
  await toggle.setChecked(on);
  // the switch flips at once but the setting is saved asynchronously;
  // closing the popup first could lose it to the next test
  await expect
    .poll(() =>
      popup.evaluate(
        async (key) => (await chrome.storage.sync.get(key))[key] === true,
        key,
      ),
    )
    .toBe(on);
  await popup.close();
}

export { expect };
