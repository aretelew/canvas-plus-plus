import { reloadWhenDevServerReturns } from '@/core/dev-server';
import {
  startOnOpenTabs,
  syncRegistration,
  themeOpenTabs,
} from '@/features/domains/domains';
import { startReminders, syncReminders } from '@/features/reminders/background';

export default defineBackground(() => {
  if (import.meta.env.COMMAND === 'serve') reloadWhenDevServerReturns();
  startReminders();
  // Both browsers drop runtime registrations when the extension updates, and
  // checking on startup costs next to nothing.
  browser.runtime.onInstalled.addListener(({ reason }) => {
    void syncRegistration();
    void syncReminders();
    if (reason === 'install') void startOnOpenTabs();
  });
  browser.runtime.onStartup.addListener(() => {
    void syncRegistration();
    void syncReminders();
  });
  // Granted from the popup or the browser's own site-access menu. The popup
  // may already be closed by then (Firefox closes it for the prompt), so the
  // background does the work.
  browser.permissions.onAdded.addListener(({ origins = [] }) => {
    void syncRegistration().then(() => themeOpenTabs(origins));
  });
  browser.permissions.onRemoved.addListener(() => {
    void syncRegistration();
  });
});
