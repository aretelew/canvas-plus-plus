import { describe, expect, it } from 'vitest';
import type { Work } from '@/core/planner';
import type { CanvasGroup } from '@/core/groups';
import type { CourseAssignment, ModuleItem } from './course-items';
import { searchEntries, type SearchCourse } from './data';

const NOW = new Date('2026-10-14T12:00:00Z');
const inDays = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

const tab = (id: string, label: string, course = '1', hidden?: boolean) => ({
  id,
  label,
  html_url: `/courses/${course}/${id}`,
  hidden,
});

const COURSES: SearchCourse[] = [
  {
    id: '2',
    name: 'Robots',
    original_name: 'Intro to Robotics',
    course_code: 'CSDS 373',
    tabs: [tab('home', 'Home', '2'), tab('grades', 'Grades', '2')],
  },
  {
    id: '1',
    name: 'Intro to Operating Systems',
    course_code: 'CSDS 338',
    tabs: [
      tab('home', 'Home'),
      tab('modules', 'Modules'),
      tab('people', 'People', '1', true),
    ],
  },
  { id: '3', name: 'Old Course', course_code: 'OLD 100', concluded: true },
];

const COLORS = new Map([['1', '#e1185c']]);

const work = (title: string, due: Date, over: Partial<Work> = {}): Work => ({
  title,
  url: `/courses/1/assignments/${title}`,
  due,
  done: false,
  courseId: '1',
  courseName: 'Intro to Operating Systems',
  target: { plannable_type: 'assignment', plannable_id: '1' },
  ...over,
});

const group = (over: Partial<CanvasGroup>): CanvasGroup => ({
  id: '7',
  name: 'Lab team',
  can_access: true,
  concluded: false,
  ...over,
});

const assignment = (
  id: string,
  due?: Date,
  courseId = '1',
): CourseAssignment => ({
  id,
  courseId,
  name: `Assignment ${id}`,
  url: `/courses/${courseId}/assignments/${id}`,
  due: due?.toISOString(),
});

const moduleItem = (
  id: string,
  over: Partial<ModuleItem> = {},
): ModuleItem => ({
  courseId: '1',
  title: `Item ${id}`,
  module: 'Week 1',
  url: `/courses/${over.courseId ?? '1'}/modules/items/${id}`,
  ...over,
});

const entries = (
  over: {
    works?: Work[];
    groups?: CanvasGroup[];
    assignments?: CourseAssignment[];
    moduleItems?: ModuleItem[];
  } = {},
) =>
  searchEntries(
    {
      courses: COURSES,
      assignments: over.assignments ?? [],
      moduleItems: over.moduleItems ?? [],
      groups: over.groups ?? [],
      colors: COLORS,
      works: over.works ?? [],
    },
    NOW,
  );

