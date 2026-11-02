import { readMirror, writeMirror } from './page-mirror';

// What a feature keeps in the page's localStorage for the signed-in user. It's
// saved with whose it is, since people share computers, and when, so it can be
// asked for again once it's old.

interface Saved<T> {
  who: string;
  at: number;
  value: T;
}

export interface SavedForUser<T> {
  /** What's saved for this user, and whether it's newer than the max age. */
  read(who: string, now: number): { value: T; fresh: boolean } | undefined;
  write(who: string, value: T, now: number): void;
  clear(): void;
}

export function savedForUser<T>(
  key: string,
  maxAge = Infinity,
): SavedForUser<T> {
  return {
    read(who, now) {
      try {
        const saved = JSON.parse(readMirror(key) ?? 'null') as Saved<T> | null;
        // an older version saved it in another shape, without `value`
        if (saved?.who !== who || saved.value === undefined) return undefined;
        return { value: saved.value, fresh: now - saved.at < maxAge };
      } catch {
        return undefined;
      }
    },
    write(who, value, now) {
      const saved: Saved<T> = { who, at: now, value };
      writeMirror(key, JSON.stringify(saved));
    },
    clear() {
      writeMirror(key, undefined);
    },
  };
}

/** The signed-in user's name, from their avatar in the global nav. */
export function userName(): string {
  const avatar = document.querySelector<HTMLImageElement>(
    '#global_nav_profile_link img',
  );
  return avatar?.alt ?? '';
}
