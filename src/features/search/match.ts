// How the search box finds things: every word typed has to start a word of
// what's listed, or else appear in it somewhere, so "chem gr" finds CHEM 105's
// Grades. What's named by the words comes first, then what's in a course they
// name, then what only contains them.

/** Something the search box lists. */
export interface Entry {
  title: string;
  href: string;
  // its course or group, shown after the title
  where?: string;
  // more it's found by without showing it, like a course's full name
  also?: string[];
  color?: string;
  // work only: when it's due (ISO), so how it reads stays current
  due?: string;
  // listed before anything is typed
  start?: boolean;
}

// what a word typed scores for where it's found, best first
const TITLE_WORD = 4;
const WORD = 3;
const TITLE_PART = 2;
const PART = 1;
// for a title that starts with all of what's typed
const TITLE_START = 2;

/**
 * The entries matching `query`, best first; ties keep the entries' order. With
 * nothing typed, the ones marked to start with.
 */
export function search(entries: Entry[], query: string): Entry[] {
  const typed = normalize(query).trim();
  if (!typed) return entries.filter((entry) => entry.start);
  const words = typed.split(/\s+/);
  return entries
    .map((entry, index) => ({
      entry,
      index,
      score: score(entry, typed, words),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ entry }) => entry);
}

// 0 when a word typed isn't in it at all
function score(entry: Entry, typed: string, words: string[]): number {
  const title = normalize(entry.title);
  const others = [entry.where, ...(entry.also ?? [])]
    .filter((field) => field !== undefined)
    .map(normalize);
  let total = title.startsWith(typed) ? TITLE_START : 0;
  for (const word of words) {
    const best = Math.max(
      found(title, word, TITLE_WORD, TITLE_PART),
      ...others.map((field) => found(field, word, WORD, PART)),
    );
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

function found(
  field: string,
  word: string,
  starting: number,
  inside: number,
): number {
  if (field.split(/[^\p{L}\p{N}]+/u).some((part) => part.startsWith(word))) {
    return starting;
  }
  return field.includes(word) ? inside : 0;
}

// lowercase, without accents, so "resume" finds "Résumé"
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
