import { startRecolor, stopRecolor } from './recolor';
import { themeEnabled } from './storage';

// Extension storage is async, so on its own the first paint could beat it and
// flash light. The page's own localStorage is sync: we keep a copy there, apply
// it before the first paint, then reconcile with the real setting.
const MIRROR_KEY = 'canvas++:theme';

// A same-origin frame with no URL of its own was written by Canvas's scripts,
// like the Rich Content Editor's (TinyMCE): its body is the user's content,
// saved as it's shown, so tags would end up in their posts. It gets the static
// page colors only.
const writtenByScript = window.frameElement?.hasAttribute('src') === false;

let enabled = false;

export async function syncThemeToPage(): Promise<void> {
  // document.open() (how TinyMCE writes its frame) replaces <html>, theme
  // attribute and all
  new MutationObserver(() => {
    apply(enabled);
  }).observe(document, { childList: true });
  apply(readMirror());
  apply(await themeEnabled.getValue());
  themeEnabled.watch(apply);
}

function apply(on: boolean): void {
  enabled = on;
  const root = document.documentElement;
  if (enabled) {
    root.dataset.cppTheme = 'dark';
    if (!writtenByScript) startRecolor();
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
