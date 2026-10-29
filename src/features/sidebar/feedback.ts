// Canvas's Recent Feedback, read from the list its server already sent with
// the page (each row a graded or commented assignment, newest first), so it
// costs no request of its own.

export interface Feedback {
  title: string;
  url: string;
  courseId?: string;
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
