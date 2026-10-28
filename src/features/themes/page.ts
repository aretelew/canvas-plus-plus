import { startRecolor, stopRecolor } from './recolor';
import { type Theme, watchTheme } from './storage';

// Extension storage is async, so on its own the first paint could beat it and
// flash light. The page's own localStorage is sync: we keep a copy there, apply
// it before the first paint, then reconcile with the real setting.
const MIRROR_KEY = 'canvas++:theme';

// A same-origin frame with no URL of its own was written by Canvas's scripts,
// like the Rich Content Editor's (TinyMCE): its body is the user's content,
// saved as it's shown, so tags would end up in their posts. It gets the static
// page colors only.
const writtenByScript = window.frameElement?.hasAttribute('src') === false;

let theme: Theme | undefined;

export async function syncThemeToPage(): Promise<void> {
  // document.open() (how TinyMCE writes its frame) replaces <html>, theme
  // attribute and all
  new MutationObserver(() => {
    apply(theme);
  }).observe(document, { childList: true });
  apply(readMirror());
  await watchTheme(apply);
}

function apply(next: Theme | undefined): void {
  theme = next;
  const root = document.documentElement;
  if (theme) {
    root.dataset.cppTheme = theme;
    if (!writtenByScript) startRecolor();
  } else {
    delete root.dataset.cppTheme;
    stopRecolor();
  }
  writeMirror(theme);
}

// localStorage throws when the site's storage is blocked; then we just lose the
// instant first paint and fall back to the async setting.
function readMirror(): Theme | undefined {
  try {
    const value = localStorage.getItem(MIRROR_KEY);
    // copies from before OLED say '1', for dark
    if (value === null) return undefined;
    return value === 'oled' ? 'oled' : 'dark';
  } catch {
    return undefined;
  }
}

function writeMirror(theme: Theme | undefined): void {
  try {
    if (theme) localStorage.setItem(MIRROR_KEY, theme);
    else localStorage.removeItem(MIRROR_KEY);
  } catch {
    // see readMirror
  }
}
