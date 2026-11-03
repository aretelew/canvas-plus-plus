import { savedForUser } from '@/core/saved';
import type { Entry } from './match';

// What the user opened last, listed before anything is typed. Each Canvas page
// opened is noted by its path, kept in the page's localStorage per user, and
// matched to what the search box lists when it opens, so a page it doesn't
// list (a submission, say) is passed over.

/**
 * A page opened: its path, and the module item it was opened as, since Canvas
 * sends a module item's link on to its page, from /courses/1/modules/items/5
 * to /courses/1/pages/intro?module_item_id=5.
 */
export interface Visit {
  path: string;
  item?: string;
}

// enough that the pages the box doesn't list don't crowd out the ones it does
const KEPT = 50;
const SHOWN = 5;

const savedVisits = savedForUser<Visit[]>('canvas++:search-visits');

export function visitOf({ pathname, searchParams }: URL): Visit {
  // "/courses/1/" is "/courses/1", but "/" stays
  const path = pathname.replace(/(?<=.)\/$/, '');
  const course = /^\/courses\/\d+/.exec(path)?.[0];
  const item = searchParams.get('module_item_id');
  if (!course || !item || !/^\d+$/.test(item)) return { path };
  return { path, item: `${course}/modules/items/${item}` };
}

/** Notes the page as the newest, once. */
export function recordVisit(who: string, visit: Visit, now: number): void {
  const others = readVisits(who).filter(
    ({ path, item }) => path !== visit.path || item !== visit.item,
  );
  savedVisits.write(who, [visit, ...others].slice(0, KEPT), now);
}

export function readVisits(who: string): Visit[] {
  return savedVisits.read(who, Date.now())?.value ?? [];
}

export function clearVisits(): void {
  savedVisits.clear();
}

/**
 * What's listed of the pages opened last, newest first, once each, but the
 * one that's open: it's already there.
 */
export function recentEntries(
  entries: Entry[],
  visits: Visit[],
  here: Visit,
): Entry[] {
  // the first listing of a page says the most about it, like work's due date
  const byHref = new Map<string, Entry>();
  for (const entry of entries) {
    if (!byHref.has(entry.href)) byHref.set(entry.href, entry);
  }
  const find = ({ path, item }: Visit) =>
    byHref.get(path) ?? (item === undefined ? undefined : byHref.get(item));
  const open = find(here);
  const found = new Set<Entry>();
  for (const visit of visits) {
    if (found.size === SHOWN) break;
    const entry = find(visit);
    if (entry && entry !== open) found.add(entry);
  }
  return [...found];
}
