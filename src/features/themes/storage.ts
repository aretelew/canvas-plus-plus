import { storage } from '#imports';

const CHOICES = ['off', 'system', 'dark', 'oled', 'ember', 'nord'] as const;

// 'system' is the dark theme only while the operating system is dark.
export type ThemeChoice = (typeof CHOICES)[number];

// The theme on the page; undefined while there's none.
export type Theme = Exclude<ThemeChoice, 'off' | 'system'>;

export const themeChoice = storage.defineItem<ThemeChoice>('sync:theme', {
  fallback: 'off',
});

export function isThemeChoice(value?: string): value is ThemeChoice {
  return CHOICES.some((choice) => choice === value);
}

/** The theme `choice` puts on the page while the system is or isn't dark. */
export function resolveTheme(
  choice: ThemeChoice,
  systemDark: boolean,
): Theme | undefined {
  if (choice === 'off') return undefined;
  if (choice === 'system') return systemDark ? 'dark' : undefined;
  return choice;
}
