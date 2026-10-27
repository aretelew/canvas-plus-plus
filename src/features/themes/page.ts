import { startRecolor, stopRecolor } from './recolor';
import { themeEnabled } from './storage';

// Extension storage is async, so on its own the first paint could beat it and
// flash light. The page's own localStorage is sync: we keep a copy there, apply
// it before the first paint, then reconcile with the real setting.
const MIRROR_KEY = 'canvas++:theme';

export async function syncThemeToPage(): Promise<void> {
  apply(readMirror());
  apply(await themeEnabled.getValue());
  themeEnabled.watch(apply);
}

function apply(enabled: boolean): void {
  const root = document.documentElement;
  if (enabled) {
    root.dataset.cppTheme = 'dark';
    startRecolor();
  } else {
    delete root.dataset.cppTheme;
    stopRecolor();
  }
  writeMirror(enabled);
}

// localStorage throws when the site's storage is blocked; then we just lose the
// instant first paint and fall back to the async setting.
function readMirror(): boolean {
  try {
    return localStorage.getItem(MIRROR_KEY) !== null;
  } catch {
    return false;
  }
}

function writeMirror(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(MIRROR_KEY, '1');
    else localStorage.removeItem(MIRROR_KEY);
  } catch {
    // see readMirror
  }
}
