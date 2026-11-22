import { storage } from '#imports';
import type { Cutoff } from './breakdown';

export const cardGrades = storage.defineItem<boolean>('sync:cardGrades', {
  fallback: false,
});

export const gradeBreakdown = storage.defineItem<boolean>(
  'sync:gradeBreakdown',
  { fallback: false },
);

/**
 * The letter scale the student set for their school, by Canvas site (its
 * host), for courses with only Canvas's default scale or none (scale.ts).
 */
export const schoolScales = storage.defineItem<Record<string, Cutoff[]>>(
  'sync:schoolScales',
  { fallback: {} },
);

/**
 * The letter scale the student set for a course, by the course on its Canvas
 * site ("school.instructure.com/courses/123"), before any other (scale.ts).
 */
export const courseScales = storage.defineItem<Record<string, Cutoff[]>>(
  'sync:courseScales',
  { fallback: {} },
);

// On from the start: it only takes away room nothing in the table uses.
export const tidyGradesTable = storage.defineItem<boolean>(
  'sync:tidyGradesTable',
  { fallback: true },
);
