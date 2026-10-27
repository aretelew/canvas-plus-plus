import { describe, expect, it } from 'vitest';
import { currentScores, formatScore } from './scores';

describe('currentScores', () => {
  it("takes a student's current score by course id", () => {
    const scores = currentScores([
      {
        id: '53976',
        enrollments: [{ type: 'student', computed_current_score: 89.67 }],
      },
    ]);
    expect(scores).toEqual(new Map([['53976', 89.67]]));
  });

  it("takes the current grading period's score in courses with periods", () => {
    const scores = currentScores([
      {
        id: '1',
        enrollments: [
          {
            type: 'student',
            has_grading_periods: true,
            computed_current_score: 75,
            current_period_computed_current_score: 92.5,
          },
        ],
      },
    ]);
    expect(scores.get('1')).toBe(92.5);
  });

  it('keeps a score of zero', () => {
    const scores = currentScores([
      {
        id: '1',
        enrollments: [{ type: 'student', computed_current_score: 0 }],
      },
    ]);
    expect(scores.get('1')).toBe(0);
  });

  it('skips courses with nothing to show', () => {
    const scores = currentScores([
      // no grades yet
      {
        id: '1',
        enrollments: [{ type: 'student', computed_current_score: null }],
      },
      // totals hidden by the teacher: Canvas leaves the fields out
      { id: '2', enrollments: [{ type: 'student' }] },
      // between grading periods
      {
        id: '3',
        enrollments: [
          {
            type: 'student',
            has_grading_periods: true,
            computed_current_score: 80,
            current_period_computed_current_score: null,
          },
        ],
      },
      // percentages hidden: students see a letter grade
      {
        id: '6',
        restrict_quantitative_data: true,
        enrollments: [{ type: 'student', computed_current_score: 91 }],
      },
      // not a student there
      { id: '4', enrollments: [{ type: 'teacher' }] },
      { id: '5' },
    ]);
    expect(scores.size).toBe(0);
  });

  it('takes the student enrollment among several', () => {
    const scores = currentScores([
      {
        id: '1',
        enrollments: [
          { type: 'ta' },
          { type: 'student', computed_current_score: 70 },
        ],
      },
    ]);
    expect(scores.get('1')).toBe(70);
  });
});

describe('formatScore', () => {
  it('shows up to two decimals, as Canvas does', () => {
    expect(formatScore(89.67, 'en')).toBe('89.67%');
    expect(formatScore(70, 'en')).toBe('70%');
    expect(formatScore(94.785, 'en')).toBe('94.79%');
  });

  it("follows the page's language", () => {
    expect(formatScore(89.67, 'de')).toBe('89,67 %');
  });
});
