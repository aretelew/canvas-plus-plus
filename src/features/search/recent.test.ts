import { describe, expect, it } from 'vitest';
import type { Entry } from './match';
import { recentEntries, visitOf, type Visit } from './recent';

const visit = (url: string) => visitOf(new URL(url, 'https://canvas.test'));

const entry = (title: string, href: string): Entry => ({
  title,
  href,
  kind: 'page',
});

const CHEM = entry('CHEM 105', '/courses/1');
const GRADES = entry('Grades', '/courses/1/grades');
const LAB = entry('Lab 4: Titration', '/courses/1/assignments/4');
const READING = entry('Week 3 reading', '/courses/1/modules/items/31');
const DASHBOARD = entry('Dashboard', '/');
const ENTRIES = [CHEM, GRADES, LAB, READING, DASHBOARD];

const titles = (found: Entry[]) => found.map(({ title }) => title);

describe('visitOf', () => {
  it('keeps the path, without a trailing slash', () => {
    expect(visit('/courses/1/grades/?tab=x#top')).toEqual({
      path: '/courses/1/grades',
    });
    expect(visit('/')).toEqual({ path: '/' });
  });

  it('notes the module item a page was opened as', () => {
    expect(visit('/courses/1/pages/intro?module_item_id=31')).toEqual({
      path: '/courses/1/pages/intro',
      item: '/courses/1/modules/items/31',
    });
  });

  it("leaves out a module item outside a course, or that isn't one", () => {
    expect(visit('/groups/2/pages/x?module_item_id=31')).toEqual({
      path: '/groups/2/pages/x',
    });
    expect(visit('/courses/1/pages/x?module_item_id=../../x')).toEqual({
      path: '/courses/1/pages/x',
    });
  });
});

describe('recentEntries', () => {
  const here = visit('/courses/2');

  it("lists what's listed of the pages opened, newest first, once each", () => {
    const visits: Visit[] = [
      visit('/courses/1/grades'),
      visit('/courses/1/assignments/4/submissions/9'),
      visit('/courses/1'),
      visit('/courses/1/grades/'),
    ];
    expect(titles(recentEntries(ENTRIES, visits, here))).toEqual([
      'Grades',
      'CHEM 105',
    ]);
  });

  it('finds a page by the module item it was opened as', () => {
    const visits = [
      visit('/courses/1/pages/reading?module_item_id=31'),
      // an assignment is listed as itself, not as its module item
      visit('/courses/1/assignments/4?module_item_id=32'),
    ];
    expect(titles(recentEntries(ENTRIES, visits, here))).toEqual([
      'Week 3 reading',
      'Lab 4: Titration',
    ]);
  });

  it("leaves out the page that's open", () => {
    const visits = [visit('/courses/1/grades'), visit('/')];
    expect(
      titles(recentEntries(ENTRIES, visits, visit('/courses/1/grades'))),
    ).toEqual(['Dashboard']);
  });

  it('lists the first entry for a page listed twice', () => {
    const work = { ...LAB, due: '2026-10-15T12:00:00Z' };
    const found = recentEntries([work, LAB], [visit(LAB.href)], here);
    expect(found).toEqual([work]);
  });

  it('lists five at most', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      entry(`Page ${String(i)}`, `/p/${String(i)}`),
    );
    const visits = many.map(({ href }) => visit(href));
    expect(recentEntries(many, visits, here)).toHaveLength(5);
  });
});
