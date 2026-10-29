// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { readFeedback, shortScore } from './feedback';

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
        course: 'CSDS 344',
        score: '1/1',
        comment: undefined,
      },
      {
        title: 'Analytic Essay 2',
        url: '/courses/54559/assignments/776510',
        courseId: '54559',
        course: undefined,
        score: '95/100',
        comment: '"fantastic"',
      },
      {
        title: 'Reading Log',
        url: '/courses/54631/assignments/768783',
        courseId: '54631',
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
