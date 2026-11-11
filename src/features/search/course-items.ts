import { canvasJson } from '@/core/canvas-api';
import { loadPageTexts, pageKey, searchText, type PageRef } from './texts';

// Every assignment and module item in the given courses, and their latest
// announcements and discussions, with what each says: two GraphQL requests,
// where the REST API would take a few a course, and one for each module page
// that's changed (texts.ts). Quizzes and graded discussions are assignments
// too.

export interface CourseAssignment {
  id: string;
  courseId: string;
  name: string;
  // a path on this site
  url: string;
  // ISO, when it's due for this user; none when it has no due date
  due?: string;
  // its description, without its markup, cut short; none when it has none
  text?: string;
}

/** A page, file, link and so on in a course's modules; never a heading. */
export interface ModuleItem {
  courseId: string;
  title: string;
  // its module's name
  module: string;
  // a path on this site: its place in the module, which is how the modules
  // page opens it, a link to another site included
  url: string;
  // a page's text, cut short; none for anything else
  text?: string;
}

/** An announcement, or a discussion that isn't graded. */
export interface CoursePost {
  id: string;
  courseId: string;
  kind: 'announcement' | 'discussion';
  title: string;
  // a path on this site
  url: string;
  // ISO, when it was posted
  posted?: string;
  // what it says, without its markup, cut short; none when it says nothing
  text?: string;
}

export interface CourseItems {
  assignments: CourseAssignment[];
  moduleItems: ModuleItem[];
  // newest first
  posts: CoursePost[];
}

interface AssignmentNode {
  _id: string;
  name: string;
  dueAt: string | null;
  htmlUrl: string | null;
  // HTML
  description: string | null;
  // a quiz's assignment names its quiz, which module items point at instead
  quiz: { _id: string } | null;
}

interface ModuleNode {
  name: string | null;
  position: number | null;
  moduleItems: ItemNode[] | null;
}

interface ItemNode {
  title: string | null;
  url: string | null;
  content: Content | null;
}

// what a module item is; a discussion's assignment is there when it's graded
type Content =
  | { __typename: 'Assignment' | 'Quiz'; _id: string }
  | {
      __typename: 'Discussion';
      _id: string;
      assignment: { _id: string } | null;
    }
  | { __typename: 'Page'; _id: string; updatedAt: string | null }
  | { __typename: 'File' | 'ExternalUrl' | 'SubHeader' };

interface PostNode {
  _id: string;
  title: string | null;
  // HTML
  message: string | null;
  // none for some discussions
  postedAt: string | null;
  createdAt: string | null;
  published: boolean;
  // graded discussions only
  assignment?: { _id: string } | null;
}

// a course, as each request answers for it
interface ItemsNode {
  assignmentsConnection: { nodes: AssignmentNode[] };
  modulesConnection: { nodes: ModuleNode[] } | null;
}

interface PostsNode {
  announcements: { nodes: PostNode[] } | null;
  discussions: { nodes: PostNode[] } | null;
}

// About a term's worth for a course that posts a few a week, which is little
// to keep: a typical one says a few hundred characters.
const POSTS = 50;

// Without `gradingPeriodId: null`, a course with grading periods lists only
// the current one's. A page holds at most 100, which nearly every course fits;
// a module's items all come at once.
const ITEMS = `fragment Items on Course {
  assignmentsConnection(first: 100, filter: { gradingPeriodId: null }) {
    nodes { _id name dueAt htmlUrl description quiz { _id } }
  }
  modulesConnection(first: 100) {
    nodes {
      name
      position
      moduleItems {
        title
        url
        content {
          __typename
          ... on Assignment { _id }
          ... on Quiz { _id }
          ... on Discussion { _id assignment { _id } }
          ... on Page { _id updatedAt }
        }
      }
    }
  }
}`;

// Announcements come newest first, and discussions oldest first, so it's the
// last of those.
const POSTS_FRAGMENT = `fragment Posts on Course {
  announcements: discussionsConnection(
    first: ${String(POSTS)}
    filter: { isAnnouncement: true }
  ) {
    nodes { ...Post }
  }
  discussions: discussionsConnection(
    last: ${String(POSTS)}
    filter: { isAnnouncement: false }
  ) {
    nodes { ...Post assignment { _id } }
  }
}
fragment Post on Discussion { _id title message postedAt createdAt published }`;

const NONE: CourseItems = { assignments: [], moduleItems: [], posts: [] };

/**
 * None for a course a request fails for. The posts are asked for on their
 * own, at the same time: they take longest, and a Canvas too old to filter
 * announcements fails only that request. The pages' text is asked for once
 * the items are in, while the posts may still be coming. `who` is whose
 * pages' text is saved.
 */
export async function loadCourseItems(
  who: string,
  courseIds: string[],
): Promise<CourseItems> {
  if (courseIds.length === 0) return NONE;
  const [{ items, texts }, posts] = await Promise.all([
    itemsWithPageTexts(who, courseIds),
    queryCourses<PostsNode>('SearchPosts', 'Posts', POSTS_FRAGMENT, courseIds),
  ]);
  const courses = courseIds.map((courseId, i) =>
    itemsOf(courseId, items[i], posts[i], texts),
  );
  return {
    assignments: courses.flatMap(({ assignments }) => assignments),
    moduleItems: courses.flatMap(({ moduleItems }) => moduleItems),
    posts: courses
      .flatMap(({ posts }) => posts)
      .sort((a, b) => postedAt(b) - postedAt(a)),
  };
}

