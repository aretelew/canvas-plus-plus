import { type ReactNode, useEffect, useId, useState } from 'react';
import { focus } from './focus';
import { Chevron, Gear } from './icons';
import { PageLink } from './PageLink';
import {
  type ChoiceRow,
  type Item,
  type Section,
  sections,
  type SwitchRow,
} from './sections';
import { Settings, Sites } from './Settings';
import { SiteAccess } from './SiteAccess';

// a page of the popup besides the main one: a section, the gear's settings,
// or the sites the settings open
type Opened = Section | 'settings' | 'sites';

function App() {
  // the pages open over the main one, the last showing; Back closes it
  const [stack, setStack] = useState<Opened[]>([]);
  // the page Back closed last, so the row that opened it takes the focus
  const [closed, setClosed] = useState<Opened>();
  const open = stack.at(-1);
  const inSettings = stack[0] === 'settings';
  const push = (page: Opened) => {
    setStack([...stack, page]);
  };

  return (
    <main className="w-72">
      {/* three columns keep the name centered between the back arrow and the
          gear, which fill the header's corners like the rows fill theirs */}
      <header className="grid h-10 grid-cols-[1fr_auto_1fr] items-center border-b border-base-300">
        {open && (
          <button
            // a fresh one per page, so it takes the focus on each
            key={stack.length}
            ref={focus}
            type="button"
            className="flex h-full w-10 cursor-pointer items-center justify-center hover:bg-base-200"
            aria-label="Back"
            onClick={() => {
              setClosed(open);
              setStack(stack.slice(0, -1));
            }}
          >
            <Chevron direction="left" />
          </button>
        )}
        <h1 className="col-start-2 text-sm font-semibold">canvas++</h1>
        {!inSettings && (
          <button
            ref={!open && closed === 'settings' ? focus : undefined}
            type="button"
            className="flex h-full w-10 cursor-pointer items-center justify-center justify-self-end text-base-content/50 hover:bg-base-200 hover:text-base-content"
            aria-label="Settings"
            onClick={() => {
              // from a section too: Back then goes to the main page
              setStack(['settings']);
            }}
          >
            <Gear />
          </button>
        )}
      </header>
      {inSettings ? (
        // on their own, as tall as they need: the list of sites can grow, and
        // the other pages shouldn't grow with it
        <div className="grid overflow-hidden">
          <Page shown>
            {open === 'sites' ? (
              <Sites />
            ) : (
              <Settings
                sitesFocused={closed === 'sites'}
                onOpenSites={() => {
                  push('sites');
                }}
              />
            )}
          </Page>
        </div>
      ) : (
        // every page sits in the same cell, the ones not showing hidden, so
        // the popup keeps one height (the tallest page's) as it moves between
        // them; clipped, so the tallest page's last line falls off the edge
        <div className="grid overflow-hidden">
          <Page shown={!open}>
            {sections.map((section) => (
              <PageLink
                key={section.title}
                label={section.title}
                focused={!open && section === closed}
                onOpen={() => {
                  push(section);
                }}
              />
            ))}
            <SiteAccess />
          </Page>
          {sections.map((section) => (
            <Page key={section.title} shown={section === open}>
              {section.rows.map((row) =>
                'options' in row ? (
                  <Choice key={row.label} {...row} />
                ) : row.under ? (
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
      )}
    </main>
  );
}

// One page of the popup, in the cell all of them share. Rows are separated by
// lines rather than boxed, and padded per row, not here, so the lines and the
// hover tint run edge to edge. Each row has a line under it, so a page shorter
// than the popup ends on one; pulling the page up by that line's width keeps
// it out of the cell's height, so the tallest page's last line is clipped.
function Page({ shown, children }: { shown: boolean; children: ReactNode }) {
  return (
    <div
      className={`col-start-1 row-start-1 -mb-px *:border-b *:border-base-300 ${shown ? '' : 'invisible'}`}
    >
      {children}
    </div>
  );
}

// A setting's value, kept current; undefined until storage answers.
function useSetting<T>(setting: Item<T>): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    void setting.getValue().then(setValue);
    return setting.watch(setValue);
  }, [setting]);
  return value;
}

function DependentSwitch({ label, setting, under }: Required<SwitchRow>) {
  const parent = useSetting(under.setting);
  return (
    <Switch
      label={label}
      setting={setting}
      nested
      disabled={parent === undefined || parent === under.off}
    />
  );
}

// The options read as one control, the chosen one filled in. It fills the
// row's end, top to bottom, like the header's back arrow fills its corner.
// Hidden until storage answers, like a switch.
function Choice<T extends string>({ label, setting, options }: ChoiceRow<T>) {
  const value = useSetting(setting);
  const id = useId();

  return (
    <div className="flex justify-between gap-4 pl-4 text-sm">
      <span id={id} className="py-2.5">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={id}
        className={`flex ${value === undefined ? 'invisible' : ''}`}
      >
        {options.map((option) => (
          <input
            key={option.value}
            type="radio"
            name={id}
            aria-label={option.label}
            className="btn h-auto rounded-none border-0 border-base-300 px-3 text-sm transition-none not-last:border-r"
            checked={value === option.value}
            onChange={() => void setting.setValue(option.value)}
          />
        ))}
      </div>
    </div>
  );
}

// `nested` is a sub-setting of the switch above it, indented under it.
function Switch({
  label,
  setting,
  nested = false,
  disabled = false,
}: {
  label: string;
  setting: Item<boolean>;
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
