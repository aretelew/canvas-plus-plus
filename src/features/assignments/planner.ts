// The parts of GET /api/v1/planner/items that the card lists use, with ids as
// strings (canvasFetch asks for them). Canvas sends `submissions: false` for work with nothing to submit (ungraded quizzes,
// pages with a to-do date).
export interface PlannerItem {
  course_id?: string;
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
  submissions: false | { submitted: boolean; redo_request: boolean };
  planner_override: Override | null;
}

// A user's own completion of a planner item (POST/PUT
// /api/v1/planner/overrides).
export interface Override {
  id: string;
  marked_complete: boolean;
  dismissed: boolean;
}

/** One row of a card's list. */
export interface Work {
  title: string;
  url: string;
  due: Date;
  done: boolean;
  // what an override marks done: graded quizzes and discussions are marked
  // through their assignment, as Canvas's own planner does
  target: { plannable_type: string; plannable_id: string };
  override?: Override;
}

// Course work only: announcements and events have nothing to finish, and
// notes are the user's own (and have no page to open).
const SKIPPED = new Set(['announcement', 'calendar_event', 'planner_note']);

type Listable = PlannerItem & { course_id: string; html_url: string };

const isListable = (item: PlannerItem): item is Listable =>
  item.course_id != null &&
  item.html_url !== undefined &&
  !SKIPPED.has(item.plannable_type);

export const PER_CARD = 4;

/**
 * Each course's list for its card: work it hasn't finished that's past due,
 * then everything due from `now` on, done or not, soonest first, up to
 * PER_CARD.
 */
export function cardLists(
  items: PlannerItem[],
  now: Date,
): Map<string, Work[]> {
  const lists = new Map<string, Work[]>();
  const listed = items
    .filter(isListable)
    .map((item) => ({ course: item.course_id, work: toWork(item) }))
    .filter(({ work }) => !work.done || work.due >= now)
    .sort((a, b) => a.work.due.getTime() - b.work.due.getTime());
  for (const { course, work } of listed) {
    const list = lists.get(course);
    if (!list) lists.set(course, [work]);
    else if (list.length < PER_CARD) list.push(work);
  }
  return lists;
}

function toWork(item: Listable): Work {
  const assignment = item.plannable.assignment_id;
  return {
    title: item.plannable.title,
    url: item.html_url,
    due: new Date(item.plannable_date),
    done: isComplete(item),
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
// other work once submitted, unless the teacher asked for it again.
function isComplete(item: PlannerItem): boolean {
  const { planner_override, plannable, submissions } = item;
  if (planner_override) return planner_override.marked_complete;
  if (item.plannable_type === 'assessment_request') {
    return plannable.workflow_state === 'completed';
  }
  return submissions
    ? submissions.submitted && !submissions.redo_request
    : false;
}
