import { storage } from '#imports';

export const tidySidebar = storage.defineItem<boolean>('sync:tidySidebar', {
  fallback: false,
});
