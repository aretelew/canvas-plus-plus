import { storage } from '#imports';

export const courseNav = storage.defineItem<boolean>('sync:courseNav', {
  fallback: false,
});
