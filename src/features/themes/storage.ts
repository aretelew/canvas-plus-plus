import { storage } from '#imports';

export const themeEnabled = storage.defineItem<boolean>('sync:themeEnabled', {
  fallback: false,
});

// A variant of the dark theme: it only applies while that's on, and is kept
// while it's off.
export const themeOled = storage.defineItem<boolean>('sync:themeOled', {
  fallback: false,
});

// The theme the settings pick; undefined while the theme is off.
export type Theme = 'dark' | 'oled';

/** Calls `onChange` with the current theme, then again whenever it changes. */
export async function watchTheme(
  onChange: (theme: Theme | undefined) => void,
): Promise<void> {
  let [enabled, oled] = await Promise.all([
    themeEnabled.getValue(),
    themeOled.getValue(),
  ]);
  const report = () => {
    onChange(enabled ? (oled ? 'oled' : 'dark') : undefined);
  };
  report();
  themeEnabled.watch((on) => {
    enabled = on;
    report();
  });
  themeOled.watch((on) => {
    oled = on;
    report();
  });
}
