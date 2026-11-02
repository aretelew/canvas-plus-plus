import { canvasFetch, canvasJson, nextPage } from '@/core/canvas-api';
import { loadCourseColors } from '@/core/courses';
import { currentGroups, loadGroups, type CanvasGroup } from '@/core/groups';
import { savedForUser } from '@/core/saved';
import { loadWorks, type Work } from '@/core/planner';
import { todoGroups, type When } from '../sidebar/todo';

// What the left sidebar lists: the courses on the dashboard, in the cards' order,
// each with what's due, their groups in those courses, and the pages they
// opened last. It's drawn on every page before the first paint, so it's kept in
// the page's localStorage and only asked for again once it's old.

// The parts of GET /api/v1/dashboard/dashboard_cards that are used, in the order
// the dashboard shows them, however the user dragged them. Those are the
// courses they starred, or their active courses while none are. `shortName` is
// the user's nickname, if they gave it one.
export interface DashboardCard {
  id: string;
  shortName: string;
  originalName: string;
  courseCode: string;
}

// The parts of GET /api/v1/users/self/history that are used. Each visit is its
// own entry, newest first, and schools can turn this off.
export interface HistoryEntry {
  asset_name?: string | null;
  visited_url: string;
  visited_at: string;
  context_name?: string;
}

export interface NavCourse {
  id: string;
  label: string;
  // the course's full name
  title: string;
  color?: string;
  // unfinished work due in the next seven days, and past due
  soon: number;
  late: number;
}

export interface NavGroup {
  id: string;
  name: string;
  color?: string;
}

/** A page inside a course or group. */
export interface NavPage {
  href: string;
  name: string;
  // its course or group
  where?: string;
  color?: string;
  // when it was opened
  at: string;
}

export interface NavData {
  courses: NavCourse[];
  groups: NavGroup[];
  recent: NavPage[];
}

// a listed course or group, by the path of its pages
interface Place {
  label: string;
  color?: string;
}

interface NavSources {
  cards: DashboardCard[];
  groups: CanvasGroup[];
  colors: Map<string, string>;
  works: Work[];
  history: HistoryEntry[];
}

const MAX_AGE = 10 * 60 * 1000;
const RECENT = 3;
const CARDS = '/api/v1/dashboard/dashboard_cards';
const HISTORY = '/api/v1/users/self/history';
// how far back to look for enough pages to list
const HISTORY_BATCHES = 4;
// a page inside a course or group, not its home page
const PAGE = /^\/((?:courses|groups)\/\d+)\/(.+)/;
// a course's own sections, past /courses/1/; pages inside them go deeper
const SECTION = /^(?:[^/]+|assignments\/syllabus)$/;

export function navData(
  { cards, groups, colors, works, history }: NavSources,
  now: Date,
): NavData {
  const courses = cards.map((card) => {
    const todo = todoGroups(works, now, card.id);
    const count = (...whens: When[]) =>
      todo
        .filter(({ when }) => whens.includes(when))
        .reduce((sum, group) => sum + group.works.length, 0);
    return {
      id: card.id,
      label:
        card.shortName === card.originalName ? card.courseCode : card.shortName,
      title: card.originalName,
      color: colors.get(card.id),
      soon: count('Today', 'Tomorrow', 'This week'),
      late: count('Overdue'),
    };
  });
  return {
    courses,
    groups: currentGroups(groups, cards).map(({ id, name, course_id }) => ({
      id,
      name,
      color: course_id === undefined ? undefined : colors.get(course_id),
    })),
    recent: recentPages(history),
  };
}

function placesOf(
  courses: NavCourse[],
  groups: NavGroup[],
): Map<string, Place> {
  return new Map<string, Place>([
    ...courses.map(
      ({ id, label, color }) => [`courses/${id}`, { label, color }] as const,
    ),
    ...groups.map(
      ({ id, name, color }) =>
        [`groups/${id}`, { label: name, color }] as const,
    ),
  ]);
}

/**
 * The last pages opened inside a course or group, once each. Home pages are
 * left out, since the course or group is already listed, and links are only
 * ever to this site.
 */
