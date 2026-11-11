// @vitest-environment happy-dom
import { browser } from '#imports';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canvasJson } from '@/core/canvas-api';
import { loadCourseItems } from './course-items';

vi.mock('@/core/canvas-api', () => ({ canvasJson: vi.fn() }));

// the fake browser has no manifest, which what's saved is kept with
vi.spyOn(browser.runtime, 'getManifest').mockReturnValue({
  manifest_version: 3,
  name: 'x',
  version: '1.0.0',
});

beforeEach(() => {
  localStorage.clear();
});

const at = (path: string) => `${location.origin}${path}`;

const post = (id: string, over: object = {}) => ({
  _id: id,
  title: `Post ${id}`,
  message: `<p>About</p><p>post ${id}</p>`,
  postedAt: null,
  createdAt: null,
  published: true,
  ...over,
});

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
        description: '<p>Write</p><p>about a <b>poem</b></p>',
        quiz: null,
      },
      {
        _id: '11',
        name: 'Quiz 1',
        dueAt: '2026-10-20T03:59:59Z',
        htmlUrl: at('/courses/1/assignments/11'),
        description: null,
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
            _id: '30',
            assignment: { _id: '12' },
          }),
          item('7', 'Post 21', {
            __typename: 'Discussion',
            _id: '21',
            assignment: null,
          }),
        ],
      },
      {
        name: 'Week 1',
        position: 1,
        moduleItems: [
          item('5', 'Lecture 1', { __typename: 'File' }),
          item('8', 'Syllabus', {
            __typename: 'Page',
            _id: '40',
            updatedAt: '2026-09-01T00:00:00Z',
          }),
          item('6', 'Essay', { __typename: 'Assignment', _id: '10' }),
          { title: 'Elsewhere', url: 'https://example.com/', content: null },
        ],
      },
    ],
  },
  // newest first, as Canvas gives them
  announcements: {
    nodes: [
      post('20', { postedAt: '2026-10-23T15:00:00Z' }),
      post('22', { postedAt: '2026-10-01T15:00:00Z', published: false }),
    ],
  },
  // oldest first
  discussions: {
    nodes: [
      post('21', { postedAt: '2026-10-10T15:00:00Z' }),
      post('23', { assignment: { _id: '13' } }),
    ],
  },
};

// Canvas's answer to each request: the items, the posts on their own, and
// each page by its path
const answer = (
  items: unknown,
  posts: unknown,
  pages: Record<string, unknown> = {},
) => {
  vi.mocked(canvasJson).mockReset();
  vi.mocked(canvasJson).mockImplementation((path, request) => {
    if (!request) return Promise.resolve(pages[path]);
    const { query } = request.json as { query: string };
    return Promise.resolve(
      query.startsWith('query SearchPosts') ? posts : items,
    );
  });
};

const SYLLABUS = {
  '/api/v1/courses/1/pages/40': { body: '<p>Office hours</p>' },
};

