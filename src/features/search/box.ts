import { search, type Entry } from './match';
import css from './search.css?inline';

// The search box: a text field over the page, with what matches under it.
// Arrow keys pick a result and Enter opens it (in a new tab with ⌘ or Ctrl).
// It's a modal <dialog>, so it's over everything Canvas has open, the page
// behind it is inert, Escape closes it and the focus goes back where it was.
// It keeps what was typed, so opening it again picks up where it was.

export interface SearchBox {
  readonly isOpen: boolean;
  open(entries: Entry[], loading: boolean): void;
  // new entries for a box that may be open
  update(entries: Entry[], loading: boolean): void;
  close(): void;
}

// enough to scroll through; past that, more letters narrow it down
const MAX_RESULTS = 50;

export function createSearchBox(): SearchBox {
  const { host, root, dialog, input, list, status } = build();
  document.body.append(host);

  let entries: Entry[] = [];
  let loading = false;
  let results: Entry[] = [];
  let selected = 0;

  const render = () => {
    results = search(entries, input.value).slice(0, MAX_RESULTS);
    list.replaceChildren(...results.map(option));
    status.textContent = statusText(results.length, input.value, loading);
    select(Math.min(selected, Math.max(results.length - 1, 0)));
  };

  const select = (index: number) => {
    selected = index;
    for (const [i, item] of [...list.children].entries()) {
      item.setAttribute('aria-selected', String(i === index));
    }
    const item = list.children[index];
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
    const item = (event.target as Element).closest('li');
    if (item) select([...list.children].indexOf(item));
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
    open(next, nextLoading) {
      entries = next;
      loading = nextLoading;
      selected = 0;
      dialog.showModal();
      render();
      input.select();
    },
    update(next, nextLoading) {
      entries = next;
      loading = nextLoading;
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
  input.placeholder = 'Search courses, pages and work';
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
  if (entry.due) link.append(span('due', dueText(new Date(entry.due))));
  item.append(link);
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

// the day it's due: "Tue, Nov 4"
function dueText(due: Date): string {
  return due.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
