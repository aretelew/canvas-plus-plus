import { canvasJson } from '@/core/canvas-api';
import { savedForUser } from '@/core/saved';
import { htmlText } from '@/core/text';

// What the search keeps of what things say, and the text of the pages in the
// courses' modules. Canvas's GraphQL has no page bodies, and a student usually
// can't list a course's pages, so each is asked for on its own. Its text is
// kept with when the page was last edited, so after that only the pages that
// changed are asked for again.

// what's kept of what something says; most say far less, and a long page is
// mostly found by its start
const MAX_TEXT = 6000;

/** What some HTML says, without its markup, cut short. */
export const searchText = (html: string): string =>
  htmlText(html).slice(0, MAX_TEXT);

/** A page in a module, and when it was last edited (ISO). */
export interface PageRef {
  courseId: string;
  id: string;
  updatedAt: string | undefined;
}

/** How a page's text is found in what loadPageTexts gives. */
export const pageKey = (courseId: string, id: string) => `${courseId}/${id}`;

interface SavedText {
  updatedAt: string;
  text: string;
}

// the current pages only, so one that's gone is dropped
const savedTexts = savedForUser<Record<string, SavedText>>(
  'canvas++:search-pages',
);

/** What's saved goes, as when the search is turned off. */
export const clearPageTexts = () => {
  savedTexts.clear();
};

// asked for at a time, so a course with many pages isn't asked for all at once
const AT_ONCE = 6;

interface PageJson {
  body: string | null;
  locked_for_user?: boolean;
}

/**
 * Each page's text, by pageKey: what's saved for one that hasn't changed, and
 * asked for otherwise. None for a page that can't be read or says nothing.
 */
export async function loadPageTexts(
  who: string,
  pages: PageRef[],
): Promise<Map<string, string>> {
  const saved = savedTexts.read(who, Date.now())?.value ?? {};
  const kept: Record<string, SavedText> = {};
  const texts = new Map<string, string>();
  const changed = new Map<string, PageRef>();
  for (const page of pages) {
    const key = pageKey(page.courseId, page.id);
    const was = saved[key];
    if (was && was.updatedAt === page.updatedAt) {
      kept[key] = was;
      if (was.text) texts.set(key, was.text);
    } else changed.set(key, page);
  }
  await atOnce([...changed], async ([key, { courseId, id, updatedAt }]) => {
    const page = await canvasJson<PageJson>(
      `/api/v1/courses/${courseId}/pages/${id}`,
    );
    // a locked page's body explains the lock
    if (!page || page.locked_for_user) return;
    const text = searchText(page.body ?? '');
    if (text) texts.set(key, text);
    // without its edit time, it can't be told apart from a later version
    if (updatedAt !== undefined) kept[key] = { updatedAt, text };
  });
  savedTexts.write(who, kept, Date.now());
  return texts;
}

// `run` for each item, AT_ONCE of them at a time
async function atOnce<T>(
  items: T[],
  run: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    for (let item = items[next++]; item !== undefined; item = items[next++]) {
      await run(item);
    }
  };
  await Promise.all(Array.from({ length: AT_ONCE }, worker));
}
