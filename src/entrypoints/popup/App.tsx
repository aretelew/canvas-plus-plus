import { type ReactNode, useEffect, useId, useState } from 'react';
import { browser } from '#imports';
import { focus } from './focus';
import { Chevron, Gear, Info } from './icons';
import { PageLink } from './PageLink';
import {
  type Item,
  pages,
  type PermissionRow,
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
      {/* the main page alone sets the popup's height, hidden while another
          shows, so the popup keeps it from page to page; clipped, so the main
          page's last line falls off the edge */}
      <div className="relative overflow-hidden">
        <Page main shown={!open}>
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
        {pages.map((page) => (
          <Page key={page.title} shown={page === open}>
            {page.rows.map((row) =>
              'rows' in row ? (
                <PageLink
                  key={row.title}
                  label={row.title}
                  focused={page === open && row === closed}
                  onOpen={() => {
                    push(row);
                  }}
                />
              ) : 'permission' in row ? (
                <PermissionSwitch key={row.label} {...row} />
              ) : (
                <Switch key={row.label} {...row} />
              ),
            )}
          </Page>
        ))}
        {open === 'settings' && (
          <Page shown>
            <Settings
              sitesFocused={closed === 'sites'}
              onOpenSites={() => {
                push('sites');
              }}
            />
          </Page>
        )}
        {open === 'sites' && (
          <Page shown>
            <Sites />
          </Page>
        )}
      </div>
    </main>
  );
}

// One page of the popup. Rows are separated by lines rather than boxed, and
// padded per row, not here, so the lines and the hover tint run edge to edge.
// Each row has a line under it, so a page shorter than the popup ends on one.
// The main page is pulled up by that line's width to keep it out of the
// popup's height. The others lie over the main page and scroll if they need
// to; reaching a pixel past it, they clip their last line the same way, and a
// page with the main page's rows doesn't scroll for that one line.
function Page({
  main = false,
  shown,
  children,
}: {
  main?: boolean;
  shown: boolean;
  children: ReactNode;
}) {
  const place = main
    ? '-mb-px'
    : 'scroll-fade absolute inset-x-0 top-0 -bottom-px overflow-y-auto';
  return (
    <div
      className={`${place} *:border-b *:border-base-300 ${shown ? '' : 'invisible'}`}
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

function Switch<T>({ label, setting, on, off }: SwitchRow<T>) {
  const value = useSetting(setting);
  return (
    <Toggle
      label={label}
      checked={value === undefined ? undefined : value === on}
      onChange={(checked) => void setting.setValue(checked ? on : off)}
    />
  );
}

function PermissionSwitch({ label, permission, hint }: PermissionRow) {
  const [granted, setGranted] = useState<boolean>();

  useEffect(() => {
    const load = () =>
      void browser.permissions
        .contains({ permissions: [permission] })
        .then(setGranted);
    load();
    browser.permissions.onAdded.addListener(load);
    browser.permissions.onRemoved.addListener(load);
    return () => {
      browser.permissions.onAdded.removeListener(load);
      browser.permissions.onRemoved.removeListener(load);
    };
  }, [permission]);

  return (
    <Toggle
      label={label}
      hint={hint}
      checked={granted}
      onChange={(checked, input) => {
        // first thing in the change: browsers only ask from a user action.
        // Firefox may close the popup for its prompt.
        const changed = checked
          ? browser.permissions.request({ permissions: [permission] })
          : browser.permissions.remove({ permissions: [permission] });
        void changed.then((done) => {
          // refused: the switch goes back, which a state that didn't change
          // wouldn't do
          if (!done) input.checked = !checked;
        });
      }}
    />
  );
}

// A switch's row; `checked` is undefined until it's known. A `hint` shows
// under the row, the popup's width, while its info button is hovered or
// focused, over the rows below, so it takes no room of its own. The label
// names its switch outright: it would otherwise label the first control in
// it, the info button, which hovering or clicking anywhere in the row would
// then reach.
function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean | undefined;
  onChange: (checked: boolean, input: HTMLInputElement) => void;
}) {
  const loading = checked === undefined;
  const hintId = useId();
  const inputId = useId();
  return (
    <label
      htmlFor={inputId}
      className="relative flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5 text-sm hover:bg-base-200"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {label}
        {hint && (
          <>
            <button
              type="button"
              className="peer -m-1 cursor-help p-1 text-base-content/50 hover:text-base-content focus-visible:text-base-content"
              aria-label={`About ${label}`}
              aria-describedby={hintId}
            >
              <Info />
            </button>
            <span
              id={hintId}
              role="tooltip"
              className="pointer-events-none invisible absolute inset-x-0 top-full z-10 border-b border-base-300 bg-neutral px-4 py-2.5 text-neutral-content shadow-lg peer-hover:visible peer-focus-visible:visible"
            >
              {hint}
            </span>
          </>
        )}
      </span>
      {/* hidden until it's known, then swapped for a fresh input: flipping
          this one would play the toggle's slide every time the popup opens */}
      <input
        key={loading ? 'loading' : 'loaded'}
        id={inputId}
        type="checkbox"
        role="switch"
        // named by the label alone, not its info button too; the hint
        // describes it
        aria-label={label}
        aria-describedby={hint ? hintId : undefined}
        className={`toggle toggle-primary toggle-sm ${loading ? 'invisible' : ''}`}
        checked={checked === true}
        disabled={loading}
        onChange={(e) => {
          onChange(e.currentTarget.checked, e.currentTarget);
        }}
      />
    </label>
  );
}

export default App;
