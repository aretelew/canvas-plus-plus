import { storage } from '#imports';

export const cardAssignments = storage.defineItem<boolean>(
  'sync:cardAssignments',
  { fallback: false },
);
