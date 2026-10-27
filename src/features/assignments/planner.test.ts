import { describe, expect, it } from 'vitest';
import { cardLists, PER_CARD, type PlannerItem, type Work } from './planner';

const NOW = new Date('2026-10-27T16:00:00Z');

function item(over: Partial<PlannerItem> = {}): PlannerItem {
  return {
    course_id: '1',
    plannable_id: '10',
    plannable_type: 'assignment',
    plannable_date: '2026-10-28T03:59:00Z',
    plannable: { title: 'Assignment - Shell' },
    html_url: '/courses/1/assignments/10',
    submissions: { submitted: false, redo_request: false },
    planner_override: null,
    ...over,
  };
}

// the one item's row, on course 1's card
function only(over: Partial<PlannerItem>): Work {
  const [work] = cardLists([item(over)], NOW).get('1') ?? [];
  if (!work) throw new Error('not listed');
  return work;
}

const titles = (items: PlannerItem[]) =>
  Object.fromEntries(
    [...cardLists(items, NOW)].map(([id, works]) => [
      id,
      works.map((w) => w.title),
    ]),
  );

describe('cardLists', () => {
  it('lists work by course, soonest first', () => {
    const lists = cardLists(
      [
        item({
          plannable: { title: 'Later' },
          plannable_date: '2026-11-05T00:00:00Z',
        }),
        item({ plannable: { title: 'Sooner' } }),
        item({ course_id: '2', plannable: { title: 'Midterm 2' } }),
      ],
      NOW,
    );
    expect(lists.get('1')?.map((w) => w.title)).toEqual(['Sooner', 'Later']);
    expect(lists.get('2')?.[0]).toMatchObject({
      title: 'Midterm 2',
      url: '/courses/1/assignments/10',
      due: new Date('2026-10-28T03:59:00Z'),
      done: false,
    });
  });

  it('keeps overdue work until it is done', () => {
    const past = '2026-10-23T14:10:00Z';
    expect(
      titles([
        item({ plannable: { title: 'Missed' }, plannable_date: past }),
        item({
          plannable: { title: 'Handed in' },
          plannable_date: past,
          submissions: { submitted: true, redo_request: false },
        }),
      ]),
    ).toEqual({ 1: ['Missed'] });
  });

  it('keeps upcoming work once it is done', () => {
    expect(
      only({ submissions: { submitted: true, redo_request: false } }).done,
    ).toBe(true);
  });

  it("decides done as Canvas's planner does", () => {
    const done = (over: Partial<PlannerItem>) => only(over).done;
    const override = { id: '5', marked_complete: false, dismissed: false };
    // the teacher asked for it again
    expect(done({ submissions: { submitted: true, redo_request: true } })).toBe(
      false,
    );
    // the user's own mark wins either way
    expect(
      done({
        submissions: { submitted: true, redo_request: false },
        planner_override: override,
      }),
    ).toBe(false);
    expect(
      done({ planner_override: { ...override, marked_complete: true } }),
    ).toBe(true);
    // nothing to submit, nothing marked
    expect(done({ plannable_type: 'quiz', submissions: false })).toBe(false);
    expect(
      done({
        plannable_type: 'assessment_request',
        submissions: false,
        plannable: { title: 'Peer review', workflow_state: 'completed' },
      }),
    ).toBe(true);
  });

  it('marks graded quizzes and discussions done through their assignment', () => {
    const quiz = only({
      plannable_type: 'quiz',
      plannable_id: '77',
      plannable: { title: 'Quiz 3', assignment_id: '12' },
    }).target;
    const page = only({
      plannable_type: 'wiki_page',
      plannable_id: '8',
    }).target;
    expect(quiz).toEqual({ plannable_type: 'assignment', plannable_id: '12' });
    expect(page).toEqual({ plannable_type: 'wiki_page', plannable_id: '8' });
  });

  it('skips what has nothing to finish', () => {
    expect(
      titles([
        item({ plannable_type: 'announcement' }),
        item({ plannable_type: 'calendar_event' }),
        item({ plannable_type: 'planner_note' }),
        // a note or event of the user's own, in no course
        item({ course_id: undefined }),
        // nothing to open
        item({ html_url: undefined }),
      ]),
    ).toEqual({});
  });

  it('shows at most PER_CARD per card, the soonest', () => {
    const many = Array.from({ length: PER_CARD + 2 }, (_, i) =>
      item({
        plannable: { title: `Lab ${String(i)}` },
        plannable_date: new Date(
          NOW.getTime() + (i + 1) * 86_400_000,
        ).toISOString(),
      }),
    );
    const list = cardLists(many, NOW).get('1') ?? [];
    expect(list).toHaveLength(PER_CARD);
    expect(list.at(-1)?.title).toBe(`Lab ${String(PER_CARD - 1)}`);
  });
});
