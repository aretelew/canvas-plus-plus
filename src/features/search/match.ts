// How the search box finds things: every word typed has to start a word of
// what's listed, or else appear in it somewhere, so "chem gr" finds CHEM 105's
// Grades. What's named by the words comes first, then what's in a course they
// name, then what only contains them. Last comes what's found only by what it
// says, like an announcement that mentions the words: there, a word typed has
// to start one of its words, so "lab" doesn't find "available".

/** What something listed is, which its icon shows. */
export type Kind =
  | 'course'
  // a place in a course's menu, or one of Canvas's own pages
  | 'section'
  | 'group'
  | 'assignment'
  | 'quiz'
  | 'discussion'
  | 'announcement'
  | 'page'
  | 'file'
  // a link to another site, or a tool Canvas opens
  | 'link';

/** Something the search box lists. */
export interface Entry {
  title: string;
  href: string;
  kind: Kind;
  // its course or group, shown after the title
  where?: string;
  // more it's found by without showing it, like a course's full name
  also?: string[];
  color?: string;
  // work only: when it's due (ISO), so how it reads stays current
  due?: string;
  // posts only: when it was posted (ISO)
  posted?: string;
  // what it says, searched after the rest
  text?: string;
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
    .flatMap((entry, index) => {
      const match = score(entry, typed, words);
      return match ? { entry, index, ...match } : [];
    })
    .sort(
      (a, b) =>
        Number(a.byText) - Number(b.byText) ||
        b.score - a.score ||
        a.index - b.index,
    )
    .map(({ entry }) => entry);
}

// An entry's fields, lowercased and split into words once, not again for
// every letter typed: there's a lot of text to go through.
interface Field {
  text: string;
  words: string[];
}

interface Prepared {
  title: Field;
  others: Field[];
  // what it says needs only its words, each once
  said: string[];
}

const prepared = new WeakMap<Entry, Prepared>();

function prepare(entry: Entry): Prepared {
  let ready = prepared.get(entry);
  if (!ready) {
    ready = {
      title: field(entry.title),
      others: [entry.where, ...(entry.also ?? [])]
        .filter((other) => other !== undefined)
        .map(field),
      said: [...new Set(field(entry.text ?? '').words)],
    };
    prepared.set(entry, ready);
  }
  return ready;
}

function field(raw: string): Field {
  const text = normalize(raw);
  return { text, words: text.split(/[^\p{L}\p{N}]+/u) };
}

// Undefined when a word typed isn't in it at all. A word found only in what it
// says scores nothing, and the match is marked to go after the rest.
function score(
  entry: Entry,
  typed: string,
  words: string[],
): { score: number; byText: boolean } | undefined {
  const { title, others, said } = prepare(entry);
  let total = title.text.startsWith(typed) ? TITLE_START : 0;
  let byText = false;
  for (const word of words) {
    const best = Math.max(
      found(title, word, TITLE_WORD, TITLE_PART),
      ...others.map((other) => found(other, word, WORD, PART)),
    );
    if (best > 0) total += best;
    else if (said.some((part) => part.startsWith(word))) byText = true;
    else return undefined;
  }
  return { score: total, byText };
}

function found(
  { text, words }: Field,
  word: string,
  starting: number,
  inside: number,
): number {
  if (words.some((part) => part.startsWith(word))) return starting;
  return text.includes(word) ? inside : 0;
}

// lowercase, without accents, so "resume" finds "Résumé"
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
