import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Chrome for Testing, because it still allows --load-extension and never
// auto-updates (so screenshots only change when we change). Uses
// $CHROME_PATH, else the newest build agent-browser installed.
export function chromePath(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const dir = join(homedir(), '.agent-browser/browsers');
  const newest = existsSync(dir)
    ? readdirSync(dir)
        .filter((d) => d.startsWith('chrome-'))
        .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
        .at(-1)
    : undefined;
  if (!newest) {
    throw new Error(
      'No Chrome for Testing found: set CHROME_PATH or run `agent-browser install`',
    );
  }
  return join(
    dir,
    newest,
    'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  );
}
