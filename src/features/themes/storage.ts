import { storage } from '#imports';

// 'system' is dark only while the operating system is.
export type ThemeMode = 'off' | 'on' | 'system';

export const themeMode = storage.defineItem<ThemeMode>('sync:themeMode', {
  fallback: 'off',
});

// A variant of the dark theme: it only applies while that does, and is kept
// while it doesn't.
export const themeOled = storage.defineItem<boolean>('sync:themeOled', {
  fallback: false,
});

// The theme on the page; undefined while there's none.
export type Theme = 'dark' | 'oled';

export type ThemeSettings = { mode: ThemeMode; oled: boolean };

/** The theme `settings` put on the page while the system is or isn't dark. */
export function resolveTheme(
  { mode, oled }: ThemeSettings,
  systemDark: boolean,
): Theme | undefined {
  if (mode === 'off' || (mode === 'system' && !systemDark)) return undefined;
  return oled ? 'oled' : 'dark';
}

/** Calls `onChange` with the current settings, then again whenever they change. */
export async function watchThemeSettings(
  onChange: (settings: ThemeSettings) => void,
): Promise<void> {
  let [mode, oled] = await Promise.all([
    themeMode.getValue(),
    themeOled.getValue(),
  ]);
  const report = () => {
    onChange({ mode, oled });
  };
  report();
  themeMode.watch((next) => {
    mode = next;
    report();
  });
  themeOled.watch((next) => {
    oled = next;
    report();
  });
}
