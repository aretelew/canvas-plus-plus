// Opening the popup shows each switch as it already is: one that's on shows
// up on, without sliding over from off while storage answers.

import { expect, openPopup, test } from '../extension';

test('a switch that is on opens without sliding', async ({
  context,
  setTheme,
}) => {
  await setTheme(true);
  const popup = await openPopup(context);
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
  const oled = popup.getByRole('switch', { name: 'True black (OLED)' });
  await expect(oled).toBeDisabled();
  await popup.getByRole('switch', { name: 'Dark theme' }).check();
  await expect(oled).toBeEnabled();
  await popup.close();
  // the browser is shared with other tests
  await setTheme(false);
});
