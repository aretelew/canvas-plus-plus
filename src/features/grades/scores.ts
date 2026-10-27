// The parts of GET /api/v1/courses?include[]=total_scores
// &include[]=current_grading_period_scores&include[]=restrict_quantitative_data
// that the card grades use, with ids as strings (Accept:
// application/json+canvas-string-ids). Canvas leaves the score fields out when
// a course hides its totals from students.
export interface Course {
  id: string;
  // the teacher shows students letter grades instead of percentages
  restrict_quantitative_data?: boolean;
  enrollments?: Enrollment[];
}

interface Enrollment {
  type: string;
  has_grading_periods?: boolean;
  computed_current_score?: number | null;
  current_period_computed_current_score?: number | null;
}

/**
 * Each course's current score (a percentage) by course id, for courses the
 * user is a student in that have one to show. In a course with grading
 * periods it's the current period's score, as Canvas's own grades pages show.
 * A course that hides percentages from students has none to show.
 */
export function currentScores(courses: Course[]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const { id, restrict_quantitative_data, enrollments = [] } of courses) {
    if (restrict_quantitative_data) continue;
    const score = enrollments
      .filter((e) => e.type === 'student')
      .map((e) =>
        e.has_grading_periods
          ? e.current_period_computed_current_score
          : e.computed_current_score,
      )
      .find((s) => s != null);
    if (score != null) scores.set(id, score);
  }
  return scores;
}

/** A score as Canvas shows it: up to two decimals, like "89.67%". */
export function formatScore(score: number, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 2,
  }).format(score / 100);
}
