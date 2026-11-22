import { storage } from '#imports';

export const cardGrades = storage.defineItem<boolean>('sync:cardGrades', {
  fallback: false,
});

export const gradeBreakdown = storage.defineItem<boolean>(
  'sync:gradeBreakdown',
  { fallback: false },
);

export const tidyGradesTable = storage.defineItem<boolean>(
  'sync:tidyGradesTable',
  { fallback: false },
);
