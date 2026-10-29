import { storage } from '#imports';

export const hideFooter = storage.defineItem<boolean>('sync:hideFooter', {
  fallback: false,
});
