// Extension storage is async, so on its own the first paint could beat a
// setting that changes how the page looks. The page's own localStorage is
// sync: a feature keeps a copy of its setting there, applies it before the
// first paint, then reconciles with the real setting.

// localStorage throws when the site's storage is blocked; then the feature just
// loses the instant first paint and falls back to the async setting.
export function readMirror(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Removes the copy when `value` is undefined. */
export function writeMirror(key: string, value: string | undefined): void {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // see readMirror
  }
}
