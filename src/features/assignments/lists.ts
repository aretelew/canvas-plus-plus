import type { Work } from '@/core/planner';

export const PER_CARD = 4;

/**
 * Each course's list for its card: work it hasn't finished that's past due,
 * then everything due from `now` on, done or not, soonest first, up to
 * PER_CARD. The user's own notes are left out: they have no page to open.
 */
export function cardLists(works: Work[], now: Date): Map<string, Work[]> {
  const lists = new Map<string, Work[]>();
  const listed = works
    .filter((work) => work.url !== undefined && (!work.done || work.due >= now))
    .sort((a, b) => a.due.getTime() - b.due.getTime());
  for (const work of listed) {
    const course = work.courseId;
    if (course === undefined) continue;
    const list = lists.get(course);
    if (!list) lists.set(course, [work]);
    else if (list.length < PER_CARD) list.push(work);
  }
  return lists;
}
