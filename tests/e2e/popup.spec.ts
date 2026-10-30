// Opening the popup shows each switch as it already is: one that's on shows
// up on, without sliding over from off while storage answers. Switches sit in
// sections the main page opens, with a back arrow to return, and the popup
// keeps one height across them. The gear opens the settings, and they open
// the sites; both grow on their own.

import { expect, openPopup, test } from '../extension';

// the extension's storage, read from the popup
declare const chrome: {
  storage: {
    sync: { get(keys: string[]): Promise<Record<string, unknown>> };
  };
};

test('a switch that is on opens without sliding', async ({
  context,
  setHideFooter,
}) => {
  await setHideFooter(true);
  const popup = await openPopup(context);
  await popup.getByRole('button', { name: 'Dashboard' }).click();
  const toggle = popup.getByRole('switch', { name: 'Hide footer' });
  await expect(toggle).toBeChecked();
  // the slide is a CSS transition, and running ones show up as animations
  expect(await toggle.evaluate((el) => el.getAnimations().length)).toBe(0);
  await popup.close();
  // the browser is shared with other tests
  await setHideFooter(false);
});

test('themes open on the one chosen', async ({ context, setTheme }) => {
  await setTheme('system');
  const popup = await openPopup(context);
  await popup.getByRole('button', { name: 'Appearance' }).click();
  await popup.getByRole('button', { name: 'Themes' }).click();
  await popup.getByRole('button', { name: 'Dark mode' }).click();
  await expect(popup.getByRole('switch', { name: 'System' })).toBeChecked();
  await expect(
    popup.getByRole('switch', { name: 'Dark', exact: true }),
  ).not.toBeChecked();
  await popup.close();
  await setTheme('off');
});

test('turning a theme on turns the others off, and off leaves none', async ({
  context,
  setTheme,
}) => {
  await setTheme('off');
  const popup = await openPopup(context);
  await popup.getByRole('button', { name: 'Appearance' }).click();
  await popup.getByRole('button', { name: 'Themes' }).click();
  await popup.getByRole('button', { name: 'Dark mode' }).click();
  const dark = popup.getByRole('switch', { name: 'Dark', exact: true });
  const oled = popup.getByRole('switch', { name: 'Dark (OLED)' });
  const system = popup.getByRole('switch', { name: 'System' });

  await dark.check();
  await oled.check();
  await expect(dark).not.toBeChecked();
  await expect(oled).toBeChecked();

  await system.check();
  await expect(oled).not.toBeChecked();

  await system.uncheck();
  await expect(dark).not.toBeChecked();
  await expect(oled).not.toBeChecked();
  await expect(system).not.toBeChecked();

  // across pages too
  await dark.check();
  await popup.getByRole('button', { name: 'Back' }).click();
  await popup.getByRole('switch', { name: 'Ember' }).check();
  await popup.getByRole('button', { name: 'Dark mode' }).click();
  await expect(dark).not.toBeChecked();
  await popup.close();
  await setTheme('off');
});

test('themes open from the appearance section, and back retraces them', async ({
  context,
}) => {
  const popup = await openPopup(context);
  const back = popup.getByRole('button', { name: 'Back' });
  const appearance = popup.getByRole('button', { name: 'Appearance' });
  const themes = popup.getByRole('button', { name: 'Themes' });
  const darkMode = popup.getByRole('button', { name: 'Dark mode' });
  const system = popup.getByRole('switch', { name: 'System' });
  await expect(themes).toBeHidden();
  await appearance.click();
  await themes.click();
  await expect(themes).toBeHidden();
  await expect(popup.getByRole('switch', { name: 'Ember' })).toBeVisible();
  await expect(system).toBeHidden();
  await darkMode.click();
  await expect(system).toBeVisible();

  await back.click();
  await expect(darkMode).toBeFocused();
  await expect(system).toBeHidden();
  await back.click();
  await expect(themes).toBeFocused();
  await back.click();
  await expect(appearance).toBeFocused();
  await popup.close();
});

test('the back arrow returns to the sections, focused where it left', async ({
  context,
}) => {
  const popup = await openPopup(context);
  const back = popup.getByRole('button', { name: 'Back' });
  await expect(back).toBeHidden();
  await popup.getByRole('button', { name: 'Dashboard' }).click();
  await expect(
    popup.getByRole('switch', { name: 'Grades on cards' }),
  ).toBeVisible();
  await expect(popup.getByRole('button', { name: 'Appearance' })).toBeHidden();
  await back.click();
  await expect(back).toBeHidden();
  await expect(popup.getByRole('button', { name: 'Dashboard' })).toBeFocused();
  // and again, into the same section
  await popup.getByRole('button', { name: 'Dashboard' }).click();
  await back.click();
  await expect(popup.getByRole('button', { name: 'Dashboard' })).toBeFocused();
  await popup.close();
});

test('the popup keeps its height from page to page', async ({ context }) => {
  const popup = await openPopup(context);
  const main = popup.locator('main');
  const height = await main.evaluate((el) => el.clientHeight);
  for (const title of ['Appearance', 'Dashboard', 'Sidebar', 'Courses']) {
    await popup.getByRole('button', { name: title }).click();
    expect(await main.evaluate((el) => el.clientHeight)).toBe(height);
    await popup.getByRole('button', { name: 'Back' }).click();
  }
  await popup.getByRole('button', { name: 'Appearance' }).click();
  await popup.getByRole('button', { name: 'Themes' }).click();
  expect(await main.evaluate((el) => el.clientHeight)).toBe(height);
  await popup.getByRole('button', { name: 'Dark mode' }).click();
  expect(await main.evaluate((el) => el.clientHeight)).toBe(height);
  await popup.close();
});

test('the gear opens the settings, which open the sites, and back retraces them', async ({
  context,
}) => {
  const popup = await openPopup(context);
  const gear = popup.getByRole('button', { name: 'Settings', exact: true });
  const back = popup.getByRole('button', { name: 'Back' });
  const sites = popup.getByRole('button', { name: 'Sites' });
  await gear.click();
  await expect(gear).toBeHidden();
  await expect(popup.getByRole('button', { name: 'Appearance' })).toBeHidden();

  await sites.click();
  await expect(popup.getByText('*.instructure.com')).toBeVisible();
  await expect(popup.getByText('Always on')).toBeVisible();
  await expect(gear).toBeHidden();

  await back.click();
  await expect(sites).toBeFocused();
  await back.click();
  await expect(gear).toBeFocused();
  await popup.close();
});

test('reset asks once more, then turns every feature back', async ({
  context,
  setHideFooter,
  setTheme,
}) => {
  await setHideFooter(true);
  await setTheme('dark');
  const popup = await openPopup(context);
  const stored = () =>
    popup.evaluate(() => chrome.storage.sync.get(['hideFooter', 'theme']));
  await popup.getByRole('button', { name: 'Settings', exact: true }).click();

  await popup.getByRole('button', { name: 'Reset', exact: true }).click();
  const confirm = popup.getByRole('button', { name: 'Confirm' });
  await expect(confirm).toBeVisible();
  expect(await stored()).toEqual({ hideFooter: true, theme: 'dark' });

  await confirm.click();
  await expect(popup.getByRole('button', { name: 'Done' })).toBeVisible();
  expect(await stored()).toEqual({});
  await popup.close();
});

test('the settings name the version', async ({ context }) => {
  const popup = await openPopup(context);
  await popup.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(popup.getByText(/^Version \d+\.\d+\.\d+$/)).toBeVisible();
  await popup.close();
});
