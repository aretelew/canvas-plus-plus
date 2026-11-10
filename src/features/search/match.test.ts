import { describe, expect, it } from 'vitest';
import { search, type Entry } from './match';

const entry = (title: string, over: Partial<Entry> = {}): Entry => ({
  title,
  href: `/${title}`,
  ...over,
});

const CHEM = entry('CHEM 105', {
  also: ['General Chemistry', 'CHEM 105'],
  start: true,
});
const CHEM_GRADES = entry('Grades', {
  href: '/courses/1/grades',
  where: 'CHEM 105',
  also: ['General Chemistry'],
});
const OS_GRADES = entry('Grades', {
  href: '/courses/2/grades',
  where: 'CSDS 338',
});
const LAB = entry('Lab 4: Titration', { where: 'CHEM 105', start: true });
const ALL_GRADES = entry('All grades');
const ENTRIES = [CHEM, LAB, CHEM_GRADES, OS_GRADES, ALL_GRADES];

const titles = (found: Entry[]) =>
  found.map(({ title, where }) => (where ? `${title} (${where})` : title));

describe('search', () => {
  it('lists what starts the list when nothing is typed', () => {
    expect(search(ENTRIES, '  ')).toEqual([CHEM, LAB]);
  });

  it('finds a course page by words of both', () => {
    expect(titles(search(ENTRIES, 'chem gr'))).toEqual(['Grades (CHEM 105)']);
  });

  it('puts what the words name before what is in a course they name', () => {
    expect(titles(search(ENTRIES, 'chem'))).toEqual([
      'CHEM 105',
      'Lab 4: Titration (CHEM 105)',
      'Grades (CHEM 105)',
    ]);
  });

  it('puts a title that starts with what is typed first, keeping ties in order', () => {
    expect(titles(search(ENTRIES, 'grades'))).toEqual([
      'Grades (CHEM 105)',
      'Grades (CSDS 338)',
      'All grades',
    ]);
  });

  it('finds a course by its full name and by its number', () => {
    expect(search(ENTRIES, 'general')[0]).toBe(CHEM);
    expect(search(ENTRIES, '338')).toEqual([OS_GRADES]);
  });

  it('finds what is typed inside a word, after words it starts', () => {
    expect(titles(search(ENTRIES, 'trat'))).toEqual([
      'Lab 4: Titration (CHEM 105)',
    ]);
    expect(search([entry('Midterm'), entry('Term paper')], 'term')).toEqual([
      entry('Term paper'),
      entry('Midterm'),
    ]);
  });

  it('needs every word typed', () => {
    expect(search(ENTRIES, 'chem physics')).toEqual([]);
  });

  it('finds a post by what it says, after everything found otherwise', () => {
    const room = entry('Room change', {
      where: 'CHEM 105',
      text: 'The titration lab is in Room 12',
    });
    expect(titles(search([room, ...ENTRIES], 'titration'))).toEqual([
      'Lab 4: Titration (CHEM 105)',
      'Room change (CHEM 105)',
    ]);
    expect(search([room], 'chem room 12')).toEqual([room]);
  });

  it('needs a word found only in what a post says to start one of its words', () => {
    const post = entry('Office hours', { text: 'Available on Tuesdays' });
    expect(search([post], 'tues')).toEqual([post]);
    expect(search([post], 'lab')).toEqual([]);
  });

  it('ignores case and accents', () => {
    const resume = entry('Résumé workshop');
    expect(search([resume], 'RESUME')).toEqual([resume]);
  });
});