// The items, then the text of the pages among them. When the items can't be
// had, the pages' saved text is left as it is, rather than saved as none.
async function itemsWithPageTexts(who: string, courseIds: string[]) {
  const items = await queryCourses<ItemsNode>(
    'SearchItems',
    'Items',
    ITEMS,
    courseIds,
  );
  const texts = items.some((course) => course !== undefined)
    ? await loadPageTexts(who, pagesIn(courseIds, items))
    : new Map<string, string>();
  return { items, texts };
}

// Each course's answer, in the order asked: one request, each course under an
// alias, its id a variable rather than in the query. None for a course it
// fails for, or for all of them when the request does.
async function queryCourses<T>(
  name: string,
  fragment: string,
  fragments: string,
  courseIds: string[],
): Promise<(T | undefined)[]> {
  const alias = (index: number) => `c${String(index)}`;
  const params = courseIds.map((_, i) => `$${alias(i)}: ID!`).join(', ');
  const query = [
    `query ${name}(${params}) {`,
    ...courseIds.map(
      (_, i) => `  ${alias(i)}: course(id: $${alias(i)}) { ...${fragment} }`,
    ),
    '}',
    fragments,
  ].join('\n');
  const variables = Object.fromEntries(
    courseIds.map((id, i) => [alias(i), id]),
  );
  const response = await canvasJson<{
    data?: Record<string, T | null | undefined>;
  }>('/api/graphql', { method: 'POST', json: { query, variables } });
  return courseIds.map((_, i) => response?.data?.[alias(i)] ?? undefined);
}

// the pages in the courses' modules, each course's in the order asked
function pagesIn(
  courseIds: string[],
  items: (ItemsNode | undefined)[],
): PageRef[] {
  return courseIds.flatMap((courseId, i) =>
    (items[i]?.modulesConnection?.nodes ?? []).flatMap(({ moduleItems }) =>
      (moduleItems ?? []).flatMap(({ content }) =>
        content?.__typename === 'Page'
          ? {
              courseId,
              id: content._id,
              updatedAt: content.updatedAt ?? undefined,
            }
          : [],
      ),
    ),
  );
}

// One course's: its assignments, its posts, and its module items but those
// listed as one of them.
function itemsOf(
  courseId: string,
  items: ItemsNode | undefined,
  course: PostsNode | undefined,
  texts: Map<string, string>,
): CourseItems {
  const nodes = items?.assignmentsConnection.nodes ?? [];
  const posts = [
    ...postsOf(courseId, 'announcement', course?.announcements),
    ...postsOf(courseId, 'discussion', course?.discussions),
  ];
  return {
    assignments: assignmentsOf(courseId, nodes),
    moduleItems: moduleItemsOf(
      courseId,
      items?.modulesConnection?.nodes ?? [],
      listedIn(nodes, posts),
      texts,
    ),
    posts,
  };
}

function assignmentsOf(
  courseId: string,
  nodes: AssignmentNode[],
): CourseAssignment[] {
  return nodes.flatMap(({ _id, name, dueAt, htmlUrl, description }) => {
    const url = pathOnThisSite(htmlUrl);
    if (!url) return [];
    return {
      id: _id,
      courseId,
      name,
      url,
      due: dueAt ?? undefined,
      text: searchText(description ?? '') || undefined,
    };
  });
}

// They come in module name order, so they're put in module order. A page has
// its text from `texts`.
function moduleItemsOf(
  courseId: string,
  modules: ModuleNode[],
  isListed: (content: Content) => boolean,
  texts: Map<string, string>,
): ModuleItem[] {
  return modules
    .toSorted((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .flatMap(({ name, moduleItems }) =>
      (moduleItems ?? []).flatMap(({ title, url, content }) => {
        const path = pathOnThisSite(url);
        if (!title || !path || content?.__typename === 'SubHeader') return [];
        if (content && isListed(content)) return [];
        return {
          courseId,
          title,
          module: name ?? '',
          url: path,
          text:
            content?.__typename === 'Page'
              ? texts.get(pageKey(courseId, content._id))
              : undefined,
        };
      }),
    );
}

// The published ones, but graded discussions, which are assignments.
function postsOf(
  courseId: string,
  kind: CoursePost['kind'],
  connection: { nodes: PostNode[] } | null | undefined,
): CoursePost[] {
  return (connection?.nodes ?? []).flatMap(
    ({ _id, title, message, postedAt, createdAt, published, assignment }) => {
      if (!title || !published || assignment) return [];
      return {
        id: _id,
        courseId,
        kind,
        title,
        url: `/courses/${courseId}/discussion_topics/${_id}`,
        posted: postedAt ?? createdAt ?? undefined,
        text: searchText(message ?? '') || undefined,
      };
    },
  );
}

// 0 for an undated post, so it goes last
const postedAt = ({ posted }: CoursePost) =>
  posted === undefined ? 0 : Date.parse(posted);

// Whether an item's content is listed as one of these assignments or posts: a
// quiz is found by its quiz's id, and a graded discussion by its assignment's.
function listedIn(nodes: AssignmentNode[], posts: CoursePost[]) {
  const ids = new Set(nodes.map(({ _id }) => _id));
  const quizzes = new Set(nodes.flatMap(({ quiz }) => (quiz ? quiz._id : [])));
  const postIds = new Set(posts.map(({ id }) => id));
  return (content: Content): boolean => {
    switch (content.__typename) {
      case 'Assignment':
        return ids.has(content._id);
      case 'Quiz':
        return quizzes.has(content._id);
      case 'Discussion':
        return content.assignment === null
          ? postIds.has(content._id)
          : ids.has(content.assignment._id);
      default:
        return false;
    }
  };
}

// GraphQL gives full URLs; only this site's are kept, as a path
function pathOnThisSite(url: string | null): string | undefined {
  if (!url) return undefined;
  const parsed = new URL(url, location.origin);
  return parsed.origin === location.origin
    ? parsed.pathname + parsed.search
    : undefined;
}
