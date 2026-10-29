import { describe, expect, it } from 'vitest';
import type { Work } from '@/core/planner';
import { dueLabel, todoGroups } from './todo';

// a Tuesday afternoon, local time
const NOW = new Date(2026, 9, 27, 16, 0);
const at = (day: number, hour = 23, minute = 59) =>
  new Date(2026, 9, day, hour, minute);

function work(title: string, due: Date, over: Partial<Work> = {}): Work {
  return {
    title,
    url: `/courses/1/assignments/${title}`,
    due,
    done: false,
    courseId: '1',
    target: { plannable_type: 'assignment', plannable_id: title },
    ...over,
  };
}

const summary = (works: Work[], courseId?: string) =>
  todoGroups(works, NOW, courseId).map(({ when, works }) => [
    when,
    works.map((w) => w.title),
  ]);

describe('todoGroups', () => {
  it('groups work by day, soonest first', () => {
    expect(
      summary([
        work('Essay', at(30)),
        work('Lab', at(27)),
        work('Missed', at(24)),
        work('Final', at(5 + 31)),
        work('Reading', at(28, 9)),
        work('Earlier today', at(27, 10)),
        work('Quiz', at(3 + 31)),
      ]),
    ).toEqual([
      ['Overdue', ['Missed', 'Earlier today']],
      ['Today', ['Lab']],
      ['Tomorrow', ['Reading']],
      ['This week', ['Essay']],
      ['Later', ['Quiz', 'Final']],
    ]);
  });

  it('leaves out work that is done or dismissed', () => {
    const override = { id: '1', marked_complete: false, dismissed: true };
    expect(
      summary([
        work('Handed in', at(28), { done: true }),
        work('Hidden', at(28), { override }),
        work('Lab', at(28)),
      ]),
    ).toEqual([['Tomorrow', ['Lab']]]);
  });

  it("lists only a course's own work on its pages", () => {
    expect(
      summary(
        [
          work('Lab', at(28)),
          work('Essay', at(28), { courseId: '2' }),
          work('Note', at(28), { courseId: undefined }),
        ],
        '2',
      ),
    ).toEqual([['Tomorrow', ['Essay']]]);
  });

  it('has nothing for nothing to do', () => {
    expect(summary([])).toEqual([]);
  });
});

describe('dueLabel', () => {
  it('says what the group does not', () => {
    const due = at(30, 23, 59);
    expect(dueLabel(due, 'Today', 'en-US')).toBe('11:59 PM');
    expect(dueLabel(due, 'This week', 'en-US')).toBe('Fri');
    expect(dueLabel(due, 'Overdue', 'en-US')).toBe('Oct 30');
    expect(dueLabel(due, 'Later', 'en-US')).toBe('Oct 30');
  });
});
