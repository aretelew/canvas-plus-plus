import { storage } from '#imports';

// 'system' is the dark theme only while the operating system is dark.
export type ThemeChoice = 'off' | 'dark' | 'oled' | 'system';

export const themeChoice = storage.defineItem<ThemeChoice>('sync:theme', {
  fallback: 'off',
});

// The theme on the page; undefined while there's none.
export type Theme = 'dark' | 'oled';

/** The theme `choice` puts on the page while the system is or isn't dark. */
export function resolveTheme(
  choice: ThemeChoice,
  systemDark: boolean,
): Theme | undefined {
  if (choice === 'off') return undefined;
  if (choice === 'system') return systemDark ? 'dark' : undefined;
  return choice;
}
