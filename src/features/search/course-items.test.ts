// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { canvasJson } from '@/core/canvas-api';
import { loadCourseItems } from './course-items';

vi.mock('@/core/canvas-api', () => ({ canvasJson: vi.fn() }));

const at = (path: string) => `${location.origin}${path}`;

const item = (id: string, title: string, content: object) => ({
  title,
  url: at(`/courses/1/modules/items/${id}`),
  content,
});

// what GraphQL answers for one course, as c0
const COURSE = {
  assignmentsConnection: {
    nodes: [
      {
        _id: '10',
        name: 'Essay',
        dueAt: null,
        htmlUrl: at('/courses/1/assignments/10'),
        quiz: null,
      },
      {
        _id: '11',
        name: 'Quiz 1',
        dueAt: '2026-10-20T03:59:59Z',
        htmlUrl: at('/courses/1/assignments/11'),
        quiz: { _id: '3' },
      },
    ],
  },
  // in name order, as Canvas gives them
  modulesConnection: {
    nodes: [
      {
        name: 'Week 2',
        position: 2,
        moduleItems: [
          item('1', 'Readings', { __typename: 'SubHeader' }),
          item('2', 'Quiz 1', { __typename: 'Quiz', _id: '3' }),
          item('3', 'Practice quiz', { __typename: 'Quiz', _id: '4' }),
          item('4', 'Forum', {
            __typename: 'Discussion',
            assignment: { _id: '12' },
          }),
        ],
      },
      {
        name: 'Week 1',
        position: 1,
        moduleItems: [
          item('5', 'Lecture 1', { __typename: 'File' }),
          item('6', 'Essay', { __typename: 'Assignment', _id: '10' }),
          { title: 'Elsewhere', url: 'https://example.com/', content: null },
        ],
      },
    ],
  },
};

describe('loadCourseItems', () => {
  it('asks for each course in one request, and lists module items in module order but the headings and assignments', async () => {
    vi.mocked(canvasJson).mockResolvedValueOnce({ data: { c0: COURSE } });
    const { assignments, moduleItems } = await loadCourseItems(['1', '2']);

    const [, request] = vi.mocked(canvasJson).mock.calls[0] ?? [];
    expect(request?.json).toMatchObject({ variables: { c0: '1', c1: '2' } });
    expect(assignments.map(({ name, url }) => [name, url])).toEqual([
      ['Essay', '/courses/1/assignments/10'],
      ['Quiz 1', '/courses/1/assignments/11'],
    ]);
    // the assignments are listed as themselves; the forum's isn't one of them
    expect(moduleItems.map(({ title, module }) => [title, module])).toEqual([
      ['Lecture 1', 'Week 1'],
      ['Practice quiz', 'Week 2'],
      ['Forum', 'Week 2'],
    ]);
    expect(moduleItems[0]).toMatchObject({
      courseId: '1',
      url: '/courses/1/modules/items/5',
    });
  });

  it('finds nothing when the request fails', async () => {
    vi.mocked(canvasJson).mockResolvedValueOnce(undefined);
    expect(await loadCourseItems(['1'])).toEqual({
      assignments: [],
      moduleItems: [],
    });
  });
});
