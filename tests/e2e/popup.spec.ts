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
