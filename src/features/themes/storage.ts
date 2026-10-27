import { storage } from '#imports';

export const themeEnabled = storage.defineItem<boolean>('sync:themeEnabled', {
  fallback: false,
});
