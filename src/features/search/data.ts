import { canvasJson } from '@/core/canvas-api';
import { loadCourseColors } from '@/core/courses';
import { currentGroups, loadGroups, type CanvasGroup } from '@/core/groups';
import { loadWorks, type Work } from '@/core/planner';
import { savedForUser } from '@/core/saved';
import {
  loadCourseItems,
  type CourseAssignment,
  type CourseItems,
} from './course-items';
import type { Entry } from './match';

// What the search box lists: the user's courses and the pages in each, their
// work, every assignment and module item in their current courses, their
// groups, and Canvas's own pages. It's asked for the first time the box opens,
// then kept in the page's localStorage so it opens with it at once on the next
// page, and asked for again once it's old.

// The parts of GET /api/v1/courses?include[]=tabs&include[]=concluded that are
// used. `name` is the user's nickname for it when they gave one, and
// `original_name` is only there then.
export interface SearchCourse {
  id: string;
  name: string;
  original_name?: string;
  course_code: string;
  // its term is over, though the course is still open
  concluded?: boolean;
  // the course's menu, as it is for the user
  tabs?: Tab[];
}

interface Tab {
  id: string;
  html_url: string;
  label: string;
  // shown only to teachers
  hidden?: boolean;
}

interface SearchSources extends CourseItems {
  courses: SearchCourse[];
  groups: CanvasGroup[];
  colors: Map<string, string>;
  works: Work[];
}

const MAX_AGE = 10 * 60 * 1000;
const COURSES =
  '/api/v1/courses?enrollment_state=active&include[]=tabs&include[]=concluded&per_page=100';
const DAY = 24 * 60 * 60 * 1000;
// work due this soon is listed before anything is typed
const SOON = 7 * DAY;

/** Canvas's own pages: all there is to list until the rest is loaded. */
export const CANVAS_PAGES: Entry[] = [
  { title: 'Dashboard', href: '/' },
  { title: 'Calendar', href: '/calendar' },
  { title: 'Inbox', href: '/conversations' },
  { title: 'All courses', href: '/courses' },
  { title: 'All grades', href: '/grades' },
  { title: 'All groups', href: '/groups' },
  { title: 'Account settings', href: '/profile/settings' },
  { title: 'Notifications', href: '/profile/communication' },
];

/** What's listed, as last loaded, and asked for again once it's old. */
export const savedEntries = savedForUser<Entry[]>(
  'canvas++:search-saved',
  MAX_AGE,
);

// where something in a course is: the course as it's listed
type InCourse = (id: string | undefined) => Pick<Entry, 'where' | 'color'>;

/**
 * The current courses first, in name order, then the work left to do, soonest
 * first, the groups, each course's pages, the rest of their assignments, their
 * module items, the courses whose term is over, and Canvas's own pages. Links
 * only ever go to this site.
 */
export function searchEntries(
  { courses, groups, colors, works, assignments, moduleItems }: SearchSources,
  now: Date,
): Entry[] {
  const entryOf = (course: SearchCourse): Entry => ({
    title: courseLabel(course),
    href: `/courses/${course.id}`,
    also: [course.original_name ?? course.name, course.course_code],
    color: colors.get(course.id),
  });
  const current = courses
    .filter(isCurrent)
    .map((course) => ({ course, entry: entryOf(course) }))
    .sort((a, b) => a.entry.title.localeCompare(b.entry.title));
  const byId = new Map(current.map(({ course, entry }) => [course.id, entry]));
  const inCourse: InCourse = (id) => {
    const course = id === undefined ? undefined : byId.get(id);
    return { where: course?.title, color: course?.color };
  };
  const todo = works.filter(
    ({ done, override }) => !done && !override?.dismissed,
  );
  // what's in the To Do is listed there, with what's late first
  const inToDo = new Set(
    todo.flatMap(({ target }) =>
      target.plannable_type === 'assignment' ? [target.plannable_id] : [],
    ),
  );

  return [
    ...current.map(({ entry }) => ({ ...entry, start: true })),
    ...workEntries(todo, inCourse, now),
    ...currentGroups(
      groups,
      current.map(({ course }) => course),
    ).map(({ id, name, course_id }) => ({
      title: name,
      href: `/groups/${id}`,
      ...inCourse(course_id),
    })),
    ...current.flatMap(({ course, entry }) => pageEntries(course, entry)),
    ...assignmentEntries(assignments, inToDo, inCourse, now),
    ...moduleItems.map(({ title, url, module, courseId }) => ({
      title,
      href: url,
      // so "week 3 reading" finds that reading
      also: [module],
      ...inCourse(courseId),
    })),
    ...courses.filter((course) => !isCurrent(course)).map(entryOf),
    ...CANVAS_PAGES,
  ].filter(({ href }) => onThisSite(href));
}

