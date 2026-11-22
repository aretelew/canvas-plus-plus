import { describe, expect, it } from 'vitest';
import type { Work } from '@/core/planner';
import {
  type Due,
  nextReminder,
  noticeText,
  remind,
  type Reminders,
  sitesToRefresh,
  upcoming,
} from './schedule';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const SITE = 'https://school.instructure.com';
// local time, as the browser's
const NOW = new Date(2026, 10, 19, 12, 0).getTime();

function due(over: Partial<Due> = {}): Due {
  return {
    id: 'assignment/10',
    title: 'Assignment - Shell',
    url: '/courses/1/assignments/10',
    course: 'Intro to Operating Systems',
    due: NOW + 3 * DAY,
    ...over,
  };
}

const state = (works: Due[], sent: Reminders['sent'] = {}): Reminders => ({
  sites: { [SITE]: { at: NOW, works } },
  sent,
});

describe('upcoming', () => {
  const work = (over: Partial<Work>): Work => ({
    title: 'Quiz 3',
    url: '/courses/1/quizzes/77',
    due: new Date(NOW + HOUR),
    done: false,
    courseName: 'Intro to Operating Systems',
    target: { plannable_type: 'assignment', plannable_id: '12' },
    ...over,
  });

  it('keeps the work still to do', () => {
    expect(
      upcoming(
        [work({}), work({ done: true }), work({ due: new Date(NOW - MINUTE) })],
        NOW,
      ),
    ).toEqual([
      {
        id: 'assignment/12',
        title: 'Quiz 3',
        url: '/courses/1/quizzes/77',
        course: 'Intro to Operating Systems',
        due: NOW + HOUR,
      },
    ]);
  });
});

describe('remind', () => {
  it('says nothing until a day before', () => {
    const { notices } = remind(state([due({ due: NOW + DAY + MINUTE })]), NOW);
    expect(notices).toEqual([]);
  });

  it('reminds a day before, then an hour before, once each', () => {
    const work = due({ due: NOW + DAY });
    const day = remind(state([work]), NOW);
    expect(day.notices).toEqual([{ origin: SITE, works: [work] }]);
    expect(remind(day.state, NOW + HOUR).notices).toEqual([]);
    const hour = remind(day.state, NOW + 23 * HOUR);
    expect(hour.notices).toEqual([{ origin: SITE, works: [work] }]);
    expect(remind(hour.state, NOW + 23 * HOUR + MINUTE).notices).toEqual([]);
  });

  it('gives only the hour reminder once that close', () => {
    // the browser was closed through the day reminder
    const work = due({ due: NOW + 30 * MINUTE });
    const first = remind(state([work]), NOW);
    expect(first.notices).toHaveLength(1);
    expect(remind(first.state, NOW + MINUTE).notices).toEqual([]);
  });

  it('says nothing of work past due', () => {
    const { notices, state: next } = remind(
      state([due({ due: NOW - MINUTE })]),
      NOW,
    );
    expect(notices).toEqual([]);
    expect(next.sites[SITE]?.works).toEqual([]);
  });

  it('reminds again of work whose due date moved', () => {
    const work = due({ due: NOW + HOUR });
    const { state: sent } = remind(state([work]), NOW);
    const moved = {
      ...sent,
      sites: state([{ ...work, due: NOW + 2 * HOUR }]).sites,
    };
    expect(remind(moved, NOW).notices).toHaveLength(1);
  });

  it("puts a site's reminders in one notice", () => {
    const works = [due({ id: 'a' }), due({ id: 'b' })].map((work) => ({
      ...work,
      due: NOW + HOUR,
    }));
    expect(remind(state(works), NOW).notices).toEqual([
      { origin: SITE, works },
    ]);
  });

  it('forgets what was sent once its work is past due', () => {
    const work = due({ due: NOW + HOUR });
    const { state: sent } = remind(state([work]), NOW);
    expect(Object.keys(sent.sent)).not.toEqual([]);
    expect(remind(sent, NOW + HOUR).state.sent).toEqual({});
  });

  it('forgets a site gone quiet with nothing due', () => {
    const quiet: Reminders = {
      sites: { [SITE]: { at: NOW - 15 * DAY, works: [] } },
      sent: {},
    };
    expect(remind(quiet, NOW).state.sites).toEqual({});
    const recent = { ...quiet, sites: { [SITE]: { at: NOW, works: [] } } };
    expect(remind(recent, NOW).state.sites).toEqual(recent.sites);
  });
});

