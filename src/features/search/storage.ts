import { storage } from '#imports';

// On from the start, unlike the other features: it changes nothing on the
// page until it's opened, and it's how people find what canvas++ lists.
export const quickSearch = storage.defineItem<boolean>('sync:quickSearch', {
  fallback: true,
});