describe('searchEntries', () => {
  it('lists the current courses by the names the sidebar gives them, to start with', () => {
    const courses = entries().filter(({ href }) =>
      /^\/courses\/\d$/.test(href),
    );
    expect(courses).toEqual([
      {
        title: 'CSDS 338',
        href: '/courses/1',
        also: ['Intro to Operating Systems', 'CSDS 338'],
        color: '#e1185c',
        start: true,
      },
      {
        title: 'Robots',
        href: '/courses/2',
        also: ['Intro to Robotics', 'CSDS 373'],
        start: true,
      },
      {
        title: 'OLD 100',
        href: '/courses/3',
        also: ['Old Course', 'OLD 100'],
      },
    ]);
  });

  it("lists each current course's pages but its home page and hidden ones", () => {
    const pages = entries().filter(({ href }) =>
      /^\/courses\/\d\/\w+$/.test(href),
    );
    expect(pages.map(({ title, where }) => `${title}, ${where ?? ''}`)).toEqual(
      ['Modules, CSDS 338', 'Grades, Robots'],
    );
    expect(entries().find(({ title }) => title === 'Grades')).toMatchObject({
      href: '/courses/2/grades',
      also: ['Intro to Robotics', 'CSDS 373'],
    });
  });

  it('lists work left to do, soonest first, starting with what is due this week', () => {
    const todo = entries({
      works: [
        work('Later', inDays(10)),
        work('Done', inDays(1), { done: true }),
        work('Note', inDays(1), { url: undefined }),
        work('Soon', inDays(2)),
        work('Late', inDays(-1)),
      ],
    }).filter(({ due }) => due);
    expect(todo.map(({ title, start }) => [title, start])).toEqual([
      ['Late', true],
      ['Soon', true],
      ['Later', false],
    ]);
    expect(todo[0]).toMatchObject({
      where: 'CSDS 338',
      color: '#e1185c',
      due: inDays(-1).toISOString(),
    });
  });

  it("names work by Canvas's name for a course that isn't listed", () => {
    const [found] = entries({
      works: [work('Quiz', inDays(1), { courseId: '9', courseName: 'Other' })],
    }).filter(({ due }) => due);
    expect(found?.where).toBe('Other');
  });

  it('lists the groups of current courses and of none', () => {
    const groups = entries({
      groups: [
        group({ course_id: '1' }),
        group({ id: '8', name: 'Club' }),
        group({ id: '9', name: 'Old team', course_id: '3' }),
      ],
    }).filter(({ href }) => href.startsWith('/groups/'));
    expect(groups).toEqual([
      {
        title: 'Lab team',
        href: '/groups/7',
        where: 'CSDS 338',
        color: '#e1185c',
      },
      { title: 'Club', href: '/groups/8' },
    ]);
  });

  it("lists the current courses' assignments after their pages, coming up first, then past, then undated", () => {
    const found = entries({
      assignments: [
        assignment('1'),
        assignment('2', inDays(-10)),
        assignment('3', inDays(5), '2'),
        assignment('4', inDays(-1)),
        assignment('5', inDays(1)),
      ],
    });
    const listed = found.filter(({ title }) => title.startsWith('Assignment'));
    expect(listed.map(({ title }) => title)).toEqual([
      'Assignment 5',
      'Assignment 3',
      'Assignment 4',
      'Assignment 2',
      'Assignment 1',
    ]);
    expect(listed[1]).toEqual({
      title: 'Assignment 3',
      href: '/courses/2/assignments/3',
      where: 'Robots',
      due: inDays(5).toISOString(),
    });
    const at = (title: string) => found.findIndex((e) => e.title === title);
    expect(at('Assignment 5')).toBeGreaterThan(at('Grades'));
  });

  it('leaves out assignments the To Do lists, but not finished ones', () => {
    const target = (id: string) => ({
      plannable_type: 'assignment',
      plannable_id: id,
    });
    const titles = entries({
      works: [
        work('Quiz 1', inDays(1), { target: target('1') }),
        work('Essay', inDays(1), { target: target('2'), done: true }),
      ],
      assignments: [assignment('1'), assignment('2')],
    }).map(({ title }) => title);
    expect(titles).toContain('Quiz 1');
    expect(titles).not.toContain('Assignment 1');
    expect(titles).toContain('Assignment 2');
  });

  it('lists the module items after the assignments, in module order, found by their module too', () => {
    const found = entries({
      assignments: [assignment('1')],
      moduleItems: [
        moduleItem('5', { title: 'Lecture 5', module: 'Week 3' }),
        moduleItem('6', { courseId: '2' }),
      ],
    });
    const items = found.filter(({ href }) => href.includes('/modules/items/'));
    expect(items).toEqual([
      {
        title: 'Lecture 5',
        href: '/courses/1/modules/items/5',
        also: ['Week 3'],
        where: 'CSDS 338',
        color: '#e1185c',
      },
      {
        title: 'Item 6',
        href: '/courses/2/modules/items/6',
        also: ['Week 1'],
        where: 'Robots',
      },
    ]);
    const at = (title: string) => found.findIndex((e) => e.title === title);
    expect(at('Lecture 5')).toBeGreaterThan(at('Assignment 1'));
    expect(at('Lecture 5')).toBeLessThan(at('OLD 100'));
  });

  it("ends with Canvas's own pages", () => {
    expect(entries().at(-1)).toEqual({
      title: 'Notifications',
      href: '/profile/communication',
    });
  });

  it('links only to this site', () => {
    const outside = entries({
      works: [
        work('Elsewhere', inDays(1), { url: 'https://example.com/a' }),
        work('Protocol', inDays(1), { url: '//example.com/a' }),
        work('Script', inDays(1), { url: 'javascript:alert(1)' }),
      ],
      moduleItems: [moduleItem('1', { url: '//example.com/a' })],
    });
    expect(outside.filter(({ due }) => due)).toEqual([]);
    expect(outside.map(({ title }) => title)).not.toContain('Item 1');
  });
});