export function recentPages(history: HistoryEntry[]): NavPage[] {
  const pages = new Map<string, NavPage>();
  for (const entry of history) {
    if (pages.size === RECENT) break;
    const { asset_name, visited_url, visited_at, context_name } = entry;
    // only the path is kept, so the base doesn't matter
    const { pathname, search } = new URL(visited_url, 'https://canvas.test');
    const inside = PAGE.exec(pathname);
    const href = pathname + search;
    if (!asset_name || !inside || pages.has(href)) continue;
    pages.set(href, {
      href,
      // "Course Modules": a course's own sections all start this way
      name: SECTION.test(inside[2] ?? '')
        ? asset_name.replace(/^Course /, '')
        : asset_name,
      where: context_name,
      at: visited_at,
    });
  }
  return [...pages.values()];
}

/** What fits in the collapsed sidebar: "340" for "CSDS 340". */
export function shortLabel(label: string): string {
  return /\d+[A-Z]?\b/.exec(label)?.[0] ?? label.slice(0, 3);
}

/**
 * Canvas's history is saved here for minutes and can lag behind by more, so
 * the pages opened in this browser are noted as well, and what's newest of the
 * two is listed. Each says where it is the way the sidebar names it, since
 * Canvas calls every course's page the same thing.
 */
export function recentWith(
  { courses, groups, recent }: NavData,
  visits: NavPage[],
): NavPage[] {
  const pages = new Map<string, NavPage>();
  const newest = [...visits, ...recent].sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at),
  );
  for (const page of newest) {
    if (!pages.has(page.href)) pages.set(page.href, page);
  }
  const places = placesOf(courses, groups);
  return [...pages.values()].slice(0, RECENT).map((page) => {
    const place = places.get(PAGE.exec(page.href)?.[1] ?? '');
    return { ...page, where: place?.label ?? page.where, color: place?.color };
  });
}

/** What's listed, as last loaded, and asked for again once it's old. */
export const savedNav = savedForUser<NavData>(
  'canvas++:course-nav-saved',
  MAX_AGE,
);
const savedVisits = savedForUser<NavPage[]>('canvas++:course-nav-visits');

export function readVisits(who: string): NavPage[] {
  return savedVisits.read(who, Date.now())?.value ?? [];
}

/** Notes the page, if it's one Recent lists. */
export function recordVisit(
  who: string,
  page: Omit<NavPage, 'at' | 'color'>,
  now: Date,
): void {
  if (!PAGE.test(page.href)) return;
  const others = readVisits(who).filter(({ href }) => href !== page.href);
  const pages = [{ ...page, at: now.toISOString() }, ...others];
  savedVisits.write(who, pages.slice(0, RECENT), now.getTime());
}

export function clearCache(): void {
  savedNav.clear();
  savedVisits.clear();
}

/**
 * The user's history, as far back as it takes to list enough pages. Canvas
 * cuts each batch of 100 visits down afterwards, dropping the requests a page
 * makes, so a batch can have next to nothing left in it. Empty when a school
 * has page history off.
 */
async function loadHistory(): Promise<HistoryEntry[]> {
  const history: HistoryEntry[] = [];
  let next: string | undefined = HISTORY;
  try {
    for (let batch = 0; next && batch < HISTORY_BATCHES; batch += 1) {
      const response = await canvasFetch(next);
      if (!response.ok) break;
      history.push(...((await response.json()) as HistoryEntry[]));
      if (recentPages(history).length === RECENT) break;
      next = nextPage(response.headers.get('Link'));
    }
  } catch {
    // what came before it is still worth listing
  }
  return history;
}

/** Undefined when the courses can't be loaded; what's saved stays. */
export async function fetchNav(who: string): Promise<NavData | undefined> {
  const [cards, groups, colors, works, history] = await Promise.all([
    canvasJson<DashboardCard[]>(CARDS),
    loadGroups(),
    loadCourseColors(),
    loadWorks(),
    loadHistory(),
  ]);
  if (!cards) return undefined;
  const now = new Date();
  const data = navData(
    {
      cards,
      groups,
      colors,
      works: works ?? [],
      history,
    },
    now,
  );
  savedNav.write(who, data, now.getTime());
  return data;
}
