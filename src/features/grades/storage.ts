import { storage } from '#imports';

export const cardGrades = storage.defineItem<boolean>('sync:cardGrades', {
  fallback: false,
});
