import { canvasJson } from './canvas-api';

// The user's groups, asked for once per page by whatever lists them first (the
// sidebar, the search box).

// The parts of GET /api/v1/users/self/groups?include[]=can_access that are used.
export interface CanvasGroup {
  id: string;
  name: string;
  can_access?: boolean;
  concluded?: boolean;
  course_id?: string;
}

const GROUPS = '/api/v1/users/self/groups?include[]=can_access&per_page=100';

let groups: Promise<CanvasGroup[]> | undefined;

/** None on a failed request; they're tried again on the next page load. */
export function loadGroups(): Promise<CanvasGroup[]> {
  return (groups ??= canvasJson<CanvasGroup[]>(GROUPS).then((g) => g ?? []));
}

/**
 * Canvas's tray's rule (groups the user can open, whose course hasn't
 * concluded), but only those of the listed courses: courses often stay open
 * after their term, so the tray fills with old project groups. Groups of no
 * course (clubs, say) stay.
 */
export function currentGroups(
  groups: CanvasGroup[],
  courses: { id: string }[],
): CanvasGroup[] {
  const listed = new Set(courses.map(({ id }) => id));
  return groups.filter(
    ({ can_access, concluded, course_id }) =>
      can_access === true &&
      concluded !== true &&
      (course_id === undefined || listed.has(course_id)),
  );
}
