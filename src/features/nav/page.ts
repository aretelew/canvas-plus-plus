import { syncPageFlag } from '@/core/page-flag';
import { readMirror } from '@/core/page-mirror';
import {
  clearCache,
  fetchNav,
  readCache,
  readVisits,
  recentWith,
  recordVisit,
  shortLabel,
  type NavCourse,
  type NavData,
  type NavGroup,
  type NavPage,
} from './data';
import { courseNav } from './storage';

// Widens Canvas's global nav into a sidebar: the courses and groups a click
// away instead of two, with what's going on in each, and the pages opened last.
// A course's own pages stay in Canvas's course menu.
//
// Canvas's own buttons stay and only move (nav.css), so their trays and badges
// keep working. Ours are added to the end of its list. Without a list, as on a
// first load whose requests failed, Canvas's Courses and Groups buttons stay.

const FLAG = 'course-nav';
// on all we add to the nav
const ADDED = 'cpp-nav';

interface Row {
  href: string;
  label: string;
  title?: string;
  color?: string;
  course?: NavCourse;
}

export async function syncCourseNav(): Promise<void> {
  // the nav is never in a frame
  if (window.top !== window) return;
  void syncPageFlag(courseNav, FLAG);
  let enabled = false;

  const start = (menu: Element) => {
    if (!enabled) return;
    const who = userName();
    const cached = readCache(who, Date.now());
    let data = cached?.data;
    const show = () => {
      if (!enabled || !data) return;
      paint(menu, { ...data, recent: recentWith(data, readVisits(who)) });
    };
    show();
    // the page's name comes after the nav in the document
    whenParsed(() => {
      if (!enabled) return;
      recordVisit(who, currentPage(who), new Date());
      show();
    });
    if (cached?.fresh) return;
    void fetchNav(who).then((fetched) => {
      if (!fetched) return;
      data = fetched;
      show();
    });
  };

  const apply = (on: boolean) => {
    // it may have been turned off with no Canvas page open to hear of it
    if (!on) clearCache();
    if (on === enabled) return;
    enabled = on;
    if (on) {
      whenMenu(start);
      return;
    }
    for (const added of document.querySelectorAll(`.${ADDED}`)) added.remove();
  };

  apply(readMirror(`canvas++:${FLAG}`) !== undefined);
  apply(await courseNav.getValue());
  courseNav.watch(apply);
}

function whenParsed(run: () => void): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else run();
}

// The nav comes early in the document, so it's filled before the first paint
// instead of at the end of parsing. It has no Account button when signed out.
function whenMenu(run: (menu: Element) => void): void {
  const find = () =>
    document.getElementById('global_nav_profile_link')?.closest('ul');
  const menu = find();
  if (menu) {
    run(menu);
    return;
  }
  const observer = new MutationObserver(() => {
    const found = find();
    if (!found) return;
    observer.disconnect();
    run(found);
  });
  observer.observe(document, { childList: true, subtree: true });
  whenParsed(() => {
    observer.disconnect();
  });
}

function userName(): string {
  const avatar = document.querySelector<HTMLImageElement>(
    '#global_nav_profile_link img',
  );
  return avatar?.alt ?? '';
}

// From the breadcrumbs, which run home, course, section, page. A page of their
// grades ends in the user's name, and a course's files stop at the course.
function currentPage(who: string): Omit<NavPage, 'at' | 'color'> {
  const crumbs = [...document.querySelectorAll('#breadcrumbs li')]
    .map((crumb) => crumb.textContent.trim())
    .filter((crumb) => crumb && crumb !== who);
  return {
    href: location.pathname + location.search,
    name: crumbs.slice(2).at(-1) ?? document.title.trim(),
    where: crumbs[1],
  };
}

function paint(menu: Element, { courses, groups, recent }: NavData): void {
  for (const added of menu.querySelectorAll(`.${ADDED}`)) added.remove();
  const here = /^\/(?:courses|groups)\/\d+/.exec(location.pathname)?.[0];
  const rows = (list: Row[]) =>
    list.map((row) => rowItem(row, row.href === here));
  const list = (key: string, title: string, items: Node[], path?: string) => {
    if (items.length > 0) menu.append(section(key, title, items, path));
  };
  list('courses', 'Courses', rows(courses.map(courseRow)), '/courses');
  list('groups', 'Groups', rows(groups.map(groupRow)), '/groups');
  list('recent', 'Recent', recent.map(recentItem));
}

const courseRow = (course: NavCourse): Row => ({
  href: `/courses/${course.id}`,
  label: course.label,
  title: course.title,
  color: course.color,
  course,
});

const groupRow = ({ id, name, color }: NavGroup): Row => ({
  href: `/groups/${id}`,
  label: name,
  color,
});

function section(
  key: string,
  title: string,
  items: Node[],
  path?: string,
): HTMLElement {
  const item = document.createElement('li');
  item.className = `${ADDED} ${ADDED}-${key}`;
  const heading = document.createElement(path ? 'a' : 'span');
  heading.className = 'cpp-nav-heading';
  if (path) heading.setAttribute('href', path);
  heading.textContent = title;
  const list = document.createElement('ul');
  list.append(...items);
  item.append(heading, list);
  return item;
}

function recentItem({ href, name, where, color }: NavPage): HTMLElement {
  const item = document.createElement('li');
  const link = document.createElement('a');
  const here = href === location.pathname + location.search;
  link.className = here ? 'cpp-nav-page cpp-nav-here' : 'cpp-nav-page';
  link.href = href;
  link.title = where ? `${name}, ${where}` : name;
  const text = document.createElement('span');
  text.className = 'cpp-nav-text';
  const page = document.createElement('span');
  page.className = 'cpp-nav-name';
  page.textContent = name;
  const place = document.createElement('span');
  place.className = 'cpp-nav-where';
  place.textContent = where ?? '';
  text.append(page, place);
  link.append(dot(color), text);
  item.append(link);
  return item;
}

function rowItem(row: Row, here: boolean): HTMLElement {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.className = here ? 'cpp-nav-row cpp-nav-here' : 'cpp-nav-row';
  link.href = row.href;
  link.title = row.title ?? row.label;
  link.append(dot(row.color));
  const name = document.createElement('span');
  name.className = 'cpp-nav-name';
  name.textContent = row.label;
  link.append(name);
  const short = document.createElement('span');
  short.className = 'cpp-nav-short';
  short.textContent = shortLabel(row.label);
  link.append(short);
  if (row.course) {
    const count = countOf(row.course);
    if (count) link.append(count);
  }
  item.append(link);
  return item;
}

function dot(color: string | undefined): HTMLElement {
  const mark = document.createElement('span');
  mark.className = 'cpp-nav-dot';
  mark.setAttribute('aria-hidden', 'true');
  if (color) mark.style.backgroundColor = color;
  return mark;
}

// One signal a row: what's late, or else what's due soon.
function countOf({ soon, late }: NavCourse): HTMLElement | undefined {
  if (late === 0 && soon === 0) return undefined;
  const count = document.createElement('span');
  count.className = late > 0 ? 'cpp-nav-count cpp-nav-late' : 'cpp-nav-count';
  count.textContent = late > 0 ? `${String(late)} late` : `${String(soon)} due`;
  if (late === 0) count.title = `${String(soon)} due this week`;
  return count;
}
