import { readMirror, writeMirror } from '@/core/page-mirror';
import { startRecolor, stopRecolor } from './recolor';
import { type Theme, watchTheme } from './storage';

// a copy of the theme in the page's localStorage, so it's dark from the first
// paint (see page-mirror.ts)
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
  apply(mirroredTheme());
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
  writeMirror(MIRROR_KEY, theme);
}

function mirroredTheme(): Theme | undefined {
  const value = readMirror(MIRROR_KEY);
  // copies from before OLED say '1', for dark
  if (value === undefined) return undefined;
  return value === 'oled' ? 'oled' : 'dark';
}
