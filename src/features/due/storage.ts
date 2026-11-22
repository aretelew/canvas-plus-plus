import { storage } from '#imports';

// On from the start: it only adds how long is left beside a due date.
export const timeUntilDue = storage.defineItem<boolean>('sync:timeUntilDue', {
  fallback: true,
});
