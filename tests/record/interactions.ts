// Some fixtures are a page after a click: a nav tray, the reply editor. The
// recorder makes the click while recording, so the requests it causes are
// saved, and the visual tests make it again on the replay.

import type { Page } from '@playwright/test';

export const interactions: Partial<
  Record<string, (page: Page) => Promise<void>>
> = {
  'courses-tray': async (page) => {
    await page.locator('#global_nav_courses_link').click();
    await page.getByRole('link', { name: 'All Courses' }).waitFor();
  },
  // the Rich Content Editor: TinyMCE, in an iframe of its own
  'discussion-reply': async (page) => {
    await page
      .getByTestId('discussion-topic-reply')
      .or(page.getByRole('button', { name: /^reply$/i }))
      .first()
      .click();
    await page.frameLocator('iframe[id$="_ifr"]').locator('body').waitFor();
  },
};
