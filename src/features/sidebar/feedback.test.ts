// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  byTime,
  feedbackTime,
  readFeedback,
  shortScore,
  type Feedback,
  type FeedbackSubmission,
} from './feedback';

// Canvas's Recent Feedback rows as its server renders them
const row = (href: string, details: string, hidden = false) => `
  <li style="${hidden ? 'display: none;' : ''}" class="event">
    <a class="recent_feedback_icon" href="${href}">
      <i class="icon-check"></i>
      <div class="event-details">
        <b class="event-details__title recent_feedback_title">
          ${details.split('|')[0] ?? ''}
        </b>
        ${details.split('|').slice(1).join('')}
      </div>
      <div class="clear"></div>
    </a>
  </li>`;

function list(html: string): Element {
  const div = document.createElement('div');
  div.className = 'events_list recent_feedback';
  div.innerHTML = `<div class="h2 shared-space"><h2>Recent Feedback</h2></div>
    <ul class="right-side-list events">${html}
      <li><a href="#" class="more_link">at least 1 more in the past two weeks …</a></li>
    </ul>`;
  return div;
}

describe('readFeedback', () => {
  it('reads every row, hidden ones too', () => {
    const feedback = readFeedback(
      list(
        row(
          '/courses/53976/assignments/785885/submissions/286033',
          'Quiz - Secure Coding|<p class="event-details__context">CSDS 344</p>|<p><strong>1 out of 1</strong></p>',
        ) +
          row(
            '/courses/54559/assignments/776510',
            'Analytic Essay 2|<p><strong>95 out of 100</strong></p>|<p>"fantastic"</p>',
            true,
          ) +
          row(
            '/courses/54631/assignments/768783',
            'Reading Log|<p>"very good"</p>',
            true,
          ),
      ),
    );
    expect(feedback).toEqual([
      {
        title: 'Quiz - Secure Coding',
        url: '/courses/53976/assignments/785885/submissions/286033',
        courseId: '53976',
        assignmentId: '785885',
        course: 'CSDS 344',
        score: '1/1',
        comment: undefined,
      },
      {
        title: 'Analytic Essay 2',
        url: '/courses/54559/assignments/776510',
        courseId: '54559',
        assignmentId: '776510',
        course: undefined,
        score: '95/100',
        comment: '"fantastic"',
      },
      {
        title: 'Reading Log',
        url: '/courses/54631/assignments/768783',
        courseId: '54631',
        assignmentId: '768783',
        course: undefined,
        score: undefined,
        comment: '"very good"',
      },
    ]);
  });

  it('has nothing for an empty list', () => {
    expect(readFeedback(list(''))).toEqual([]);
  });
});

describe('shortScore', () => {
  it('shortens points and keeps grades', () => {
    expect(shortScore('69 out of 78')).toBe('69/78');
    expect(shortScore('4.8 out of 5')).toBe('4.8/5');
    expect(shortScore('A')).toBe('A');
    expect(shortScore('complete')).toBe('complete');
  });
});

function submission(
  over: Partial<FeedbackSubmission> = {},
): FeedbackSubmission {
  return {
    assignment_id: '10',
    user_id: '7',
    graded_at: null,
    posted_at: null,
    submission_comments: [],
    ...over,
  };
}

describe('feedbackTime', () => {
  it('is the latest of grading, posting and comments from others', () => {
    expect(
      feedbackTime(
        submission({
          graded_at: '2026-10-29T17:44:05Z',
          posted_at: '2026-10-29T17:47:12Z',
          submission_comments: [
            { author_id: '3', created_at: '2026-10-28T05:17:00Z' },
          ],
        }),
      ),
    ).toBe(Date.parse('2026-10-29T17:47:12Z'));
    expect(
      feedbackTime(
        submission({
          graded_at: '2026-10-16T17:34:00Z',
          submission_comments: [
            { author_id: '3', created_at: '2026-10-18T14:38:00Z' },
          ],
        }),
      ),
    ).toBe(Date.parse('2026-10-18T14:38:00Z'));
  });

  it("leaves out the student's own comments", () => {
    expect(
      feedbackTime(
        submission({
          graded_at: '2026-10-16T17:34:00Z',
          submission_comments: [
            { author_id: '7', created_at: '2026-10-20T09:00:00Z' },
          ],
        }),
      ),
    ).toBe(Date.parse('2026-10-16T17:34:00Z'));
  });

  it('has none without a grade or comment', () => {
    expect(feedbackTime(submission())).toBeUndefined();
  });
});

describe('byTime', () => {
  const row = (title: string, assignmentId?: string): Feedback => ({
    title,
    url: `/courses/1/assignments/${assignmentId ?? 'x'}`,
    courseId: '1',
    assignmentId,
  });

  it('puts the newest feedback first', () => {
    const rows = [row('Quiz', '1'), row('Essay', '2'), row('Midterm', '3')];
    const times = new Map([
      ['1', 300],
      ['2', 100],
      ['3', 500],
    ]);
    expect(byTime(rows, times).map((r) => r.title)).toEqual([
      'Midterm',
      'Quiz',
      'Essay',
    ]);
  });

  it("keeps Canvas's order when a row has no time", () => {
    const rows = [row('Quiz', '1'), row('Essay', '2'), row('Page')];
    const times = new Map([
      ['1', 100],
      ['2', 300],
    ]);
    expect(byTime(rows, times)).toBe(rows);
  });
});
