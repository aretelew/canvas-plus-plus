import { whenParsed } from './when-parsed';

/**
 * Runs `run` on the list of Canvas's global nav as soon as it's in the page.
 * The nav comes early in the document, so what's added to it is there before
 * the first paint instead of at the end of parsing. It has no Account button
 * when signed out, and then `run` never runs.
 */
export function whenNavMenu(run: (menu: Element) => void): void {
  const find = () =>
    document.getElementById('global_nav_profile_link')?.closest('ul');
  const menu = find();
  if (menu) {
    run(menu);
    return;
  }
  const observer = new MutationObserver(() => {
    const found = find();
    if (!found) return;
    observer.disconnect();
    run(found);
  });
  observer.observe(document, { childList: true, subtree: true });
  whenParsed(() => {
    observer.disconnect();
  });
}
