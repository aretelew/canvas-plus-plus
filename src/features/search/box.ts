import { search, type Entry } from './match';
import css from './search.css?inline';

// The search box: a text field over the page, with what matches under it.
// Arrow keys pick a result and Enter opens it (in a new tab with ⌘ or Ctrl).
// It's a modal <dialog>, so it's over everything Canvas has open, the page
// behind it is inert, Escape closes it and the focus goes back where it was.
// It keeps what was typed, so opening it again picks up where it was. Before
// anything is typed, it lists what was opened last above what it starts with.

/** What the box lists. */
export interface Listing {
  entries: Entry[];
  // opened last, newest first
  recent: Entry[];
  loading: boolean;
}

export interface SearchBox {
  readonly isOpen: boolean;
  open(listing: Listing): void;
  // a new listing for a box that may be open
  update(listing: Listing): void;
  close(): void;
}

// a run of results, under its title when it has one
interface Section {
  title?: string;
  entries: Entry[];
}

// enough to scroll through; past that, more letters narrow it down
const MAX_RESULTS = 50;

export function createSearchBox(): SearchBox {
  const { host, root, dialog, input, list, status } = build();
  document.body.append(host);

  let listing: Listing = { entries: [], recent: [], loading: false };
  let results: Entry[] = [];
  let options: HTMLElement[] = [];
  let selected = 0;

  const render = () => {
    results = [];
    options = [];
    const items: HTMLElement[] = [];
    for (const { title, entries } of sections(listing, input.value)) {
      const part = entries.map((entry, i) => option(entry, results.length + i));
      results.push(...entries);
      options.push(...part);
      items.push(...(title ? [group(title, part)] : part));
    }
    list.replaceChildren(...items);
    status.textContent = statusText(
      results.length,
      input.value,
      listing.loading,
    );
    select(Math.min(selected, Math.max(results.length - 1, 0)));
  };

  const select = (index: number) => {
    selected = index;
    for (const [i, item] of options.entries()) {
      item.setAttribute('aria-selected', String(i === index));
    }
    const item = options[index];
    if (item) {
      input.setAttribute('aria-activedescendant', item.id);
      item.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  };

  const close = () => {
    dialog.close();
  };

  const go = (entry: Entry | undefined, newTab: boolean) => {
    if (!entry) return;
    close();
    if (newTab) window.open(entry.href, '_blank', 'noopener');
    else location.assign(entry.href);
  };

  input.addEventListener('input', () => {
    selected = 0;
    render();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      go(results[selected], event.metaKey || event.ctrlKey);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (results.length === 0) return;
    const step = event.key === 'ArrowDown' ? 1 : -1;
    select((selected + step + results.length) % results.length);
  });
  // Seen from the page, keys typed here come from a <div>, not a text field,
  // so Canvas's own shortcuts would take them.
  for (const type of ['keydown', 'keypress', 'keyup']) {
    root.addEventListener(type, (event) => {
      event.stopPropagation();
    });
  }
  list.addEventListener('mousemove', (event) => {
    const item = (event.target as Element).closest('[role="option"]');
    if (item) select(options.indexOf(item as HTMLElement));
  });
  // a link opens as links do (a new tab with a middle click, say)
  list.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a')) close();
  });
  // the backdrop is the dialog's, so a click on it is a click on the dialog
  dialog.addEventListener('mousedown', (event) => {
    if (event.target === dialog) close();
  });

  return {
    get isOpen() {
      return dialog.open;
    },
    open(next) {
      listing = next;
      selected = 0;
      dialog.showModal();
      render();
      input.select();
    },
    update(next) {
      listing = next;
      if (dialog.open) render();
    },
    close,
  };
}

// The box's elements, in a shadow root of their own so Canvas's styles can't
// reach them.
function build() {
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label', 'Search Canvas');
  const list = document.createElement('ul');
  list.id = 'results';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Results');
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search courses, work and announcements';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-controls', list.id);
  const status = document.createElement('p');
  status.className = 'status';
  status.setAttribute('role', 'status');
  dialog.append(input, list, status);
  root.append(style, dialog);
  return { host, root, dialog, input, list, status };
}

function option(entry: Entry, index: number): HTMLElement {
  const item = document.createElement('li');
  item.id = `result-${String(index)}`;
  item.setAttribute('role', 'option');
  const link = document.createElement('a');
  link.href = entry.href;
  link.tabIndex = -1;
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.setAttribute('aria-hidden', 'true');
  if (entry.color) dot.style.background = entry.color;
  link.append(dot, span('title', entry.title));
  if (entry.where) link.append(span('where', entry.where));
  if (entry.due) link.append(span('due', dayText(entry.due)));
  if (entry.post) link.append(posted(entry.post));
  item.append(link);
  return item;
}

// What's typed found, or with nothing typed, what was opened last and then
// what's listed to start with, without what's already above. They're titled
// only when there's something recent, to tell the two apart.
function sections({ entries, recent }: Listing, typed: string): Section[] {
  const found = search(entries, typed).slice(0, MAX_RESULTS);
  if (typed.trim() || recent.length === 0) return [{ entries: found }];
  const opened = new Set(recent.map(({ href }) => href));
  return [
    { title: 'Recent', entries: recent },
    {
      title: 'Courses and work due',
      entries: found.filter(({ href }) => !opened.has(href)),
    },
  ].filter((section) => section.entries.length > 0);
}

// A titled run of options. Screen readers hear the title as the group's name,
// so they don't read it as text too.
function group(title: string, options: HTMLElement[]): HTMLElement {
  const item = document.createElement('li');
  item.setAttribute('role', 'group');
  item.setAttribute('aria-label', title);
  const heading = span('heading', title);
  heading.setAttribute('aria-hidden', 'true');
  const list = document.createElement('ul');
  list.setAttribute('role', 'none');
  list.append(...options);
  item.append(heading, list);
  return item;
}

// what's said in place of results, while there are none
function statusText(found: number, typed: string, loading: boolean): string {
  if (found > 0) return '';
  if (loading) return 'Loading…';
  return typed.trim() ? 'No matches' : 'Type to search';
}

function span(className: string, text: string): HTMLElement {
  const part = document.createElement('span');
  part.className = className;
  part.textContent = text;
  return part;
}

// a day work is due or a post was posted (ISO): "Tue, Nov 4"
function dayText(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// Canvas's own pictures for them, a megaphone and a speech bubble, drawn as
// line icons like the popup's
const POSTS = {
  announcement: {
    name: 'Announcement',
    paths: ['M3 11l18-5v12L3 14v-3z', 'M11.6 16.8a3 3 0 1 1-5.8-1.6'],
  },
  discussion: {
    name: 'Discussion',
    paths: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  },
};

// The day a post was posted, in the place a due day takes, then what it is,
// as its icon. The icon is named, so it's heard, and shown on hover.
function posted({ kind, at }: NonNullable<Entry['post']>): HTMLElement {
  const { name, paths } = POSTS[kind];
  const ns = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(ns, 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('role', 'img');
  icon.setAttribute('aria-label', name);
  const title = document.createElementNS(ns, 'title');
  title.textContent = name;
  icon.append(title);
  for (const d of paths) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    icon.append(path);
  }
  const part = span('posted', at === undefined ? '' : dayText(at));
  part.append(icon);
  return part;
}
