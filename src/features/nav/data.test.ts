import { describe, expect, it } from 'vitest';
import type { Work } from '@/core/planner';
import {
  currentGroups,
  navData,
  recentPages,
  recentWith,
  shortLabel,
  type CanvasGroup,
  type DashboardCard,
  type HistoryEntry,
  type NavData,
  type NavPage,
} from './data';

const NOW = new Date('2026-10-14T12:00:00');
const inDays = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

const work = (courseId: string, due: Date, over: Partial<Work> = {}): Work => ({
  title: 'Work',
  due,
  done: false,
  courseId,
  target: { plannable_type: 'assignment', plannable_id: '1' },
  ...over,
});

const CARDS: DashboardCard[] = [
  {
    id: '1',
    shortName: 'Intro to Operating Systems',
    originalName: 'Intro to Operating Systems',
    courseCode: 'CSDS 338',
  },
  {
    id: '2',
    shortName: 'Robots',
    originalName: 'Intro to Robotics (100/123)',
    courseCode: 'CSDS 373',
  },
];

const data = (over: Partial<Parameters<typeof navData>[0]> = {}) =>
  navData(
    {
      cards: CARDS,
      groups: [],
      colors: new Map(),
      works: [],
      history: [],
      ...over,
    },
    NOW,
  );

describe('navData', () => {
  it('labels a course by its code, or the nickname the user gave it', () => {
    const { courses } = data();
    expect(courses.map(({ label, title }) => [label, title])).toEqual([
      ['CSDS 338', 'Intro to Operating Systems'],
      ['Robots', 'Intro to Robotics (100/123)'],
    ]);
  });

  it('counts unfinished work by course: late, and due in the next week', () => {
    const works = [
      work('1', inDays(-1)),
      work('1', inDays(1)),
      work('1', inDays(3)),
      work('1', inDays(9)),
      work('1', inDays(1), { done: true }),
      work('2', inDays(2), {
        override: { id: '9', marked_complete: false, dismissed: true },
      }),
    ];
    const { courses } = data({ works });
    expect(courses.map(({ soon, late }) => [soon, late])).toEqual([
      [2, 1],
      [0, 0],
    ]);
  });

  it("takes each course's color", () => {
    const colors = new Map([['2', '#1d9e75']]);
    const { courses } = data({ colors });
    expect(courses.map(({ color }) => color)).toEqual([undefined, '#1d9e75']);
  });

  it('gives a group its course color', () => {
    const groups = [
      { id: '7', name: 'Lab', can_access: true, course_id: '1' },
      { id: '8', name: 'Club', can_access: true },
    ];
    const colors = new Map([['1', '#1d9e75']]);
    expect(data({ groups, colors }).groups).toEqual([
      { id: '7', name: 'Lab', color: '#1d9e75' },
      { id: '8', name: 'Club', color: undefined },
    ]);
  });
});

describe('recentPages', () => {
  const AT = '2026-10-14T10:00:00Z';
  const visit = (url: string, name: string | null = 'Page'): HistoryEntry => ({
    asset_name: name,
    visited_url: url,
    visited_at: AT,
    context_name: 'Its full name',
  });

  it('lists a page once, newest first', () => {
    const pages = recentPages([
      visit('https://school.test/courses/1/assignments/4', 'HW 4'),
      visit('https://school.test/courses/1/assignments/4', 'HW 4'),
      visit('https://school.test/groups/7/discussion_topics/2', 'Plan'),
    ]);
    expect(pages).toEqual([
      {
        href: '/courses/1/assignments/4',
        name: 'HW 4',
        where: 'Its full name',
        at: AT,
      },
      {
        href: '/groups/7/discussion_topics/2',
        name: 'Plan',
        where: 'Its full name',
        at: AT,
      },
    ]);
  });

  it("takes Canvas's word off a course's own sections, and only those", () => {
    const pages = recentPages([
      visit('https://school.test/courses/1/modules', 'Course Modules'),
      visit(
        'https://school.test/courses/1/assignments/syllabus',
        'Course Syllabus',
      ),
      visit('https://school.test/courses/1/pages/plan', 'Course plan'),
    ]);
    expect(pages.map(({ name }) => name)).toEqual([
      'Modules',
      'Syllabus',
      'Course plan',
    ]);
  });

  it('leaves out home pages, pages outside a course, and unnamed ones', () => {
    const history = [
      visit('https://school.test/courses/1'),
      visit('https://school.test/courses/1/'),
      visit('https://school.test/'),
      visit('https://school.test/calendar'),
      visit('https://school.test/courses/1/modules', null),
    ];
    expect(recentPages(history)).toEqual([]);
  });

  it('only ever links to this site', () => {
    const [page] = recentPages([
      visit('https://elsewhere.test/courses/1/modules?x=1'),
    ]);
    expect(page?.href).toBe('/courses/1/modules?x=1');
  });

  it('stops at three', () => {
    const history = [1, 2, 3, 4, 5, 6].map((id) =>
      visit(`https://school.test/courses/1/pages/${String(id)}`),
    );
    expect(recentPages(history)).toHaveLength(3);
  });
});

