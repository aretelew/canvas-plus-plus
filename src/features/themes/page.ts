import { readMirror, writeMirror } from '@/core/page-mirror';
import { startRecolor, stopRecolor } from './recolor';
import {
  resolveTheme,
  type Theme,
  type ThemeSettings,
  watchThemeSettings,
} from './storage';

// a copy of the theme settings in the page's localStorage, so it's dark from
// the first paint (see page-mirror.ts)
const MIRROR_KEY = 'canvas++:theme';

const OFF: ThemeSettings = { mode: 'off', oled: false };

// A same-origin frame with no URL of its own was written by Canvas's scripts,
// like the Rich Content Editor's (TinyMCE): its body is the user's content,
// saved as it's shown, so tags would end up in their posts. It gets the static
// page colors only.
const writtenByScript = window.frameElement?.hasAttribute('src') === false;

export async function syncThemeToPage(): Promise<void> {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  let settings = mirroredSettings();
  const apply = () => {
    applyTheme(resolveTheme(settings, systemDark.matches));
  };
  const update = (next: ThemeSettings) => {
    settings = next;
    apply();
    writeMirror(MIRROR_KEY, mirrorValue(settings));
  };

  systemDark.addEventListener('change', apply);
  // document.open() (how TinyMCE writes its frame) replaces <html>, theme
  // attribute and all
  new MutationObserver(apply).observe(document, { childList: true });
  apply();
  await watchThemeSettings(update);
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

// The copy is the theme, prefixed `system-` while it follows the system, so
// the first paint checks the system as it is now.
function mirrorValue({ mode, oled }: ThemeSettings): string | undefined {
  if (mode === 'off') return undefined;
  const theme = oled ? 'oled' : 'dark';
  return mode === 'system' ? `system-${theme}` : theme;
}

function mirroredSettings(): ThemeSettings {
  const value = readMirror(MIRROR_KEY);
  if (value === undefined) return OFF;
  // copies from before OLED say '1', for dark
  return {
    mode: value.startsWith('system-') ? 'system' : 'on',
    oled: value.endsWith('oled'),
  };
}