// a course whose term isn't over
const isCurrent = ({ concluded }: SearchCourse) => concluded !== true;

// What the sidebar calls it too: the user's nickname, or else its code.
function courseLabel({
  name,
  original_name,
  course_code,
}: SearchCourse): string {
  return original_name === undefined ? course_code : name;
}

// Work left to do, soonest first, named by the course's label where it's
// listed and Canvas's name for it where it isn't.
function workEntries(todo: Work[], inCourse: InCourse, now: Date): Entry[] {
  return todo
    .toSorted((a, b) => a.due.getTime() - b.due.getTime())
    .flatMap(({ title, url, due, courseId, courseName }) => {
      // the user's own notes have no page
      if (url === undefined) return [];
      const { where, color } = inCourse(courseId);
      return {
        title,
        href: url,
        where: where ?? courseName,
        color,
        due: due.toISOString(),
        start: due.getTime() - now.getTime() < SOON,
      };
    });
}

// The course's menu, but its home page, which the course's own entry stands
// for, and what only teachers see.
function pageEntries(course: SearchCourse, { title, also, color }: Entry) {
  return (course.tabs ?? [])
    .filter(({ id, hidden }) => id !== 'home' && hidden !== true)
    .map(({ label, html_url }) => ({
      title: label,
      href: html_url,
      where: title,
      also,
      color,
    }));
}

// The rest of the assignments, without what the To Do lists already.
function assignmentEntries(
  assignments: CourseAssignment[],
  inToDo: Set<string>,
  inCourse: InCourse,
  now: Date,
): Entry[] {
  return byWhenDue(
    assignments.filter(({ id }) => !inToDo.has(id)),
    now.getTime(),
  ).map(({ name, url, due, courseId }) => ({
    title: name,
    href: url,
    due,
    ...inCourse(courseId),
  }));
}

// What's coming up, soonest first, then what's past, latest first, then what
// has no due date.
function byWhenDue(
  assignments: CourseAssignment[],
  now: number,
): CourseAssignment[] {
  // NaN for no due date, which is neither coming up nor past
  const at = ({ due }: CourseAssignment) =>
    due === undefined ? NaN : Date.parse(due);
  const upcoming = assignments.filter((a) => at(a) >= now);
  const past = assignments.filter((a) => at(a) < now);
  return [
    ...upcoming.sort((a, b) => at(a) - at(b)),
    ...past.sort((a, b) => at(b) - at(a)),
    ...assignments.filter(({ due }) => due === undefined),
  ];
}

// a path on this site, never another site or a script
const onThisSite = (href: string) => /^\/(?![/\\])/.test(href);

// The courses, then the assignments and module items in the current ones:
// they're asked for by course.
async function loadCoursesAndItems(): Promise<
  Pick<SearchSources, 'courses' | keyof CourseItems> | undefined
> {
  const courses = await canvasJson<SearchCourse[]>(COURSES);
  if (!courses) return undefined;
  const current = courses.filter(isCurrent).map(({ id }) => id);
  return { courses, ...(await loadCourseItems(current)) };
}

/** Undefined when the courses can't be loaded; what's saved stays. */
export async function fetchEntries(who: string): Promise<Entry[] | undefined> {
  const [courses, groups, colors, works] = await Promise.all([
    loadCoursesAndItems(),
    loadGroups(),
    loadCourseColors(),
    loadWorks(),
  ]);
  if (!courses) return undefined;
  const now = new Date();
  const entries = searchEntries(
    { ...courses, groups, colors, works: works ?? [] },
    now,
  );
  savedEntries.write(who, entries, now.getTime());
  return entries;
}
