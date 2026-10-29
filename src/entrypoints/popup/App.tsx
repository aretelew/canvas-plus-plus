import { type ReactNode, useEffect, useState } from 'react';
import type { WxtStorageItem } from '#imports';
import { cardAssignments } from '@/features/assignments/storage';
import { hideFooter } from '@/features/footer/storage';
import { cardGrades } from '@/features/grades/storage';
import { hideLogo } from '@/features/logo/storage';
import { tidySidebar } from '@/features/sidebar/storage';
import { themeEnabled, themeOled } from '@/features/themes/storage';
import { SiteAccess } from './SiteAccess';

type Setting = WxtStorageItem<boolean, Record<string, unknown>>;

// `under` is the switch a setting depends on: it's indented under it, and can
// only be switched while that's on.
type Row = { label: string; setting: Setting; under?: Setting };
type Section = { title: string; rows: Row[] };

// The popup's main page lists these, grouped by the part of Canvas they change;
// each opens to its switches.
const sections: Section[] = [
  {
    title: 'Appearance',
    rows: [
      { label: 'Dark theme', setting: themeEnabled },
      { label: 'True black (OLED)', setting: themeOled, under: themeEnabled },
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

function App() {
  const [open, setOpen] = useState<Section>();
  // the section opened last, so closing it focuses its row
  const [last, setLast] = useState<Section>();

  return (
    <main className="w-72">
      {/* three columns keep the name centered beside the back arrow, which
          fills the header's corner like the rows fill theirs */}
      <header className="grid h-10 grid-cols-[1fr_auto_1fr] items-center border-b border-base-300">
        {open && (
          <button
            ref={focus}
            type="button"
            className="flex h-full w-10 cursor-pointer items-center justify-center hover:bg-base-200"
            aria-label="Back"
            onClick={() => {
              setOpen(undefined);
            }}
          >
            <Chevron direction="left" />
          </button>
        )}
        <h1 className="col-start-2 text-sm font-semibold">canvas++</h1>
      </header>
      {/* every page sits in the same cell, the ones not showing hidden, so
          the popup keeps one height (the tallest page's) as it moves between
          them */}
      <div className="grid">
        <Page shown={!open}>
          {sections.map((section) => (
            <button
              key={section.title}
              ref={!open && section === last ? focus : undefined}
              type="button"
              className="group flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-sm hover:bg-base-200"
              onClick={() => {
                setLast(section);
                setOpen(section);
              }}
            >
              {section.title}
              <Chevron
                direction="right"
                className="text-base-content/50 group-hover:text-base-content"
              />
            </button>
          ))}
          <SiteAccess />
        </Page>
        {sections.map((section) => (
          <Page key={section.title} shown={section === open}>
            {section.rows.map((row) =>
              row.under ? (
                <DependentSwitch
                  key={row.label}
                  label={row.label}
                  setting={row.setting}
                  under={row.under}
                />
              ) : (
                <Switch
                  key={row.label}
                  label={row.label}
                  setting={row.setting}
                />
              ),
            )}
          </Page>
        ))}
      </div>
    </main>
  );
}

// One page of the popup, in the cell all of them share. Rows are separated by
// lines rather than boxed, and padded per row, not here, so the lines and the
// hover tint run edge to edge.
function Page({ shown, children }: { shown: boolean; children: ReactNode }) {
  return (
    <div
      className={`col-start-1 row-start-1 divide-y divide-base-300 ${shown ? '' : 'invisible'}`}
    >
      {children}
    </div>
  );
}

// Focuses an element as it appears, or as a ref is pointed at it. Module-level,
// so re-renders don't call it again.
function focus(el: HTMLElement | null) {
  el?.focus();
}

// The back arrow, or the arrow into a section.
function Chevron({
  direction,
  className = '',
}: {
  direction: 'left' | 'right';
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-4 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  );
}

// A setting's value, kept current; undefined until storage answers.
function useSetting(setting: Setting): boolean | undefined {
  const [on, setOn] = useState<boolean>();
  useEffect(() => {
    void setting.getValue().then(setOn);
    return setting.watch(setOn);
  }, [setting]);
  return on;
}

function DependentSwitch({ label, setting, under }: Required<Row>) {
  const parentOn = useSetting(under);
  return <Switch label={label} setting={setting} nested disabled={!parentOn} />;
}

// `nested` is a sub-setting of the switch above it, indented under it.
function Switch({
  label,
  setting,
  nested = false,
  disabled = false,
}: {
  label: string;
  setting: Setting;
  nested?: boolean;
  disabled?: boolean;
}) {
  const on = useSetting(setting);
  const loading = on === undefined;

  return (
    <label
      className={`flex items-center justify-between gap-4 py-2.5 pr-4 text-sm ${nested ? 'pl-8' : 'pl-4'} ${disabled ? 'cursor-default text-base-content/50' : 'cursor-pointer hover:bg-base-200'}`}
    >
      {label}
      {/* hidden until storage answers, then swapped for a fresh input: flipping
          this one would play the toggle's slide every time the popup opens */}
      <input
        key={loading ? 'loading' : 'loaded'}
        type="checkbox"
        role="switch"
        className={`toggle toggle-primary toggle-sm ${loading ? 'invisible' : ''}`}
        checked={on ?? false}
        disabled={loading || disabled}
        onChange={(e) => void setting.setValue(e.currentTarget.checked)}
      />
    </label>
  );
}

export default App;
