import { storage } from '#imports';

export const hideLogo = storage.defineItem<boolean>('sync:hideLogo', {
  fallback: false,
});
