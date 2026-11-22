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
  type Request,
} from '@playwright/test';
import { resolve } from 'node:path';
import { extensionId, launchWithExtension } from './chrome';

// built by `npm run test:browser`, apart from the store build (see wxt.config.ts)
const EXTENSION = resolve('.output/chrome-mv3-test');

// The extension APIs called inside the popup (extension types aren't loaded
// for tests).
interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  clear(): Promise<void>;
}
declare const chrome: { storage: { sync: StorageArea; local: StorageArea } };

const launch = () => launchWithExtension(EXTENSION);

export const THEMES = [
  'dark',
  'oled',
  'ember',
  'nord',
  'rose',
  'dracula',
  'everforest',
  'sea',
  'tokyo',
  'oxocarbon',
  'poimandres',
] as const;

// each theme's value in storage, and its switch in the popup: on the Themes
// page, or on the Dark mode page that opens from it
const THEME_PAGE = {
  ember: 'Ember',
  nord: 'Nord',
  rose: 'Rosé Pine',
  dracula: 'Dracula',
  everforest: 'Everforest',
  sea: 'Deep Sea',
  tokyo: 'Tokyo Night',
  oxocarbon: 'Oxocarbon',
  poimandres: 'Poimandres',
};
const DARK_MODE_PAGE = {
  dark: 'Dark',
  oled: 'Dark (OLED)',
  system: 'System',
};
const THEME_SWITCHES = { ...THEME_PAGE, ...DARK_MODE_PAGE };
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
    setHideSensus: (on: boolean) => Promise<void>;
    setTimeUntilDue: (on: boolean) => Promise<void>;
    setGradeBreakdown: (on: boolean) => Promise<void>;
    setTidyGradesTable: (on: boolean) => Promise<void>;
    setQuizAnswers: (on: boolean) => Promise<void>;
    setTidySidebar: (on: boolean) => Promise<void>;
    setCourseNav: (on: boolean) => Promise<void>;
    setQuickSearch: (on: boolean) => Promise<void>;
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
    if (!isolated) {
      const context = await sharedContext();
      const origins = new Set<string>();
      const note = (request: Request) => {
        const { origin, protocol } = new URL(request.url());
        if (protocol.startsWith('http')) origins.add(origin);
      };
      context.on('request', note);
      await use(context);
      context.off('request', note);
      // the next test in this worker starts as if in a new browser
      await forget(context, origins);
      return;
    }
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

  setHideSensus: async ({ context }, use) => {
    await use((on) =>
      setSwitch(context, 'Courses', 'Hide SensusAccess', 'hideSensus', on),
    );
  },

  setTimeUntilDue: async ({ context }, use) => {
    await use((on) =>
      setSwitch(context, 'Courses', 'Time until due', 'timeUntilDue', on),
    );
  },

  setGradeBreakdown: async ({ context }, use) => {
    await use((on) =>
      setSwitch(context, 'Courses', 'Grade breakdown', 'gradeBreakdown', on),
    );
  },

  setTidyGradesTable: async ({ context }, use) => {
    await use((on) =>
      setSwitch(context, 'Courses', 'Tidy grades table', 'tidyGradesTable', on),
    );
  },

  setQuizAnswers: async ({ context }, use) => {
    await use((on) =>
      setSwitch(
        context,
        'Courses',
        'Mark correct quiz answers',
        'quizAnswers',
        on,
      ),
    );
  },

  setTidySidebar: async ({ context }, use) => {
    await use((on) =>
      setSwitch(
        context,
        'Sidebars & search',
        'Tidy To Do list',
        'tidySidebar',
        on,
      ),
    );
  },
  setCourseNav: async ({ context }, use) => {
    await use((on) =>
      setSwitch(
        context,
        'Sidebars & search',
        'Courses in left sidebar',
        'courseNav',
        on,
      ),
    );
  },

  setQuickSearch: async ({ context }, use) => {
    // its label names the platform's shortcut
    await use((on) =>
      setSwitch(
        context,
        'Sidebars & search',
        /^Search with/,
        'quickSearch',
        on,
      ),
    );
  },
});

// The popup, opened in a tab of its own.
export async function openPopup(context: BrowserContext): Promise<Page> {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId(EXTENSION)}/popup.html`);
  return popup;
}

// Puts every setting back to its default and clears what the sites at
// `origins` stored (features keep data in the page's own localStorage).
async function forget(
  context: BrowserContext,
  origins: Set<string>,
): Promise<void> {
  const popup = await openPopup(context);
  await popup.evaluate(() =>
    Promise.all([chrome.storage.sync.clear(), chrome.storage.local.clear()]),
  );
  const cdp = await context.newCDPSession(popup);
  for (const origin of origins) {
    await cdp.send('Storage.clearDataForOrigin', {
      origin,
      storageTypes: 'all',
    });
  }
  await cdp.detach();
  await popup.close();
}

// Flips one of the popup's switches, in its section, and waits until the
// setting is saved.
function setSwitch(
  context: BrowserContext,
  section: string,
  name: string | RegExp,
  key: string,
  on: boolean,
): Promise<void> {
  const toggle = (popup: Page) => popup.getByRole('switch', { name });
  return setInPopup(
    context,
    [section],
    key,
    on,
    // disabled until the setting has loaded
    async (popup) => {
      await expect(toggle(popup)).toBeEnabled();
      return toggle(popup).isChecked();
    },
    (popup) => toggle(popup).setChecked(on),
  );
}

// Turns on one theme's switch, or all of them off, and waits until it's saved.
function setTheme(context: BrowserContext, theme: ThemeValue): Promise<void> {
  const themeSwitch = (popup: Page, name: string) =>
    popup.getByRole('switch', { name, exact: true });
  const openDarkMode = (popup: Page) =>
    popup.getByRole('button', { name: 'Dark mode' }).click();
  return setInPopup(
    context,
    ['Appearance', 'Themes'],
    'theme',
    theme,
    () => Promise.resolve('off'),
    async (popup) => {
      if (theme !== 'off') {
        if (!(theme in THEME_PAGE)) await openDarkMode(popup);
        await themeSwitch(popup, THEME_SWITCHES[theme]).check();
        return;
      }
      for (const name of Object.values(THEME_PAGE)) {
        await themeSwitch(popup, name).uncheck();
      }
      await openDarkMode(popup);
      for (const name of Object.values(DARK_MODE_PAGE)) {
        await themeSwitch(popup, name).uncheck();
      }
    },
  );
}

// Opens the popup through `path`'s sections, changes a setting on the last, and
// waits until it reads as `value`. `shown` is what the popup shows for it
// before the change, which is what it reads as while nothing is stored: its
// default, without the test repeating it.
async function setInPopup<T extends string | boolean>(
  context: BrowserContext,
  path: string[],
  key: string,
  value: T,
  shown: (popup: Page) => Promise<T>,
  change: (popup: Page) => Promise<void>,
): Promise<void> {
  const popup = await openPopup(context);
  for (const section of path) {
    await popup.getByRole('button', { name: section }).click();
  }
  const unset = await shown(popup);
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
