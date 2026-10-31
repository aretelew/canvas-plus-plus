import { describe, expect, it } from 'vitest';
import {
  toWork,
  unreadAnnouncements,
  type PlannerItem,
  type Work,
} from './planner';

function item(over: Partial<PlannerItem> = {}): PlannerItem {
  return {
    course_id: '1',
    context_name: 'Intro to Operating Systems',
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

function work(over: Partial<PlannerItem>): Work {
  const result = toWork(item(over));
  if (!result) throw new Error('not work');
  return result;
}

describe('toWork', () => {
  it('reads an item as work', () => {
    expect(work({})).toEqual({
      title: 'Assignment - Shell',
      url: '/courses/1/assignments/10',
      due: new Date('2026-10-28T03:59:00Z'),
      done: false,
      courseId: '1',
      courseName: 'Intro to Operating Systems',
      target: { plannable_type: 'assignment', plannable_id: '10' },
      override: undefined,
    });
  });

  it('skips what has nothing to finish', () => {
    expect(toWork(item({ plannable_type: 'announcement' }))).toBeUndefined();
    expect(toWork(item({ plannable_type: 'calendar_event' }))).toBeUndefined();
  });

  it("keeps the user's own notes, which have no page", () => {
    const note = work({
      plannable_type: 'planner_note',
      html_url: '/api/v1/planner_notes/3',
      course_id: undefined,
      submissions: false,
    });
    expect(note.url).toBeUndefined();
    expect(note.done).toBe(false);
  });

  it("decides done as Canvas's planner does", () => {
    const done = (over: Partial<PlannerItem>) => work(over).done;
    const override = { id: '5', marked_complete: false, dismissed: false };
    expect(
      done({ submissions: { submitted: true, redo_request: false } }),
    ).toBe(true);
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

  it('counts work the teacher graded or excused as done', () => {
    const done = (over: { graded?: boolean; excused?: boolean }) =>
      work({ submissions: { submitted: false, redo_request: false, ...over } })
        .done;
    // an exam taken on paper is never submitted
    expect(done({ graded: true })).toBe(true);
    expect(done({ excused: true })).toBe(true);
    expect(done({ graded: false, excused: false })).toBe(false);
  });

  it('marks graded quizzes and discussions done through their assignment', () => {
    const quiz = work({
      plannable_type: 'quiz',
      plannable_id: '77',
      plannable: { title: 'Quiz 3', assignment_id: '12' },
    }).target;
    const page = work({
      plannable_type: 'wiki_page',
      plannable_id: '8',
    }).target;
    expect(quiz).toEqual({ plannable_type: 'assignment', plannable_id: '12' });
    expect(page).toEqual({ plannable_type: 'wiki_page', plannable_id: '8' });
  });
});

describe('unreadAnnouncements', () => {
  const announcement = (
    read_state: string,
    over: Partial<PlannerItem> = {},
  ): PlannerItem =>
    item({
      plannable_type: 'announcement',
      plannable: { title: 'Office hours moved', read_state },
      submissions: false,
      ...over,
    });
  const override = { id: '5', marked_complete: false, dismissed: false };

  it("counts only the course's unread announcements", () => {
    expect(
      unreadAnnouncements(
        [
          announcement('unread'),
          announcement('unread'),
          announcement('read'),
          announcement('unread', { course_id: '2' }),
          item(),
        ],
        '1',
      ),
    ).toBe(2);
  });

  it("leaves out what the user cleared from Canvas's To Do", () => {
    const count = (planner_override: PlannerItem['planner_override']) =>
      unreadAnnouncements([announcement('unread', { planner_override })], '1');
    expect(count(override)).toBe(1);
    expect(count({ ...override, dismissed: true })).toBe(0);
    expect(count({ ...override, marked_complete: true })).toBe(0);
  });
});
