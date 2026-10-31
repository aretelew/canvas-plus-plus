import { loadCourseColors, loadCourses } from '@/core/courses';
import { doneCheck } from '@/core/done-check';
import { readMirror, writeMirror } from '@/core/page-mirror';
import { loadUnreadAnnouncements, loadWorks, type Work } from '@/core/planner';
import { readFeedback, type Feedback } from './feedback';
import { tidySidebar } from './storage';
import { dueLabel, todoGroups, type Group, type When } from './todo';

// Replaces the To Do and Recent Feedback lists in Canvas's right sidebar (the
// dashboard's and a course home's) with two of our own in one style: each row
// a title, its course's code and color, and on the right when it's due or its
// score. To Do lists only work to do, from Canvas's planner API
// (core/planner.ts); Canvas's own fills up with announcements. A course's
// page has a line under it for the unread ones instead, since it has no badge
// for them like the course's dashboard card. Feedback is read from Canvas's
// list, already in the page.
//
// While on, `html[data-cpp-sidebar]` hides Canvas's lists (sidebar.css). A
// copy of the setting in the page's localStorage sets it before the first
// paint, so Canvas's lists don't show for a moment on every page load.

const MIRROR_KEY = 'canvas++:tidy-sidebar';
// on Canvas's list when ours can't be shown, so it shows instead
const KEEP = 'cpp-keep';
// rows shown while the list is collapsed
const SHOWN_TODO = 7;
const SHOWN_FEEDBACK = 3;

interface CourseLabel {
  code?: string;
  color?: string;
}

// Fills in our section once what it lists has loaded: false when there's
// nothing to show, so Canvas's list shows instead. `course` is the course
// whose page this is.
type Fill = (
  section: HTMLElement,
  canvasList: Element,
  course: string | undefined,
) => Promise<boolean>;

// each of ours, and the list of Canvas's it takes the place of
const SECTIONS: {
  canvas: string;
  className: string;
  title: string;
  fill: Fill;
}[] = [
  {
    canvas: '.Sidebar__TodoListContainer',
    className: 'cpp-todo',
    title: 'To Do',
    fill: fillTodo,
  },
  {
    canvas: '.recent_feedback',
    className: 'cpp-feedback',
    title: 'Recent Feedback',
    fill: fillFeedback,
  },
];

export async function syncSidebar(): Promise<void> {
  // the sidebar is never in a frame
  if (window.top !== window) return;
  showAttribute(readMirror(MIRROR_KEY) !== undefined);
  let observer: MutationObserver | undefined;
  let enabled = false;

  const apply = (on: boolean) => {
    enabled = on;
    showAttribute(on);
    observer?.disconnect();
    observer = undefined;
    for (const added of document.querySelectorAll('.cpp-sidebar')) {
      added.remove();
    }
    for (const kept of document.querySelectorAll(`.${KEEP}`)) {
      kept.classList.remove(KEEP);
    }
    if (on) whenParsed(start);
  };

  // The dashboard's sidebar comes in a request after the page loads, and
  // Canvas draws its To Do with React after that: watch the sidebar for them.
  const start = () => {
    const sidebar = document.getElementById('right-side');
    if (!enabled || observer || !sidebar) return;
    observer = new MutationObserver(() => {
      decorate(sidebar);
    });
    observer.observe(sidebar, { childList: true, subtree: true });
    decorate(sidebar);
  };

  apply(await tidySidebar.getValue());
  tidySidebar.watch(apply);
}

function showAttribute(on: boolean): void {
  const root = document.documentElement;
  if (on) root.dataset.cppSidebar = '';
  else delete root.dataset.cppSidebar;
  writeMirror(MIRROR_KEY, on ? '1' : undefined);
}

function whenParsed(run: () => void): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else run();
}

function decorate(sidebar: HTMLElement): void {
  for (const { canvas, className, title, fill } of SECTIONS) {
    const canvasList = sidebar.querySelector(canvas);
    if (
      !canvasList ||
      canvasList.classList.contains(KEEP) ||
      sidebar.querySelector(`.${className}`)
    ) {
      continue;
    }
    void replace(canvasList, sectionOf(className, title), fill);
  }
}

