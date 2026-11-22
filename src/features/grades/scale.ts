// The letter scale the grade breakdown (sidebar.ts) gives the total and the
// predictions. A scale the student set for the course comes first: they set
// it on purpose, where a teacher's syllabus says other than Canvas. Then a
// scale the course's teacher chose in Canvas. Many courses carry only
// Canvas's default scale, which their teacher may never have chosen, or none,
// while the school sets its own cutoffs: there, the student's scale for their
// school stands in. Both of the student's are saved (storage.ts) and set from
// the breakdown's ⋯ menu (scale-editor.ts).

import type { Cutoff } from './breakdown';

/**
 * Where the scale in use comes from: the student's for the course, the
 * teacher's in Canvas, the student's for the school, or Canvas's default.
 */
export type ScaleSource = 'yours' | 'course' | 'school' | 'canvas';

/** What the student sets a scale for. */
export type ScaleScope = 'course' | 'school';

/** Whether the letters are the student's, not Canvas's. */
export const isStudents = (source: ScaleSource | undefined): boolean =>
  source === 'yours' || source === 'school';

export interface Scale {
  cutoffs: Cutoff[];
  source: ScaleSource;
}

/** A common scale to start the school's from. */
export interface Preset {
  name: string;
  cutoffs: Cutoff[];
}

const scale = (entries: [string, number][]): Cutoff[] =>
  entries.map(([name, percent]) => ({ name, value: percent / 100 }));

export const PRESETS: Preset[] = [
  {
    name: 'A–F',
    cutoffs: scale([
      ['A', 90],
      ['B', 80],
      ['C', 70],
      ['D', 60],
      ['F', 0],
    ]),
  },
  {
    name: 'A–F with +/−',
    cutoffs: scale([
      ['A', 93],
      ['A-', 90],
      ['B+', 87],
      ['B', 83],
      ['B-', 80],
      ['C+', 77],
      ['C', 73],
      ['C-', 70],
      ['D+', 67],
      ['D', 63],
      ['D-', 60],
      ['F', 0],
    ]),
  },
];

/** The course's scheme in Canvas, as its Grades page has it. */
export interface CourseScheme {
  /** its letters, or none for a scheme in points */
  cutoffs?: Cutoff[];
  /** it's Canvas's default, which the teacher didn't choose */
  isDefault: boolean;
}

/**
 * The scale to use: the student's for the course, else the course's own,
 * else the school's, else Canvas's default if the course has it. A course
 * with a scheme in points of its own gets none: the school's would
 * contradict it.
 */
export function chooseScale(
  course: CourseScheme | undefined,
  school: Cutoff[] | undefined,
  yours?: Cutoff[],
): Scale | undefined {
  if (yours) return { cutoffs: yours, source: 'yours' };
  if (course && !course.isDefault) {
    return course.cutoffs && { cutoffs: course.cutoffs, source: 'course' };
  }
  if (school) return { cutoffs: school, source: 'school' };
  return course?.cutoffs && { cutoffs: course.cutoffs, source: 'canvas' };
}

/**
 * Whether the cutoffs make a scale: named letters, highest first, each
 * strictly under the one above, from at most 100% down to 0% for the last.
 */
export function isScale(cutoffs: Cutoff[]): boolean {
  if (cutoffs.length < 2 || cutoffs.at(-1)?.value !== 0) return false;
  return cutoffs.every(
    (c, i) =>
      c.name.trim() !== '' &&
      Number.isFinite(c.value) &&
      c.value >= 0 &&
      c.value <= 1 &&
      (i === 0 || c.value < (cutoffs[i - 1]?.value ?? Infinity)),
  );
}
