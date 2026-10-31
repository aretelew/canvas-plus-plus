// The global nav takes each theme's colors, whatever colors the school chose,
// and stands apart from the page and cards. Canvas paints it from these
// variables; the stylesheet here copies the rules that use them.

import type { Page } from '@playwright/test';
import { expect, test, THEMES } from '../extension';
import { contrast, srgb, tokenColor } from '../tokens';

const URL = 'https://fixture.instructure.com/global-nav';

const SCHOOLS = {
  'a dark nav': { nav: '#003071', text: '#ffffff' },
  'a white nav': { nav: '#ffffff', text: '#2d3b45' },
};

const navPage = (
  { nav, text }: { nav: string; text: string },
  activeLink = '',
) =>
  `<!doctype html><title>t</title>
<style>
  :root {
    --ic-link-color: #0374b5;
    --ic-brand-global-nav-bgd: ${nav};
    --ic-brand-global-nav-logo-bgd: ${nav};
    --ic-brand-global-nav-ic-icon-svg-fill: ${text};
    --ic-brand-global-nav-ic-icon-svg-fill--active: #09143a;
    --ic-brand-global-nav-menu-item__text-color: ${text};
    --ic-brand-global-nav-menu-item__text-color--active: var(--ic-link-color);
    --ic-brand-global-nav-menu-item__badge-bgd: #ffffff;
    --ic-brand-global-nav-menu-item__badge-bgd--active: #09143a;
  }
  .ic-app-header { background-color: var(--ic-brand-global-nav-bgd); }
  .ic-app-header__logomark-container {
    background-color: var(--ic-brand-global-nav-logo-bgd);
  }
  .ic-app-header__menu-list-link {
    color: var(--ic-brand-global-nav-menu-item__text-color);
  }
  .ic-app-header__menu-list-link:hover { background-color: rgba(0, 0, 0, 0.2); }
  .ic-app-header__menu-list-link .ic-icon-svg {
    fill: var(--ic-brand-global-nav-ic-icon-svg-fill);
  }
  .ic-app-header__menu-list-item--active .ic-app-header__menu-list-link {
    background: #fff;
    color: var(--ic-brand-global-nav-menu-item__text-color--active);
  }
  .ic-app-header__menu-list-item--active .ic-icon-svg {
    fill: var(--ic-brand-global-nav-ic-icon-svg-fill--active);
  }
  .menu-item__badge {
    background: var(--ic-brand-global-nav-menu-item__badge-bgd);
    color: #000;
  }
</style>
<body>
  <header class="ic-app-header">
    <div class="ic-app-header__logomark-container" style="height: 85px"></div>
    <ul>
      <li class="ic-app-header__menu-list-item">
        <a id="inbox" class="ic-app-header__menu-list-link" href="#">
          <svg class="ic-icon-svg" width="26" height="26"></svg>
          <span class="menu-item__badge"><span id="count">3</span></span>
          <div class="menu-item__text">Inbox</div>
        </a>
      </li>
      <li class="ic-app-header__menu-list-item ic-app-header__menu-list-item--active">
        <a id="active" class="ic-app-header__menu-list-link" href="#" ${activeLink}>
          <svg class="ic-icon-svg" width="26" height="26"></svg>
          <div class="menu-item__text">Courses</div>
        </a>
      </li>
    </ul>
  </header>
</body>`;

const computed = (page: Page, selector: string, property: string) =>
  page
    .locator(selector)
    .evaluate(
      (el, name) => getComputedStyle(el).getPropertyValue(name),
      property,
    );

