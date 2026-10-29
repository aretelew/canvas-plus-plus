import { canvasJson } from './canvas-api';

// The user's active courses and the colors they gave them, asked for once per
// page by whatever needs them first (card grades, the sidebar's course labels).

// The parts of GET /api/v1/courses?include[]=total_scores
// &include[]=current_grading_period_scores&include[]=restrict_quantitative_data
// that are used, with ids as strings (Accept:
// application/json+canvas-string-ids). Canvas leaves the score fields out when
// a course hides its totals from students.
export interface Course {
  id: string;
  // the user's nickname for it if they gave one
  name?: string;
  course_code?: string;
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

// every active course fits in one page (per_page tops out at 100)
const COURSES =
  '/api/v1/courses?enrollment_state=active&include[]=total_scores&include[]=current_grading_period_scores&include[]=restrict_quantitative_data&per_page=100';

let courses: Promise<Course[]> | undefined;
let colors: Promise<Map<string, string>> | undefined;

/** None on a failed request; they're tried again on the next page load. */
export function loadCourses(): Promise<Course[]> {
  return (courses ??= canvasJson<Course[]>(COURSES).then((c) => c ?? []));
}

/** Each course's color by course id, as the user set it (or Canvas did). */
export function loadCourseColors(): Promise<Map<string, string>> {
  return (colors ??= canvasJson<{ custom_colors?: Record<string, string> }>(
    '/api/v1/users/self/colors',
  ).then((body) => {
    const byCourse = new Map<string, string>();
    for (const [code, color] of Object.entries(body?.custom_colors ?? {})) {
      const id = /^course_(\d+)$/.exec(code)?.[1];
      if (id !== undefined) byCourse.set(id, color);
    }
    return byCourse;
  }));
}
