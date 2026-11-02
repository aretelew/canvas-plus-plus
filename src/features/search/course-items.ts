import { canvasJson } from '@/core/canvas-api';

// Every assignment and module item in the given courses, from one GraphQL
// request: the REST API would take one a course for each. Quizzes and graded
// discussions are assignments too.

export interface CourseAssignment {
  id: string;
  courseId: string;
  name: string;
  // a path on this site
  url: string;
  // ISO, when it's due for this user; none when it has no due date
  due?: string;
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
}

export interface CourseItems {
  assignments: CourseAssignment[];
  moduleItems: ModuleItem[];
}

interface AssignmentNode {
  _id: string;
  name: string;
  dueAt: string | null;
  htmlUrl: string | null;
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
  | { __typename: 'Discussion'; assignment: { _id: string } | null }
  | { __typename: 'Page' | 'File' | 'ExternalUrl' | 'SubHeader' };

interface CourseNode {
  assignmentsConnection: { nodes: AssignmentNode[] };
  modulesConnection: { nodes: ModuleNode[] } | null;
}

type Response = { data?: Record<string, CourseNode | null | undefined> };

// Without `gradingPeriodId: null`, a course with grading periods lists only
// the current one's. A page holds at most 100, which nearly every course fits;
// a module's items all come at once.
const FRAGMENT = `fragment Items on Course {
  assignmentsConnection(first: 100, filter: { gradingPeriodId: null }) {
    nodes { _id name dueAt htmlUrl quiz { _id } }
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
          ... on Discussion { assignment { _id } }
        }
      }
    }
  }
}`;

const NONE: CourseItems = { assignments: [], moduleItems: [] };

/** None when the request fails, or for a course it fails for. */
export async function loadCourseItems(
  courseIds: string[],
): Promise<CourseItems> {
  if (courseIds.length === 0) return NONE;
  // each course under an alias, its id a variable rather than in the query
  const alias = (index: number) => `c${String(index)}`;
  const params = courseIds.map((_, i) => `$${alias(i)}: ID!`).join(', ');
  const query = [
    `query SearchItems(${params}) {`,
    ...courseIds.map(
      (_, i) => `  ${alias(i)}: course(id: $${alias(i)}) { ...Items }`,
    ),
    '}',
    FRAGMENT,
  ].join('\n');
  const variables = Object.fromEntries(
    courseIds.map((id, i) => [alias(i), id]),
  );
  const response = await canvasJson<Response>('/api/graphql', {
    method: 'POST',
    json: { query, variables },
  });
  const courses = courseIds.map((courseId, i) =>
    itemsOf(courseId, response?.data?.[alias(i)]),
  );
  return {
    assignments: courses.flatMap(({ assignments }) => assignments),
    moduleItems: courses.flatMap(({ moduleItems }) => moduleItems),
  };
}

// The items come in module name order, so they're put in module order. An
// item that's one of the assignments is left out: it's listed as that.
function itemsOf(
  courseId: string,
  course: CourseNode | null | undefined,
): CourseItems {
  if (!course) return NONE;
  const nodes = course.assignmentsConnection.nodes;
  const isAssignment = assignmentIn(nodes);
  const assignments = nodes.flatMap(({ _id, name, dueAt, htmlUrl }) => {
    const url = pathOnThisSite(htmlUrl);
    if (!url) return [];
    return { id: _id, courseId, name, url, due: dueAt ?? undefined };
  });
  const moduleItems = (course.modulesConnection?.nodes ?? [])
    .toSorted((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .flatMap(({ name, moduleItems }) =>
      (moduleItems ?? []).flatMap(({ title, url, content }) => {
        const path = pathOnThisSite(url);
        if (!title || !path || content?.__typename === 'SubHeader') return [];
        if (content && isAssignment(content)) return [];
        return { courseId, title, module: name ?? '', url: path };
      }),
    );
  return { assignments, moduleItems };
}

// Whether an item's content is one of these assignments: a quiz is found by
// its quiz's id, and a graded discussion by its assignment's.
function assignmentIn(nodes: AssignmentNode[]) {
  const ids = new Set(nodes.map(({ _id }) => _id));
  const quizzes = new Set(nodes.flatMap(({ quiz }) => (quiz ? quiz._id : [])));
  return (content: Content): boolean => {
    switch (content.__typename) {
      case 'Assignment':
        return ids.has(content._id);
      case 'Quiz':
        return quizzes.has(content._id);
      case 'Discussion':
        return content.assignment !== null && ids.has(content.assignment._id);
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