// Ours goes in Canvas's list's place at once, its heading showing while its
// rows load.
async function replace(
  canvasList: Element,
  section: HTMLElement,
  fill: Fill,
): Promise<void> {
  canvasList.before(section);
  const course = /^\/courses\/(\d+)/.exec(location.pathname)?.[1];
  const filled = await fill(section, canvasList, course);
  // turned off, or Canvas drew the sidebar again, while they loaded
  if (filled || !section.isConnected) return;
  section.remove();
  canvasList.classList.add(KEEP);
}

// Work to do, from the planner; none when it can't be loaded. A course's own
// pages list only its work, without course labels.
async function fillTodo(
  section: HTMLElement,
  _canvasList: Element,
  course: string | undefined,
): Promise<boolean> {
  const [works, labels] = await Promise.all([
    loadWorks(),
    course ? undefined : courseLabels(),
  ]);
  if (!works) return false;
  addWork(section, todoGroups(works, new Date(), course), labels);
  const line = course && (await announcementsLine(course));
  if (line) section.append(line);
  return true;
}

// A link to the course's announcements while it has unread ones.
async function announcementsLine(
  course: string,
): Promise<HTMLElement | undefined> {
  const unread = await loadUnreadAnnouncements(course);
  if (unread === 0) return undefined;
  const link = document.createElement('a');
  link.className = 'cpp-announcements';
  link.href = `/courses/${course}/announcements`;
  link.textContent = `${String(unread)} new announcement${unread === 1 ? '' : 's'}`;
  return link;
}

function addWork(
  section: HTMLElement,
  groups: Group[],
  labels: Map<string, CourseLabel> | undefined,
): void {
  if (groups.length === 0) {
    const none = document.createElement('p');
    none.textContent = 'Nothing due in the next two weeks';
    section.append(none);
    return;
  }
  // work checked off since, here or on its card, stays (struck through, so a
  // slip can be undone) but leaves the count
  const count = document.createElement('span');
  count.className = 'cpp-count';
  const recount = () => {
    count.textContent = String(
      section.querySelectorAll('li:not(.cpp-done)').length,
    );
  };
  section.querySelector('h2')?.append(count);

  const locale = document.documentElement.lang || undefined;
  // past the first SHOWN_TODO rows: the rest of a group's, then whole groups
  const hidden: HTMLElement[] = [];
  let room = SHOWN_TODO;
  let total = 0;
  for (const { when, works } of groups) {
    const heading = document.createElement('h3');
    heading.textContent = when;
    if (when === 'Overdue') heading.className = 'cpp-overdue';
    const rows = works.map((work) =>
      todoRow(work, when, locale, labels, recount),
    );
    const list = document.createElement('ul');
    list.append(...rows);
    const group = document.createElement('div');
    group.append(heading, list);
    section.append(group);
    if (room === 0) hidden.push(group);
    else hidden.push(...rows.slice(room));
    room = Math.max(0, room - rows.length);
    total += rows.length;
  }
  recount();
  const more = showMore(hidden, total - SHOWN_TODO);
  if (more) section.append(more);
}

function todoRow(
  work: Work,
  when: When,
  locale: string | undefined,
  labels: Map<string, CourseLabel> | undefined,
  onChange: () => void,
): HTMLLIElement {
  const li = document.createElement('li');
  const check = doneCheck(work, (done) => {
    li.classList.toggle('cpp-done', done);
    onChange();
  });
  const date = document.createElement('time');
  date.className = 'cpp-value';
  date.dateTime = work.due.toISOString();
  date.title = work.due.toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  date.textContent = dueLabel(work.due, when, locale);
  if (when === 'Overdue') date.classList.add('cpp-overdue');
  const course = courseLine(labels, work.courseId, work.courseName);
  li.append(check, main(work.title, work.url, course), date);
  return li;
}

