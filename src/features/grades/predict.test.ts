import { describe, expect, it } from 'vitest';
import type { Cutoff, Group } from './breakdown';
import {
  agrees,
  needs,
  predictable,
  totalOf,
  withPredictions,
} from './predict';

const weighted = (name: string, weight: number, percent?: number): Group => ({
  name,
  weight,
  percent,
});
const points = (name: string, possible: number, percent?: number): Group => ({
  name,
  possible,
  percent,
});

// a course weighted 10/10/40/40, its final exam not yet graded
const COURSE = [
  weighted('Assignments', 10, 100),
  weighted('Class Participation', 10, 100),
  weighted('Exams', 40, 86.84),
  weighted('Final Exam', 40),
];

const SCHEME: Cutoff[] = [
  { name: 'A', value: 0.94 },
  { name: 'A-', value: 0.9 },
  { name: 'B+', value: 0.87 },
  { name: 'B', value: 0.84 },
  { name: 'B-', value: 0.8 },
  { name: 'F', value: 0 },
];

describe('totalOf', () => {
  it('weighs the graded groups, scaled up to what counts so far', () => {
    expect(totalOf(COURSE)).toBeCloseTo(91.23, 2);
  });

  it('counts every weight once they’re all graded', () => {
    expect(
      totalOf(withPredictions(COURSE, new Map([['Final Exam', 80]]))),
    ).toBeCloseTo(86.74, 2);
  });

  it('doesn’t scale weights over 100 down', () => {
    expect(
      totalOf([weighted('Work', 100, 90), weighted('Extra', 10, 100)]),
    ).toBe(100);
  });

  it('adds up points in an unweighted course', () => {
    expect(totalOf([points('Labs', 50, 100), points('Exams', 150, 80)])).toBe(
      85,
    );
  });

  it('is nothing with nothing graded', () => {
    expect(totalOf([weighted('Final', 40)])).toBeUndefined();
    expect(totalOf([])).toBeUndefined();
  });
});

describe('agrees', () => {
  it('allows for Canvas’s rounding', () => {
    expect(agrees(COURSE, 91.23)).toBe(true);
    expect(agrees(COURSE, 89.67)).toBe(false);
  });
});

describe('predictable', () => {
  it('takes a group that counts toward the total', () => {
    expect(predictable(weighted('Final', 40), true)).toBe(true);
    expect(predictable(weighted('Imported', 0, 100), true)).toBe(false);
    expect(predictable(points('Labs', 50), false)).toBe(true);
    expect(predictable({ name: 'Empty' }, false)).toBe(false);
  });
});

describe('withPredictions', () => {
  it('puts the predictions in place of Canvas’s grades', () => {
    const groups = withPredictions(COURSE, new Map([['Exams', 95]]));
    expect(groups.map((g) => g.percent)).toEqual([100, 100, 95, undefined]);
  });
});

describe('needs', () => {
  it('finds what the final needs for each letter it decides', () => {
    expect(needs(COURSE, 'Final Exam', SCHEME)).toEqual([
      { letter: 'A', percent: 98.16 },
      { letter: 'A-', percent: 88.16 },
      { letter: 'B+', percent: 80.66 },
    ]);
  });

  it('leaves out letters out of reach or already certain', () => {
    // 30% at worst, 80% at best: only B- is up to the final
    const course = [weighted('Exams', 50, 60), weighted('Final', 50)];
    expect(needs(course, 'Final', SCHEME, 10)).toEqual([
      { letter: 'B-', percent: 100 },
    ]);
  });

  it('rounds up, so the grade reaches the letter', () => {
    // A- needs 87.666…%
    const [need] = needs(
      [weighted('Exams', 70, 91), weighted('Final', 30)],
      'Final',
      SCHEME,
    );
    expect(need).toEqual({ letter: 'A-', percent: 87.67 });
  });
});
