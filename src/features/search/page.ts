import { whenNavMenu } from '@/core/nav-menu';
import { readMirror, writeMirror } from '@/core/page-mirror';
import { userName } from '@/core/saved';
import { createSearchBox, type SearchBox } from './box';
import { CANVAS_PAGES, fetchEntries, savedEntries } from './data';
import type { Entry } from './match';
import { navButton } from './nav-button';
import {
  clearVisits,
  readVisits,
  recentEntries,
  recordVisit,
  visitOf,
} from './recent';
import { isShortcut } from './shortcut';
import { quickSearch } from './storage';
import { clearPageTexts } from './texts';

// Opens the search box with its shortcut, on any Canvas page, while the setting
// is on. While nothing is saved, what it lists is asked for once the page has
// loaded, so it opens full the first time. After that it's asked for when it
// opens, once a page at most, unless what's saved is recent enough to keep.
// Each page is noted as it loads, so the box can list what was opened last.
// A search field at the top of the sidebar opens it too (nav-button.ts).

// the setting's copy in the page (see page-mirror.ts), so the shortcut works
// as soon as the page does
const MIRROR_KEY = 'canvas++:quick-search';

export async function syncSearch(): Promise<void> {
  // one box a tab, opened from the page itself; a frame's keys stay its own
  if (window.top !== window) return;
  let enabled = false;
  let box: SearchBox | undefined;
  let fetched: Promise<Entry[] | undefined> | undefined;
  let button: HTMLElement | undefined;

  const open = () => {
    box ??= createSearchBox();
    const opened = box;
    const who = userName();
    const visits = readVisits(who);
    const here = visitOf(new URL(location.href));
    const listing = (entries: Entry[], loading: boolean) => ({
      entries,
      recent: recentEntries(entries, visits, here),
      loading,
    });
    const saved = savedEntries.read(who, Date.now());
    opened.open(listing(saved?.value ?? CANVAS_PAGES, !saved));
    if (saved?.fresh) return;
    void (fetched ??= fetchEntries(who)).then((entries) => {
      opened.update(listing(entries ?? saved?.value ?? CANVAS_PAGES, false));
    });
  };

  const loaded = () => {
    const who = userName();
    // signed out
    if (!who) return;
    recordVisit(who, visitOf(new URL(location.href)), Date.now());
    if (!savedEntries.read(who, Date.now())) fetched ??= fetchEntries(who);
  };

  const onKey = (event: KeyboardEvent) => {
    if (!isShortcut(event) || event.repeat) return;
    // a field Canvas lets the user write in may have its own ⌘K, like a link
    if (event.target instanceof HTMLElement && event.target.isContentEditable) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (box?.isOpen) box.close();
    else open();
  };

  // first in the nav's list, as soon as the list is in the page
  const addButton = (menu: Element) => {
    if (!enabled || button?.isConnected) return;
    // the box is modal, so the button can't be clicked while it's open
    button = navButton(open);
    menu.prepend(button);
  };

  const apply = (on: boolean) => {
    writeMirror(MIRROR_KEY, on ? '1' : undefined);
    enabled = on;
    if (on) {
      whenNavMenu(addButton);
      // capturing, so it's seen before Canvas's own key handlers
      window.addEventListener('keydown', onKey, true);
      // after the page's own requests, so it isn't held up by these
      if (document.readyState === 'complete') loaded();
      else window.addEventListener('load', loaded, { once: true });
      return;
    }
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('load', loaded);
    button?.remove();
    box?.close();
    fetched = undefined;
    // it may have been turned off with no Canvas page open to hear of it
    savedEntries.clear();
    clearPageTexts();
    clearVisits();
  };

  apply(readMirror(MIRROR_KEY) !== undefined);
  apply(await quickSearch.getValue());
  quickSearch.watch(apply);
}
