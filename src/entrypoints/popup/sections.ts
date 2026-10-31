import type { WxtStorageItem } from '#imports';
import { cardAssignments } from '@/features/assignments/storage';
import { hideFooter } from '@/features/footer/storage';
import { cardGrades } from '@/features/grades/storage';
import { hideLogo } from '@/features/logo/storage';
import { hideSensus } from '@/features/sensus/storage';
import { tidySidebar } from '@/features/sidebar/storage';
import { type ThemeChoice, themeChoice } from '@/features/themes/storage';

export type Item<T> = WxtStorageItem<T, Record<string, unknown>>;

// A switch: on while the setting is `on`, and switching it off sets `off`. A
// setting with more values has a switch for each, so one turning on turns the
// others off.
export type SwitchRow<T> = {
  label: string;
  setting: Item<T>;
  on: T;
  off: T;
};

// A section in a row opens from there, as a page of its own.
export type Row = SwitchRow<boolean | string> | Section;
export type Section = { title: string; rows: Row[] };

const switchRow = (
  label: string,
  setting: Item<boolean>,
): SwitchRow<boolean> => ({ label, setting, on: true, off: false });

const themeRow = (label: string, on: ThemeChoice): SwitchRow<ThemeChoice> => ({
  label,
  setting: themeChoice,
  on,
  off: 'off',
});

// The popup's main page lists these, grouped by the part of Canvas they change;
// each opens to its switches.
export const sections: Section[] = [
  {
    title: 'Appearance',
    rows: [
      {
        title: 'Themes',
        rows: [
          {
            title: 'Dark mode',
            rows: [
              themeRow('Dark', 'dark'),
              themeRow('Dark (OLED)', 'oled'),
              themeRow('System', 'system'),
            ],
          },
          themeRow('Ember', 'ember'),
          themeRow('Nord', 'nord'),
          themeRow('Rosé Pine', 'rose'),
          themeRow('Dracula', 'dracula'),
          themeRow('Everforest', 'everforest'),
          themeRow('Deep Sea', 'sea'),
        ],
      },
    ],
  },
  {
    title: 'Dashboard',
    rows: [
      switchRow('Grades on cards', cardGrades),
      switchRow('Assignments on cards', cardAssignments),
      switchRow('Hide school logo', hideLogo),
      switchRow('Hide footer', hideFooter),
    ],
  },
  {
    title: 'Sidebar',
    rows: [switchRow('Tidy To Do list', tidySidebar)],
  },
  {
    title: 'Courses',
    rows: [switchRow('Hide SensusAccess', hideSensus)],
  },
];

const withOpened = (section: Section): Section[] => [
  section,
  ...section.rows.flatMap((row) => ('rows' in row ? withOpened(row) : [])),
];

// Every section, the ones that open from another section included.
export const pages = sections.flatMap(withOpened);

// Every setting there is: a feature with no row here has nothing to set.
export const settings = [
  ...new Set(
    pages.flatMap((page) =>
      page.rows.flatMap((row) => ('rows' in row ? [] : [row.setting])),
    ),
  ),
];
