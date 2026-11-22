import { storage } from '#imports';
import type { Due, Reminders } from './schedule';

// The switch is the browser's permission to show notifications, which the
// background keeps this in step with: null while it isn't granted, so content
// scripts (which can't ask about permissions) know to list nothing. On this
// device only, like the permission.
export const reminders = storage.defineItem<Reminders | null>(
  'local:reminders',
  { fallback: null },
);

export const PERMISSION = 'notifications';

/** A content script's message with its site's upcoming work. */
export interface WorksMessage {
  type: 'canvas++:works';
  works: Due[];
}
