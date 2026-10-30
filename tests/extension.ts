// Playwright fixtures: a Chromium with the built extension loaded, and a way to
// flip settings through the real popup.
//
// Launching Chrome takes about a second, so each worker shares one browser
// across its tests (every test still gets its own tab). Tests that need a
// browser nothing has run in yet, like first-paint checks, opt out with
// `test.use({ isolated: true })`.

import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { resolve } from 'node:path';
import { extensionId, launchWithExtension } from './chrome';

// built by `npm run test:browser`, apart from the store build (see wxt.config.ts)
const EXTENSION = resolve('.output/chrome-mv3-test');

// The one extension API setInPopup calls inside the popup (extension types
// aren't loaded for tests).
declare const chrome: {
  storage: { sync: { get(key: string): Promise<Record<string, unknown>> } };
};

const launch = () => launchWithExtension(EXTENSION);

// each theme's value in storage, and its switch in the popup
const THEME_SWITCHES = {
  dark: 'Dark',
  oled: 'Dark (OLED)',
  system: 'System',
};
type ThemeValue = 'off' | keyof typeof THEME_SWITCHES;

export const test = base.extend<
  {
    isolated: boolean;
    context: BrowserContext;
    page: Page;
    setTheme: (theme: ThemeValue) => Promise<void>;
    setCardGrades: (on: boolean) => Promise<void>;
    setCardAssignments: (on: boolean) => Promise<void>;
    setHideLogo: (on: boolean) => Promise<void>;
    setHideFooter: (on: boolean) => Promise<void>;
    setTidySidebar: (on: boolean) => Promise<void>;
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
    await use((theme) => setTheme(context, theme));
  },

  setCardGrades: async ({ context }, use) => {
    await use((on) =>
      setSwitch(context, 'Dashboard', 'Grades on cards', 'cardGrades', on),
    );
  },

  setCardAssignments: async ({ context }, use) => {
    await use((on) =>
      setSwitch(
        context,
        'Dashboard',
        'Assignments on cards',
        'cardAssignments',
        on,
      ),
    );
  },

  setHideLogo: async ({ context }, use) => {
    await use((on) =>
      setSwitch(context, 'Dashboard', 'Hide school logo', 'hideLogo', on),
    );
  },

  setHideFooter: async ({ context }, use) => {
    await use((on) =>
      setSwitch(context, 'Dashboard', 'Hide footer', 'hideFooter', on),
    );
  },

  setTidySidebar: async ({ context }, use) => {
    await use((on) =>
      setSwitch(context, 'Sidebar', 'Tidy To Do list', 'tidySidebar', on),
    );
  },
});

// The popup, opened in a tab of its own.
export async function openPopup(context: BrowserContext): Promise<Page> {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId(EXTENSION)}/popup.html`);
  return popup;
}

// Flips one of the popup's switches, in its section, and waits until the
// setting is saved.
function setSwitch(
  context: BrowserContext,
  section: string,
  name: string,
  key: string,
  on: boolean,
): Promise<void> {
  return setInPopup(context, [section], key, on, false, (popup) =>
    popup.getByRole('switch', { name }).setChecked(on),
  );
}

// Turns on one theme's switch, or all of them off, and waits until it's saved.
function setTheme(context: BrowserContext, theme: ThemeValue): Promise<void> {
  const themeSwitch = (popup: Page, name: string) =>
    popup.getByRole('switch', { name, exact: true });
  return setInPopup(
    context,
    ['Appearance', 'Themes'],
    'theme',
    theme,
    'off',
    async (popup) => {
      if (theme !== 'off') {
        await themeSwitch(popup, THEME_SWITCHES[theme]).check();
        return;
      }
      for (const name of Object.values(THEME_SWITCHES)) {
        await themeSwitch(popup, name).uncheck();
      }
    },
  );
}

// Opens the popup through `path`'s sections, changes a setting on the last, and
// waits until it's stored as `value`; `unset` is what it reads as while nothing
// is stored, as before it's first changed.
async function setInPopup<T extends string | boolean>(
  context: BrowserContext,
  path: string[],
  key: string,
  value: T,
  unset: T,
  change: (popup: Page) => Promise<void>,
): Promise<void> {
  const popup = await openPopup(context);
  for (const section of path) {
    await popup.getByRole('button', { name: section }).click();
  }
  await change(popup);
  // the control changes at once but the setting is saved asynchronously;
  // closing the popup first could lose it to the next test
  await expect
    .poll(() =>
      popup.evaluate(
        async ([key, unset]) =>
          (await chrome.storage.sync.get(key))[key] ?? unset,
        [key, unset] as const,
      ),
    )
    .toBe(value);
  await popup.close();
}

export { expect };
