/**
 * Whether the current document is a Canvas page: Canvas's app shell, or its
 * brand stylesheet (which its login page has too). Injected into the tab by
 * the popup, so it must be self-contained.
 */
export function looksLikeCanvas(): boolean {
  return (
    document.querySelector(
      '#application.ic-app, link[href*="/dist/brandable_css/"]',
    ) !== null
  );
}
