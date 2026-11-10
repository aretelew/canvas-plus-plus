import { SHORTCUT, SHORTCUT_KEYS } from './shortcut';

// The search field at the top of the sidebar: a button that looks like one,
// with the shortcut it stands for. It's put in Canvas's nav list whenever the
// search is on, and nav.css shows it only while the sidebar is on.

/** Its class, to find and style it. */
export const NAV_BUTTON = 'cpp-search-entry';

export function navButton(onClick: () => void): HTMLElement {
  const item = document.createElement('li');
  item.className = NAV_BUTTON;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cpp-search-button';
  button.title = `Search (${SHORTCUT})`;
  button.setAttribute('aria-keyshortcuts', SHORTCUT_KEYS);
  // a magnifier, drawn by nav.css
  const icon = part('cpp-search-icon', '');
  icon.setAttribute('aria-hidden', 'true');
  button.append(icon, part('cpp-search-label', 'Search'));
  const key = part('cpp-search-key', SHORTCUT);
  // it's in the button's keyshortcuts for screen readers
  key.setAttribute('aria-hidden', 'true');
  button.append(key);
  button.addEventListener('click', onClick);
  item.append(button);
  return item;
}

function part(className: string, text: string): HTMLElement {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}