describe('sitesToRefresh', () => {
  const other = 'https://canvas.case.edu';
  // listed 20 minutes ago
  const listed = (at = NOW - 20 * MINUTE): Reminders => ({
    sites: {
      [SITE]: { at, works: [due({ due: NOW + HOUR })] },
      [other]: { at, works: [due()] },
    },
    sent: {},
  });

  it('lists the sites with a reminder to give now', () => {
    expect(sitesToRefresh(listed(), NOW)).toEqual([SITE]);
    expect(sitesToRefresh(remind(listed(), NOW).state, NOW)).toEqual([]);
  });

  it('leaves out a site listed in the last 10 minutes', () => {
    expect(sitesToRefresh(listed(NOW - 5 * MINUTE), NOW)).toEqual([]);
  });
});

describe('nextReminder', () => {
  it('is the soonest reminder still to come', () => {
    const works = [due({ due: NOW + 3 * DAY }), due({ due: NOW + 2 * HOUR })];
    expect(nextReminder(state(works), NOW)).toBe(NOW + HOUR);
    expect(nextReminder(state(works), NOW + HOUR)).toBe(NOW + 2 * DAY);
  });

  it('is none with nothing to come', () => {
    expect(nextReminder(state([due({ due: NOW + MINUTE })]), NOW)).toBe(
      undefined,
    );
    expect(nextReminder(state([]), NOW)).toBe(undefined);
  });
});

describe('noticeText', () => {
  const tonight = new Date(2026, 10, 19, 23, 59).getTime();
  const tomorrow = new Date(2026, 10, 20, 9, 0).getTime();

  it("names one work, when it's due and its course, and opens its page", () => {
    expect(
      noticeText(
        { origin: SITE, works: [due({ due: tonight })] },
        NOW,
        'en-US',
      ),
    ).toEqual({
      title: 'Assignment - Shell',
      message: 'Due today at 11:59 PM · Intro to Operating Systems',
      url: `${SITE}/courses/1/assignments/10`,
    });
  });

  it('opens the dashboard for a note, which has no page', () => {
    const note = due({ due: tomorrow, url: undefined, course: undefined });
    expect(noticeText({ origin: SITE, works: [note] }, NOW, 'en-US')).toEqual({
      title: 'Assignment - Shell',
      message: 'Due tomorrow at 9:00 AM',
      url: `${SITE}/`,
    });
  });

  it("opens no page off the work's site", () => {
    const away = due({ url: 'https://example.com/' });
    expect(noticeText({ origin: SITE, works: [away] }, NOW).url).toBe(
      `${SITE}/`,
    );
  });

  it('lists several, soonest first', () => {
    const works = [
      due({ title: 'Lab 4', due: tomorrow }),
      due({ title: 'Quiz 3', due: tonight }),
    ];
    expect(noticeText({ origin: SITE, works }, NOW, 'en-US')).toEqual({
      title: '2 assignments due soon',
      message: 'Quiz 3 due today at 11:59 PM\nLab 4 due tomorrow at 9:00 AM',
      url: `${SITE}/`,
    });
  });

  it('names three, and past that two with a count of the rest', () => {
    const works = (count: number) =>
      Array.from({ length: count }, (_, i) =>
        due({ title: `Lab ${String(i + 1)}`, due: tonight + i * MINUTE }),
      );
    const named = (count: number) =>
      noticeText({ origin: SITE, works: works(count) }, NOW, 'en-US')
        .message.split('\n')
        .map((line) => line.split(' due ')[0]);
    expect(named(3)).toEqual(['Lab 1', 'Lab 2', 'Lab 3']);
    expect(named(5)).toEqual(['Lab 1', 'Lab 2', 'and 3 more']);
  });
});