for (const [school, colors] of Object.entries(SCHOOLS)) {
  for (const theme of THEMES) {
    test(`${theme} themes ${school}`, async ({ page, setTheme }) => {
      await page.route(URL, (route) =>
        route.fulfill({ contentType: 'text/html', body: navPage(colors) }),
      );
      await setTheme(theme);
      await page.goto(URL);
      await expect(page.locator('html')).toHaveAttribute(
        'data-cpp-theme',
        theme,
      );
      await expect(page.locator('#count')).toHaveAttribute('data-cpp-fg');

      const nav = await tokenColor(page, '--cpp-nav');
      const text = await tokenColor(page, '--cpp-text');
      const pageColor = await tokenColor(page, '--cpp-bg');
      const link = await tokenColor(page, '--cpp-link');

      expect(await computed(page, '.ic-app-header', 'background-color')).toBe(
        nav,
      );
      expect(nav).not.toBe(pageColor);
      expect(nav).not.toBe(await tokenColor(page, '--cpp-elevated'));
      expect(await computed(page, '#inbox', 'color')).toBe(text);
      expect(await computed(page, '#inbox .ic-icon-svg', 'fill')).toBe(text);

      expect(await computed(page, '#active .ic-icon-svg', 'fill')).toBe(link);

      expect(
        await computed(page, '.menu-item__badge', 'background-color'),
      ).toBe(link);
      expect(await computed(page, '#count', 'color')).toBe(pageColor);

      await page.locator('#inbox').hover();
      await expect
        .poll(() => computed(page, '#inbox', 'background-color'))
        .not.toBe('rgba(0, 0, 0, 0.2)');
    });
  }
}

// Canvas draws Dashboard as a plain link and Courses, which opens a tray, as a
// button; the highlight must not depend on which.
for (const theme of THEMES) {
  for (const [kind, attribute] of [
    ['a link', ''],
    ['a tray button', 'role="button"'],
  ] as const) {
    test(`${theme} highlights the active item when it's ${kind}`, async ({
      page,
      setTheme,
    }) => {
      await page.route(URL, (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: navPage(SCHOOLS['a dark nav'], attribute),
        }),
      );
      await setTheme(theme);
      await page.goto(URL);
      await expect(page.locator('html')).toHaveAttribute(
        'data-cpp-theme',
        theme,
      );

      const tile = await computed(page, '#active', 'background-color');
      const [tileRgb, navRgb, linkRgb] = [
        await srgb(page, tile),
        await srgb(page, await tokenColor(page, '--cpp-nav')),
        await srgb(page, await tokenColor(page, '--cpp-link')),
      ];
      expect(tile).toBe(await tokenColor(page, '--cpp-nav-active'));
      expect(contrast(tileRgb, navRgb), 'tile on nav').toBeGreaterThan(1.3);
      expect(contrast(linkRgb, tileRgb), 'link on tile').toBeGreaterThan(4.5);
    });
  }
}

for (const [school, tile] of [
  ['a dark nav', 'goes'],
  ['a white nav', 'stays'],
] as const) {
  test(`the logo's tile ${tile} on ${school}`, async ({ page, setTheme }) => {
    await page.route(URL, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: navPage(SCHOOLS[school]),
      }),
    );
    await setTheme('dark');
    await page.goto(URL);
    await expect(page.locator('html')).toHaveAttribute(
      'data-cpp-theme',
      'dark',
    );
    const color = await computed(
      page,
      '.ic-app-header__logomark-container',
      'background-color',
    );
    // computed colors only name their alpha below 1
    expect(color.endsWith(' / 0)')).toBe(tile === 'goes');
    expect(color.includes(' / ')).toBe(tile === 'goes');
  });
}

test('turning the theme off gives the school its nav back', async ({
  page,
  setTheme,
}) => {
  await page.route(URL, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: navPage(SCHOOLS['a dark nav']),
    }),
  );
  await setTheme('off');
  await page.goto(URL);
  expect(await computed(page, '.ic-app-header', 'background-color')).toBe(
    'rgb(0, 48, 113)',
  );
  expect(
    await computed(
      page,
      '.ic-app-header__logomark-container',
      'background-color',
    ),
  ).toBe('rgb(0, 48, 113)');
});
