import { canvasFetch, canvasJson } from './canvas-api';

// Course work from Canvas's planner API, shared by everything that lists it
// (the dashboard cards, the sidebar's To Do), so a page asks for it once and
// checking work off in one place is seen in the others.

// The parts of GET /api/v1/planner/items that are used, with ids as strings
// (canvasFetch asks for them). Canvas sends `submissions: false` for work with
// nothing to submit (ungraded quizzes, pages with a to-do date).
export interface PlannerItem {
  course_id?: string;
  // the course's full name, or the user's for their own notes
  context_name?: string;
  plannable_id: string;
  plannable_type: string;
  plannable_date: string;
  plannable: {
    title: string;
    assignment_id?: string;
    // peer reviews (assessment_request) only
    workflow_state?: string;
  };
  html_url?: string;
  submissions:
    | false
    | {
        submitted: boolean;
        redo_request: boolean;
        graded?: boolean;
        excused?: boolean;
      };
  planner_override: Override | null;
}

// A user's own completion of a planner item (POST/PUT
// /api/v1/planner/overrides).
export interface Override {
  id: string;
  marked_complete: boolean;
  dismissed: boolean;
}

/** Something the user has to do. */
export interface Work {
  title: string;
  // none for the user's own notes, which have no page
  url?: string;
  due: Date;
  done: boolean;
  courseId?: string;
  courseName?: string;
  // what an override marks done: graded quizzes and discussions are marked
  // through their assignment, as Canvas's own planner does
  target: { plannable_type: string; plannable_id: string };
  override?: Override;
}

// Announcements and events have nothing to finish.
const SKIPPED = new Set(['announcement', 'calendar_event']);

/** The item as work, or undefined when there's nothing to do. */
export function toWork(item: PlannerItem): Work | undefined {
  if (SKIPPED.has(item.plannable_type)) return undefined;
  const assignment = item.plannable.assignment_id;
  return {
    title: item.plannable.title,
    url: item.plannable_type === 'planner_note' ? undefined : item.html_url,
    due: new Date(item.plannable_date),
    done: isComplete(item),
    courseId: item.course_id,
    courseName: item.context_name,
    target:
      assignment == null
        ? {
            plannable_type: item.plannable_type,
            plannable_id: item.plannable_id,
          }
        : { plannable_type: 'assignment', plannable_id: assignment },
    override: item.planner_override ?? undefined,
  };
}

// Canvas's own planner rule (isComplete in ui/shared/planner): the user's
// override wins both ways, else a peer review is done once completed and
// other work once submitted, unless the teacher asked for it again. Past
// Canvas: work the teacher graded or excused is done too, since there's
// nothing left to hand in (an exam taken on paper is never "submitted").
function isComplete(item: PlannerItem): boolean {
  const { planner_override, plannable, submissions } = item;
  if (planner_override) return planner_override.marked_complete;
  if (item.plannable_type === 'assessment_request') {
    return plannable.workflow_state === 'completed';
  }
  if (!submissions || submissions.redo_request) return false;
  return (
    submissions.submitted ||
    submissions.graded === true ||
    submissions.excused === true
  );
}

// Overdue work is listed this long, as Canvas's To Do sidebar has it, and
// upcoming work as far ahead.
export const WINDOW_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

let works: Promise<Work[] | undefined> | undefined;

/**
 * Work due from two weeks ago to two weeks ahead, asked for the first time
 * it's needed in a page. Undefined on a failed request; it's tried again on
 * the next page load.
 */
export function loadWorks(): Promise<Work[] | undefined> {
  return (works ??= fetchWorks());
}

async function fetchWorks(): Promise<Work[] | undefined> {
  const now = Date.now();
  const query = new URLSearchParams({
    start_date: new Date(now - WINDOW_DAYS * DAY).toISOString(),
    end_date: new Date(now + WINDOW_DAYS * DAY).toISOString(),
    per_page: '100',
  });
  const items: PlannerItem[] = [];
  try {
    // four weeks fits one page for nearly everyone; Canvas says where the
    // next one is in the Link header
    let next: string | undefined = `/api/v1/planner/items?${query}`;
    while (next) {
      const response = await canvasFetch(next);
      if (!response.ok) return undefined;
      items.push(...((await response.json()) as PlannerItem[]));
      next = nextPage(response.headers.get('Link'));
    }
  } catch {
    return undefined;
  }
  return items.map(toWork).filter((work) => work !== undefined);
}

function nextPage(link: string | null): string | undefined {
  const url = /<([^>]+)>;\s*rel="next"/.exec(link ?? '')?.[1];
  // only ever Canvas's own pages
  return url && new URL(url).origin === location.origin ? url : undefined;
}

// An override is created the first time and updated after that. Canvas resets
// `dismissed` (hidden from the To Do sidebar) when it isn't sent, so it's sent
// as it was.
export function saveOverride(
  work: Work,
  done: boolean,
): Promise<Override | undefined> {
  const { override } = work;
  return override
    ? canvasJson(`/api/v1/planner/overrides/${override.id}`, {
        method: 'PUT',
        json: { marked_complete: done, dismissed: override.dismissed },
      })
    : canvasJson('/api/v1/planner/overrides', {
        method: 'POST',
        json: { ...work.target, marked_complete: done },
      });
}
