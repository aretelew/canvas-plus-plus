import { storage } from '#imports';

export const quickSearch = storage.defineItem<boolean>('sync:quickSearch', {
  fallback: false,
});
