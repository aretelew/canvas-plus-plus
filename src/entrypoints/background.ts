import { syncRegistration, themeOpenTabs } from '@/features/domains/domains';

export default defineBackground(() => {
  // Both browsers drop runtime registrations when the extension updates, and
  // checking on startup costs next to nothing.
  browser.runtime.onInstalled.addListener(() => {
    void syncRegistration();
  });
  browser.runtime.onStartup.addListener(() => {
    void syncRegistration();
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
