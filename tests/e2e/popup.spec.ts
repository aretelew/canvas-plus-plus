// Opening the popup shows each switch as it already is: one that's on shows
// up on, without sliding over from off while storage answers. Switches sit in
// sections the main page opens, with a back arrow to return, and the popup
// keeps one height across them.

import { expect, openPopup, test } from '../extension';

test('a switch that is on opens without sliding', async ({
  context,
  setTheme,
}) => {
  await setTheme(true);
  const popup = await openPopup(context);
  await popup.getByRole('button', { name: 'Appearance' }).click();
  const toggle = popup.getByRole('switch', { name: 'Dark theme' });
  await expect(toggle).toBeChecked();
  // the slide is a CSS transition, and running ones show up as animations
  expect(await toggle.evaluate((el) => el.getAnimations().length)).toBe(0);
  await popup.close();
});

test('true black can only be switched while the dark theme is on', async ({
  context,
  setTheme,
}) => {
  await setTheme(false);
  const popup = await openPopup(context);
  await popup.getByRole('button', { name: 'Appearance' }).click();
  const oled = popup.getByRole('switch', { name: 'True black (OLED)' });
  await expect(oled).toBeDisabled();
  await popup.getByRole('switch', { name: 'Dark theme' }).check();
  await expect(oled).toBeEnabled();
  await popup.close();
  // the browser is shared with other tests
  await setTheme(false);
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
  for (const title of ['Appearance', 'Dashboard', 'Sidebar']) {
    await popup.getByRole('button', { name: title }).click();
    expect(await main.evaluate((el) => el.clientHeight)).toBe(height);
    await popup.getByRole('button', { name: 'Back' }).click();
  }
  await popup.close();
});
