import type { Work } from '@/core/planner';

// What the sidebar's To Do lists and how: unfinished work, grouped by when
// it's due, each with the date or time that matters for its group.

export type When = 'Overdue' | 'Today' | 'Tomorrow' | 'This week' | 'Later';

export interface Group {
  when: When;
  works: Work[];
}

/**
 * Work to do, soonest first in groups by day: what's past due, today,
 * tomorrow, the rest of the next seven days, then later. Done and dismissed
 * work is left out, and outside `courseId` when it's given (a course's own
 * page).
 */
export function todoGroups(
  works: Work[],
  now: Date,
  courseId?: string,
): Group[] {
  const groups = new Map<When, Work[]>();
  const todo = works
    .filter(
      (work) =>
        !work.done &&
        !work.override?.dismissed &&
        (courseId === undefined || work.courseId === courseId),
    )
    .sort((a, b) => a.due.getTime() - b.due.getTime());
  for (const work of todo) {
    const when = whenDue(work.due, now);
    const group = groups.get(when);
    if (group) group.push(work);
    else groups.set(when, [work]);
  }
  // sorted by date, so the groups came in order
  return [...groups].map(([when, works]) => ({ when, works }));
}

function whenDue(due: Date, now: Date): When {
  if (due < now) return 'Overdue';
  const days = Math.round(
    (startOfDay(due).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return 'This week';
  return 'Later';
}

// local midnight; rounding the days between two absorbs a DST hour
function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** The part of the due date its group doesn't already say. */
export function dueLabel(due: Date, when: When, locale?: string): string {
  switch (when) {
    case 'Today':
    case 'Tomorrow':
      return due.toLocaleTimeString(locale, {
        hour: 'numeric',
        minute: '2-digit',
      });
    case 'This week':
      return due.toLocaleDateString(locale, { weekday: 'short' });
    case 'Overdue':
    case 'Later':
      return due.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  }
}
