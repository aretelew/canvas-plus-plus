import { storage } from '#imports';

export const courseNav = storage.defineItem<boolean>('sync:courseNav', {
  fallback: false,
});

// The sidebar's narrowest, and first, width: its bottom bar's four 46px cells.
// 184px also keeps the dashboard's three cards at a 1440px window.
export const NAV_MIN_WIDTH = 184;

// The sidebar's width in px, set by dragging its edge. Per device, since it
// depends on the screen.
export const navWidth = storage.defineItem<number>('local:navWidth', {
  fallback: NAV_MIN_WIDTH,
});