describe('recentWith', () => {
  const page = (href: string, at: string, name = href): NavPage => ({
    href,
    name,
    at,
  });
  const list = (recent: NavPage[]): NavData => ({
    courses: [
      {
        id: '1',
        label: 'CSDS 338',
        title: 'Operating Systems',
        color: '#1d9e75',
        soon: 0,
        late: 0,
      },
    ],
    groups: [],
    recent,
  });

  it('lists what was opened here and what Canvas knows, newest first', () => {
    const pages = recentWith(list([page('/b', '2026-10-14T10:00:00Z')]), [
      page('/a', '2026-10-14T11:00:00.000Z'),
      page('/c', '2026-10-14T09:00:00.000Z'),
    ]);
    expect(pages.map(({ href }) => href)).toEqual(['/a', '/b', '/c']);
  });

  it('lists a page in both once, by its newest visit', () => {
    const pages = recentWith(
      list([page('/a', '2026-10-14T10:00:00Z', 'Old')]),
      [page('/a', '2026-10-14T11:00:00.000Z', 'New')],
    );
    expect(pages.map(({ name }) => name)).toEqual(['New']);
  });

  it("names a page's course as the sidebar does, with its color", () => {
    const at = '2026-10-14T11:00:00.000Z';
    const pages = recentWith(
      list([{ href: '/courses/1/files', name: 'Files', where: 'Full', at }]),
      [{ href: '/courses/1/modules', name: 'Modules', where: 'Crumb', at }],
    );
    expect(pages.map(({ where, color }) => [where, color])).toEqual([
      ['CSDS 338', '#1d9e75'],
      ['CSDS 338', '#1d9e75'],
    ]);
  });

  it('keeps what a page says it is outside the listed courses', () => {
    const at = '2026-10-14T11:00:00.000Z';
    const [opened] = recentWith(list([]), [
      { href: '/courses/9/modules', name: 'Modules', where: 'Old course', at },
    ]);
    expect(opened?.where).toBe('Old course');
  });

  it('stops at three', () => {
    const visits = [1, 2, 3, 4].map((id) =>
      page(`/${String(id)}`, '2026-10-14T11:00:00.000Z'),
    );
    expect(recentWith(list([]), visits)).toHaveLength(3);
  });
});

describe('currentGroups', () => {
  const group = (id: string, over: Partial<CanvasGroup>): CanvasGroup => ({
    id,
    name: `Group ${id}`,
    can_access: true,
    concluded: false,
    ...over,
  });

  it("keeps the listed courses' groups and those of no course", () => {
    const groups = [
      group('1', { course_id: '1' }),
      group('2', { course_id: '99' }),
      group('3', {}),
      group('4', { course_id: '1', concluded: true }),
      group('5', { course_id: '1', can_access: false }),
    ];
    expect(currentGroups(groups, [{ id: '1' }]).map(({ id }) => id)).toEqual([
      '1',
      '3',
    ]);
  });
});

describe('shortLabel', () => {
  it("is a course code's number, or else the start of the name", () => {
    expect(shortLabel('CSDS 340')).toBe('340');
    expect(shortLabel('PHYS 121L')).toBe('121L');
    expect(shortLabel('Experience Portfolio')).toBe('Exp');
  });
});