// Canvas's feedback, restyled; when it has none, its own list says so.
async function fillFeedback(
  section: HTMLElement,
  canvasList: Element,
  course: string | undefined,
): Promise<boolean> {
  const feedback = readFeedback(canvasList);
  if (feedback.length === 0) return false;
  const labels = course ? undefined : await courseLabels();
  const rows = feedback.map((row) => feedbackRow(row, labels));
  const list = document.createElement('ul');
  list.append(...rows);
  const footer = document.createElement('div');
  footer.className = 'cpp-footer';
  const more = showMore(
    rows.slice(SHOWN_FEEDBACK),
    rows.length - SHOWN_FEEDBACK,
  );
  if (more) footer.append(more);
  // in place of Canvas's View Grades button, on the dashboard
  if (!course) {
    const grades = document.createElement('a');
    grades.href = '/grades';
    grades.textContent = 'All grades';
    footer.append(grades);
  }
  section.append(list, footer);
  return true;
}

function feedbackRow(
  row: Feedback,
  labels: Map<string, CourseLabel> | undefined,
): HTMLLIElement {
  const li = document.createElement('li');
  const details = main(
    row.title,
    row.url,
    courseLine(labels, row.courseId, row.course),
  );
  if (row.comment) {
    const comment = document.createElement('p');
    comment.className = 'cpp-comment';
    comment.textContent = row.comment;
    details.append(comment);
  }
  li.append(details);
  if (row.score) {
    const score = document.createElement('span');
    score.className = 'cpp-value';
    score.textContent = row.score;
    li.append(score);
  }
  return li;
}

// The user's code for each course (or its name) and its color.
async function courseLabels(): Promise<Map<string, CourseLabel>> {
  const [courses, colors] = await Promise.all([
    loadCourses(),
    loadCourseColors(),
  ]);
  const labels = new Map<string, CourseLabel>();
  for (const [id, color] of colors) labels.set(id, { color });
  for (const { id, course_code, name } of courses) {
    labels.set(id, { ...labels.get(id), code: course_code || name });
  }
  return labels;
}

function sectionOf(className: string, title: string): HTMLElement {
  const section = document.createElement('section');
  section.className = `cpp-sidebar ${className}`;
  const heading = document.createElement('h2');
  heading.id = `${className}-heading`;
  heading.textContent = title;
  section.setAttribute('aria-labelledby', heading.id);
  section.append(heading);
  return section;
}

// The title, linked when it has a page, with its course under it.
function main(
  title: string,
  url: string | undefined,
  course: HTMLElement | undefined,
): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'cpp-main';
  const name = document.createElement(url ? 'a' : 'span');
  name.className = 'cpp-title';
  if (url) name.setAttribute('href', url);
  name.textContent = title;
  div.append(name);
  if (course) div.append(course);
  return div;
}

// The course's code and color, or without them (a failed request) what Canvas
// gave with the row. None without labels: on a course's own pages.
function courseLine(
  labels: Map<string, CourseLabel> | undefined,
  courseId: string | undefined,
  fallback: string | undefined,
): HTMLElement | undefined {
  if (!labels) return undefined;
  const label = courseId === undefined ? undefined : labels.get(courseId);
  const name = label?.code ?? fallback;
  if (!name) return undefined;
  const line = document.createElement('span');
  line.className = 'cpp-course';
  if (label?.color) {
    const dot = document.createElement('span');
    dot.className = 'cpp-dot';
    dot.style.backgroundColor = label.color;
    line.append(dot);
  }
  line.append(name);
  return line;
}

// "Show N more" for what's hidden, which shows it, then "Show less", which
// hides it again. Nothing when nothing is hidden.
function showMore(
  hidden: HTMLElement[],
  count: number,
): HTMLButtonElement | undefined {
  if (hidden.length === 0) return undefined;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cpp-more';
  const show = (expanded: boolean) => {
    for (const element of hidden) element.hidden = !expanded;
    button.setAttribute('aria-expanded', String(expanded));
    button.textContent = expanded ? 'Show less' : `Show ${String(count)} more`;
  };
  button.addEventListener('click', () => {
    show(button.getAttribute('aria-expanded') !== 'true');
  });
  show(false);
  return button;
}
