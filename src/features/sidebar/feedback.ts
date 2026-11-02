import { canvasJson } from '@/core/canvas-api';

// Canvas's Recent Feedback, read from the list its server already sent with
// the page (each row a graded or commented assignment), then put newest
// feedback first. Canvas's own order goes by a row's latest comment, or
// without one by when the assignment was made, so an exam graded today can
// sit below work graded weeks ago.

export interface Feedback {
  title: string;
  url: string;
  courseId?: string;
  assignmentId?: string;
  // the course code Canvas shows on some rows
  course?: string;
  score?: string;
  comment?: string;
}

/** Every row of Canvas's list, including the ones it hides behind "more". */
export function readFeedback(list: Element): Feedback[] {
  const rows: Feedback[] = [];
  for (const link of list.querySelectorAll<HTMLAnchorElement>(
    'li.event > a.recent_feedback_icon',
  )) {
    const url = link.getAttribute('href');
    const title = text(link.querySelector('.recent_feedback_title'));
    if (!url || !title) continue;
    let score: string | undefined;
    let comment: string | undefined;
    for (const p of link.querySelectorAll('.event-details > p')) {
      if (p.classList.contains('event-details__context')) continue;
      if (p.querySelector('strong')) score = shortScore(text(p));
      else comment = text(p) || undefined;
    }
    rows.push({
      title,
      url,
      courseId: /\/courses\/(\d+)/.exec(url)?.[1],
      assignmentId: /\/assignments\/(\d+)/.exec(url)?.[1],
      course: text(link.querySelector('.event-details__context')) || undefined,
      score,
      comment,
    });
  }
  return rows;
}

const text = (element: Element | null) =>
  element?.textContent.replace(/\s+/g, ' ').trim() ?? '';

/** "95 out of 100" as "95/100"; a letter or word grade as it is. */
export function shortScore(score: string): string {
  return score.replace(/^(\S+) out of (\S+)$/, '$1/$2');
}

// The parts of GET /api/v1/courses/:id/students/submissions that are used,
// with ids as strings (canvasFetch asks for them).
export interface FeedbackSubmission {
  assignment_id: string;
  user_id: string;
  graded_at: string | null;
  // when the grade was shown to the student, which can be after grading
  posted_at: string | null;
  submission_comments: { author_id: string | null; created_at: string }[];
}

/**
 * The rows newest feedback first, or all in Canvas's order when a row's time
 * can't be had (a failed request, or a row that isn't an assignment).
 */
export async function sortFeedback(rows: Feedback[]): Promise<Feedback[]> {
  return byTime(rows, await loadTimes(rows));
}

/**
 * The rows newest first by `times` (by assignment id), or as they are when
 * one has no time.
 */
export function byTime(
  rows: Feedback[],
  times: Map<string, number>,
): Feedback[] {
  const timed: { row: Feedback; time: number }[] = [];
  for (const row of rows) {
    const id = row.assignmentId;
    const time = id === undefined ? undefined : times.get(id);
    if (time === undefined) return rows;
    timed.push({ row, time });
  }
  return timed.sort((a, b) => b.time - a.time).map(({ row }) => row);
}

/**
 * When the submission's latest feedback came: its grade, the grade being
 * posted, or a comment from someone other than the student. Undefined when
 * there's none.
 */
export function feedbackTime(
  submission: FeedbackSubmission,
): number | undefined {
  const comments = submission.submission_comments.filter(
    ({ author_id }) => author_id !== submission.user_id,
  );
  const times = [
    submission.graded_at,
    submission.posted_at,
    ...comments.map(({ created_at }) => created_at),
  ]
    .filter((time) => time !== null)
    .map(Date.parse);
  return times.length === 0 ? undefined : Math.max(...times);
}

// feedbackTime by assignment id, one request per course in the list; none for
// a course whose request fails.
async function loadTimes(rows: Feedback[]): Promise<Map<string, number>> {
  const byCourse = new Map<string, string[]>();
  for (const { courseId, assignmentId } of rows) {
    if (courseId === undefined || assignmentId === undefined) continue;
    const ids = byCourse.get(courseId);
    if (ids) ids.push(assignmentId);
    else byCourse.set(courseId, [assignmentId]);
  }
  const submissions = await Promise.all(
    [...byCourse].map(([course, ids]) => {
      // Canvas lists a few dozen rows at most, well within one page
      const query = new URLSearchParams({
        'student_ids[]': 'self',
        'include[]': 'submission_comments',
        per_page: '100',
      });
      for (const id of ids) query.append('assignment_ids[]', id);
      return canvasJson<FeedbackSubmission[]>(
        `/api/v1/courses/${course}/students/submissions?${query}`,
      ).then((s) => s ?? []);
    }),
  );
  const times = new Map<string, number>();
  for (const submission of submissions.flat()) {
    const time = feedbackTime(submission);
    if (time !== undefined) times.set(submission.assignment_id, time);
  }
  return times;
}
