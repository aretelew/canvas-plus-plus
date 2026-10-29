import { readMirror, writeMirror } from '@/core/page-mirror';
import { hideLogo } from './storage';

// Hides the school's logo at the top of Canvas's global nav while the setting
// is on. A copy in the page's localStorage hides it from the first paint, so
// it doesn't show for a moment on every page load (see page-mirror.ts).
const MIRROR_KEY = 'canvas++:hide-logo';

export async function syncLogoToPage(): Promise<void> {
  apply(readMirror(MIRROR_KEY) !== undefined);
  apply(await hideLogo.getValue());
  hideLogo.watch(apply);
}

function apply(hidden: boolean): void {
  const root = document.documentElement;
  if (hidden) root.dataset.cppHideLogo = '';
  else delete root.dataset.cppHideLogo;
  writeMirror(MIRROR_KEY, hidden ? '1' : undefined);
}
