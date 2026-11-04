import { storage } from '#imports';

export const timeUntilDue = storage.defineItem<boolean>('sync:timeUntilDue', {
  fallback: false,
});
