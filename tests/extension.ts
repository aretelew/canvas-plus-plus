// Playwright fixtures: a Chromium with the built extension loaded, and a way to
// flip the theme through the real popup.

import { test as base, chromium, type BrowserContext } from '@playwright/test';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { chromePath } from './chrome';

const EXTENSION = resolve('.output/chrome-mv3');

// Chromium derives an unpacked extension's id from its absolute path.
const extensionId = createHash('sha256')
  .update(EXTENSION)
  .digest('hex')
  .slice(0, 32)
  .replace(/[0-9a-f]/g, (c) => String.fromCharCode(97 + parseInt(c, 16)));

export const test = base.extend<{
  context: BrowserContext;
  setTheme: (on: boolean) => Promise<void>;
}>({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires destructuring here
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      executablePath: chromePath(),
      headless: true,
      viewport: { width: 1280, height: 800 },
      args: [
        `--disable-extensions-except=${EXTENSION}`,
        `--load-extension=${EXTENSION}`,
      ],
    });
    await use(context);
    await context.close();
  },

  setTheme: async ({ context }, use) => {
    await use(async (on) => {
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${extensionId}/popup.html`);
      await popup.getByRole('switch', { name: 'Dark theme' }).setChecked(on);
      await popup.close();
    });
  },
});

export { expect } from '@playwright/test';
