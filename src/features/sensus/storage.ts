import { storage } from '#imports';

export const hideSensus = storage.defineItem<boolean>('sync:hideSensus', {
  fallback: false,
});
