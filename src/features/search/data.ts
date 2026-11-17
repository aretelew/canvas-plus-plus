import { canvasJson } from '@/core/canvas-api';
import { loadCourseColors } from '@/core/courses';
import { currentGroups, loadGroups, type CanvasGroup } from '@/core/groups';
import { loadWorks, type Work } from '@/core/planner';
import { savedForUser } from '@/core/saved';
import {
  loadCourseItems,
  type CourseAssignment,
  type CourseItems,
  type CoursePost,
  type ModuleItem,
} from './course-items';
import type { Entry, Kind } from './match';

// What the search box lists: the user's courses and the pages in each, their
// work, every assignment and module item in their current courses and their
// latest announcements and discussions, their groups, and Canvas's own pages.
// It's asked for the first time the box opens, then kept in the page's
// localStorage so it opens with it at once on the next page, and asked for
// again once it's old.

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
const SELF = '/api/v1/users/self';
const DAY = 24 * 60 * 60 * 1000;
// work due this soon is listed before anything is typed
const SOON = 7 * DAY;

/** Canvas's own pages: all there is to list until the rest is loaded. */
export const CANVAS_PAGES: Entry[] = [
  { title: 'Dashboard', href: '/', kind: 'section' },
  { title: 'Calendar', href: '/calendar', kind: 'section' },
  { title: 'Inbox', href: '/conversations', kind: 'section' },
  { title: 'All courses', href: '/courses', kind: 'section' },
  { title: 'All grades', href: '/grades', kind: 'section' },
  { title: 'All groups', href: '/groups', kind: 'section' },
  { title: 'Account settings', href: '/profile/settings', kind: 'section' },
  { title: 'Notifications', href: '/profile/communication', kind: 'section' },
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
 * first, the groups, each course's pages, the rest of their assignments and
 * their module items, their posts, newest first, the courses whose term is
 * over, and Canvas's own pages. Links only ever go to this site.
 */
export function searchEntries(
  {
    courses,
    groups,
    colors,
    works,
    assignments,
    moduleItems,
    posts,
  }: SearchSources,
  now: Date,
): Entry[] {
  const entryOf = (course: SearchCourse): Entry => ({
    title: courseLabel(course),
    href: `/courses/${course.id}`,
    kind: 'course',
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
  // the To Do's work is found by its assignment's description, and is a quiz
  // when its assignment is
  const assignmentsById = new Map(assignments.map((a) => [a.id, a]));

  return [
    ...current.map(({ entry }) => ({ ...entry, start: true })),
    ...workEntries(todo, inCourse, assignmentsById, now),
    ...currentGroups(
      groups,
      current.map(({ course }) => course),
    ).map(({ id, name, course_id }): Entry => ({
      title: name,
      href: `/groups/${id}`,
      kind: 'group',
      ...inCourse(course_id),
    })),
    ...current.flatMap(({ course, entry }) => pageEntries(course, entry)),
    ...courseWorkEntries(
      assignments.filter(({ id }) => !inToDo.has(id)),
      moduleItems,
      inCourse,
      now.getTime(),
    ),
    ...posts.map((post) => postEntry(post, inCourse)),
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
function workEntries(
  todo: Work[],
  inCourse: InCourse,
  assignments: Map<string, CourseAssignment>,
  now: Date,
): Entry[] {
  return todo
    .toSorted((a, b) => a.due.getTime() - b.due.getTime())
    .flatMap(({ title, url, due, courseId, courseName, target }) => {
      // the user's own notes have no page
      if (url === undefined) return [];
      const { where, color } = inCourse(courseId);
      const assignment =
        target.plannable_type === 'assignment'
          ? assignments.get(target.plannable_id)
          : undefined;
      return {
        title,
        href: url,
        kind: assignment?.kind ?? workKind(target.plannable_type),
        where: where ?? courseName,
        color,
        due: due.toISOString(),
        // the To Do lists only what's left to do
        pending: true,
        start: due.getTime() - now.getTime() < SOON,
        text: assignment?.text,
      };
    });
}

// What the planner calls it, for work not among the course's assignments:
// ungraded quizzes and discussions, pages with a to-do date and peer reviews.
function workKind(plannableType: string): Kind {
  switch (plannableType) {
    case 'quiz':
      return 'quiz';
    case 'discussion_topic':
      return 'discussion';
    case 'wiki_page':
      return 'page';
    default:
      return 'assignment';
  }
}

// The course's menu, but its home page, which the course's own entry stands
// for, and what only teachers see.
function pageEntries(
  course: SearchCourse,
  { title, also, color }: Entry,
): Entry[] {
  return (course.tabs ?? [])
    .filter(({ id, hidden }) => id !== 'home' && hidden !== true)
    .map(({ label, html_url }) => ({
      title: label,
      href: html_url,
      kind: 'section',
      where: title,
      also,
      color,
    }));
}

// The assignments and module items: what's coming up, soonest first, then
// what's past, latest first, then what has no due date, which is every module
// item, newest first.
function courseWorkEntries(
  assignments: CourseAssignment[],
  moduleItems: ModuleItem[],
  inCourse: InCourse,
  now: number,
): Entry[] {
  // NaN for no due date, which is neither coming up nor past
  const dueAt = ({ due }: CourseAssignment) => Date.parse(due ?? '');
  const upcoming = assignments.filter((a) => dueAt(a) >= now);
  const past = assignments.filter((a) => dueAt(a) < now);
  // each entry with the date it's sorted by
  const undated = [
    ...assignments
      .filter(({ due }) => due === undefined)
      .map((assignment) => ({
        available: assignment.available,
        entry: assignmentEntry(assignment, inCourse),
      })),
    ...moduleItems.map((item) => ({
      available: item.available,
      entry: moduleItemEntry(item, inCourse),
    })),
  ];
  return [
    ...upcoming.sort((a, b) => dueAt(a) - dueAt(b)),
    ...past.sort((a, b) => dueAt(b) - dueAt(a)),
  ]
    .map((assignment) => assignmentEntry(assignment, inCourse))
    .concat(newestFirst(undated).map(({ entry }) => entry));
}

// By when each became available. On a tie, or with no date, what comes later
// goes first: a course's later modules are its newer ones, and a course
// copied from another term gives everything nearly the same date.
function newestFirst<T extends { available?: string }>(items: T[]): T[] {
  const at = ({ available }: T) =>
    available === undefined ? 0 : Date.parse(available);
  return items.toReversed().sort((a, b) => at(b) - at(a));
}

function assignmentEntry(
  { name, url, kind, due, pending, courseId, text }: CourseAssignment,
  inCourse: InCourse,
): Entry {
  return {
    title: name,
    href: url,
    kind,
    due,
    pending,
    text,
    ...inCourse(courseId),
  };
}

function moduleItemEntry(
  { title, url, kind, module, courseId, text }: ModuleItem,
  inCourse: InCourse,
): Entry {
  return {
    title,
    href: url,
    kind,
    // so "week 3 reading" finds that reading
    also: [module],
    text,
    ...inCourse(courseId),
  };
}

// Found by what it says too, and by what it is: plural, so "announcement" and
// "announcements" both list them.
function postEntry(
  { kind, title, url, posted, text, courseId }: CoursePost,
  inCourse: InCourse,
): Entry {
  return {
    title,
    href: url,
    kind,
    also: [`${kind}s`],
    posted,
    text,
    ...inCourse(courseId),
  };
}

// a path on this site, never another site or a script
const onThisSite = (href: string) => /^\/(?![/\\])/.test(href);

// The courses and who the user is, then the assignments and module items in
// the current courses: they're asked for by course, with the user's own
// submissions. The pages' text is saved for `who`.
async function loadCoursesAndItems(
  who: string,
): Promise<Pick<SearchSources, 'courses' | keyof CourseItems> | undefined> {
  const [courses, self] = await Promise.all([
    canvasJson<SearchCourse[]>(COURSES),
    canvasJson<{ id: string }>(SELF),
  ]);
  if (!courses || !self) return undefined;
  const current = courses.filter(isCurrent).map(({ id }) => id);
  return { courses, ...(await loadCourseItems(who, self.id, current)) };
}

/** Undefined when the courses can't be loaded; what's saved stays. */
export async function fetchEntries(who: string): Promise<Entry[] | undefined> {
  const [courses, groups, colors, works] = await Promise.all([
    loadCoursesAndItems(who),
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
