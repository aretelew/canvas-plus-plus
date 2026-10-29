import { describe, expect, it } from 'vitest';
import type { Work } from '@/core/planner';
import { cardLists, PER_CARD } from './lists';

const NOW = new Date('2026-10-27T16:00:00Z');

function work(over: Partial<Work> = {}): Work {
  return {
    title: 'Assignment - Shell',
    url: '/courses/1/assignments/10',
    due: new Date('2026-10-28T03:59:00Z'),
    done: false,
    courseId: '1',
    target: { plannable_type: 'assignment', plannable_id: '10' },
    ...over,
  };
}

const titles = (works: Work[]) =>
  Object.fromEntries(
    [...cardLists(works, NOW)].map(([id, list]) => [
      id,
      list.map((w) => w.title),
    ]),
  );

describe('cardLists', () => {
  it('lists work by course, soonest first', () => {
    expect(
      titles([
        work({ title: 'Later', due: new Date('2026-11-05T00:00:00Z') }),
        work({ title: 'Sooner' }),
        work({ courseId: '2', title: 'Midterm 2' }),
      ]),
    ).toEqual({ 1: ['Sooner', 'Later'], 2: ['Midterm 2'] });
  });

  it('keeps overdue work until it is done', () => {
    const past = new Date('2026-10-23T14:10:00Z');
    expect(
      titles([
        work({ title: 'Missed', due: past }),
        work({ title: 'Handed in', due: past, done: true }),
      ]),
    ).toEqual({ 1: ['Missed'] });
  });

  it('keeps upcoming work once it is done', () => {
    expect(titles([work({ done: true })])).toEqual({
      1: ['Assignment - Shell'],
    });
  });

  it('skips notes and work in no course', () => {
    expect(
      titles([work({ url: undefined }), work({ courseId: undefined })]),
    ).toEqual({});
  });

  it('shows at most PER_CARD per card, the soonest', () => {
    const many = Array.from({ length: PER_CARD + 2 }, (_, i) =>
      work({
        title: `Lab ${String(i)}`,
        due: new Date(NOW.getTime() + (i + 1) * 86_400_000),
      }),
    );
    const list = cardLists(many, NOW).get('1') ?? [];
    expect(list).toHaveLength(PER_CARD);
    expect(list.at(-1)?.title).toBe(`Lab ${String(PER_CARD - 1)}`);
  });
});