describe('loadCourseItems', () => {
  it('asks for each course in one request for the items and one for the posts, and lists module items in module order but the headings, assignments and posts', async () => {
    answer({ data: { c0: COURSE } }, { data: { c0: COURSE } });
    const { assignments, moduleItems } = await loadCourseItems('A Student', [
      '1',
      '2',
    ]);

    const queries = vi
      .mocked(canvasJson)
      .mock.calls.filter(([path]) => path === '/api/graphql');
    expect(queries).toHaveLength(2);
    for (const [, request] of queries) {
      expect(request?.json).toMatchObject({ variables: { c0: '1', c1: '2' } });
    }
    expect(assignments.map(({ name, url }) => [name, url])).toEqual([
      ['Essay', '/courses/1/assignments/10'],
      ['Quiz 1', '/courses/1/assignments/11'],
    ]);
    // the assignments and posts are listed as themselves; the forum's
    // assignment isn't one of them
    expect(moduleItems.map(({ title, module }) => [title, module])).toEqual([
      ['Lecture 1', 'Week 1'],
      ['Syllabus', 'Week 1'],
      ['Practice quiz', 'Week 2'],
      ['Forum', 'Week 2'],
    ]);
    expect(moduleItems[0]).toMatchObject({
      courseId: '1',
      url: '/courses/1/modules/items/5',
    });
  });

  it('lists the published announcements and ungraded discussions, newest first, with their text', async () => {
    answer({ data: { c0: COURSE } }, { data: { c0: COURSE } });
    const { posts } = await loadCourseItems('A Student', ['1']);

    expect(posts).toEqual([
      {
        id: '20',
        courseId: '1',
        kind: 'announcement',
        title: 'Post 20',
        url: '/courses/1/discussion_topics/20',
        posted: '2026-10-23T15:00:00Z',
        text: 'About post 20',
      },
      {
        id: '21',
        courseId: '1',
        kind: 'discussion',
        title: 'Post 21',
        url: '/courses/1/discussion_topics/21',
        posted: '2026-10-10T15:00:00Z',
        text: 'About post 21',
      },
    ]);
  });

  it('cuts a long post short', async () => {
    const long = { ...COURSE, discussions: null };
    long.announcements = {
      nodes: [post('20', { message: `<p>${'word '.repeat(2000)}</p>` })],
    };
    answer(undefined, { data: { c0: long } });
    const { posts } = await loadCourseItems('A Student', ['1']);
    expect(posts[0]?.text).toHaveLength(6000);
  });

  it("gives an assignment its description's text, and a page in a module its own", async () => {
    answer({ data: { c0: COURSE } }, undefined, SYLLABUS);
    const { assignments, moduleItems } = await loadCourseItems('A Student', [
      '1',
    ]);
    expect(assignments.map(({ text }) => text)).toEqual([
      'Write about a poem',
      undefined,
    ]);
    expect(moduleItems.find(({ title }) => title === 'Syllabus')?.text).toBe(
      'Office hours',
    );
    expect(moduleItems.find(({ title }) => title === 'Lecture 1')?.text).toBe(
      undefined,
    );
  });

  it('dates a post Canvas gives no posting date by when it was made', async () => {
    const undated = { ...COURSE, announcements: null };
    undated.discussions = {
      nodes: [post('21', { createdAt: '2026-09-01T15:00:00Z' })],
    };
    answer(undefined, { data: { c0: undated } });
    const { posts } = await loadCourseItems('A Student', ['1']);
    expect(posts[0]?.posted).toBe('2026-09-01T15:00:00Z');
  });

  it('keeps the items when the posts fail, and the posts when the items fail', async () => {
    answer({ data: { c0: COURSE } }, { errors: [{ message: 'unknown' }] });
    const items = await loadCourseItems('A Student', ['1']);
    expect(items.assignments).toHaveLength(2);
    expect(items.posts).toEqual([]);
    // without the posts, the discussion's module item is listed as itself
    expect(items.moduleItems.map(({ title }) => title)).toContain('Post 21');

    answer(undefined, { data: { c0: COURSE } });
    const posts = await loadCourseItems('A Student', ['1']);
    expect(posts.assignments).toEqual([]);
    expect(posts.posts).toHaveLength(2);
  });

  it("keeps the pages' saved text when the items can't be had", async () => {
    answer({ data: { c0: COURSE } }, undefined, SYLLABUS);
    await loadCourseItems('A Student', ['1']);
    answer(undefined, undefined);
    await loadCourseItems('A Student', ['1']);

    // the page hasn't changed, so its text is the saved one, and not asked for
    answer({ data: { c0: COURSE } }, undefined);
    const { moduleItems } = await loadCourseItems('A Student', ['1']);
    expect(moduleItems.find(({ title }) => title === 'Syllabus')?.text).toBe(
      'Office hours',
    );
  });

  it('finds nothing when both requests fail', async () => {
    answer(undefined, undefined);
    expect(await loadCourseItems('A Student', ['1'])).toEqual({
      assignments: [],
      moduleItems: [],
      posts: [],
    });
  });
});
