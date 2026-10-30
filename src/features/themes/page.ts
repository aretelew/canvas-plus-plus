import { readMirror, writeMirror } from '@/core/page-mirror';
import { startRecolor, stopRecolor } from './recolor';
import {
  resolveTheme,
  type Theme,
  type ThemeChoice,
  themeChoice,
} from './storage';

// a copy of the theme chosen in the page's localStorage, so it's dark from the
// first paint (see page-mirror.ts)
const MIRROR_KEY = 'canvas++:theme';

// A same-origin frame with no URL of its own was written by Canvas's scripts,
// like the Rich Content Editor's (TinyMCE): its body is the user's content,
// saved as it's shown, so tags would end up in their posts. It gets the static
// page colors only.
const writtenByScript = window.frameElement?.hasAttribute('src') === false;

export async function syncThemeToPage(): Promise<void> {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  let choice = mirroredChoice();
  const apply = () => {
    applyTheme(resolveTheme(choice, systemDark.matches));
  };
  const update = (next: ThemeChoice) => {
    choice = next;
    apply();
    writeMirror(MIRROR_KEY, next === 'off' ? undefined : next);
  };

  systemDark.addEventListener('change', apply);
  // document.open() (how TinyMCE writes its frame) replaces <html>, theme
  // attribute and all
  new MutationObserver(apply).observe(document, { childList: true });
  apply();
  update(await themeChoice.getValue());
  themeChoice.watch(update);
}

function applyTheme(theme: Theme | undefined): void {
  const root = document.documentElement;
  if (theme) {
    root.dataset.cppTheme = theme;
    if (!writtenByScript) startRecolor();
  } else {
    delete root.dataset.cppTheme;
    stopRecolor();
  }
}

// The copy is the choice, not the theme it gave, so the first paint checks the
// system as it is now.
function mirroredChoice(): ThemeChoice {
  const value = readMirror(MIRROR_KEY);
  return value === 'dark' || value === 'oled' || value === 'system'
    ? value
    : 'off';
}
