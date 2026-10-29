import type { WxtStorageItem } from '#imports';
import { cardAssignments } from '@/features/assignments/storage';
import { hideFooter } from '@/features/footer/storage';
import { cardGrades } from '@/features/grades/storage';
import { hideLogo } from '@/features/logo/storage';
import { tidySidebar } from '@/features/sidebar/storage';
import {
  type ThemeMode,
  themeMode,
  themeOled,
} from '@/features/themes/storage';

export type Item<T> = WxtStorageItem<T, Record<string, unknown>>;

// A choice of a few values, shown as a row of buttons. `off` is the one that
// turns the feature off.
export type ChoiceRow<T extends string> = {
  label: string;
  setting: Item<T>;
  options: { value: T; label: string }[];
  off: T;
};

// `under` is the choice a switch depends on: it's indented under it, and can
// only be switched while that isn't off.
export type SwitchRow = {
  label: string;
  setting: Item<boolean>;
  under?: ChoiceRow<string>;
};

export type Row = SwitchRow | ChoiceRow<string>;
export type Section = { title: string; rows: Row[] };

const darkTheme: ChoiceRow<ThemeMode> = {
  label: 'Dark theme',
  setting: themeMode,
  options: [
    { value: 'off', label: 'Off' },
    { value: 'on', label: 'On' },
    { value: 'system', label: 'System' },
  ],
  off: 'off',
};

// The popup's main page lists these, grouped by the part of Canvas they change;
// each opens to its switches.
export const sections: Section[] = [
  {
    title: 'Appearance',
    rows: [
      darkTheme,
      { label: 'True black (OLED)', setting: themeOled, under: darkTheme },
      { label: 'Hide school logo', setting: hideLogo },
    ],
  },
  {
    title: 'Dashboard',
    rows: [
      { label: 'Grades on cards', setting: cardGrades },
      { label: 'Assignments on cards', setting: cardAssignments },
      { label: 'Hide footer', setting: hideFooter },
    ],
  },
  {
    title: 'Sidebar',
    rows: [{ label: 'Tidy To Do list', setting: tidySidebar }],
  },
];

// Every setting there is: a feature with no row here has nothing to set.
export const settings = sections.flatMap((section) =>
  section.rows.map((row) => row.setting),
);
