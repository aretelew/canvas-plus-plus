import { canvasJson } from '@/core/canvas-api';

// Every assignment in the given courses, from one GraphQL request: the REST API
// would take one a course. Quizzes and graded discussions are assignments too.

export interface CourseAssignment {
  id: string;
  courseId: string;
  name: string;
  // a path on this site
  url: string;
  // ISO, when it's due for this user; none when it has no due date
  due?: string;
}

interface Node {
  _id: string;
  name: string;
  dueAt: string | null;
  htmlUrl: string | null;
}

type Response = {
  data?: Record<
    string,
    { assignmentsConnection: { nodes: Node[] } } | null | undefined
  >;
};

// Without `gradingPeriodId: null`, a course with grading periods lists only
// the current one's. A page holds at most 100, which nearly every course fits.
const FRAGMENT = `fragment Assignments on Course {
  assignmentsConnection(first: 100, filter: { gradingPeriodId: null }) {
    nodes { _id name dueAt htmlUrl }
  }
}`;

/** None when the request fails, or for a course it fails for. */
export async function loadAssignments(
  courseIds: string[],
): Promise<CourseAssignment[]> {
  if (courseIds.length === 0) return [];
  // each course under an alias, its id a variable rather than in the query
  const alias = (index: number) => `c${String(index)}`;
  const params = courseIds.map((_, i) => `$${alias(i)}: ID!`).join(', ');
  const query = [
    `query SearchAssignments(${params}) {`,
    ...courseIds.map(
      (_, i) => `  ${alias(i)}: course(id: $${alias(i)}) { ...Assignments }`,
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
  return courseIds.flatMap((courseId, i) =>
    (response?.data?.[alias(i)]?.assignmentsConnection.nodes ?? []).flatMap(
      ({ _id, name, dueAt, htmlUrl }) => {
        const url = pathOnThisSite(htmlUrl);
        if (!url) return [];
        return { id: _id, courseId, name, url, due: dueAt ?? undefined };
      },
    ),
  );
}

// GraphQL gives full URLs; only this site's are kept, as a path
function pathOnThisSite(url: string | null): string | undefined {
  if (!url) return undefined;
  const parsed = new URL(url, location.origin);
  return parsed.origin === location.origin
    ? parsed.pathname + parsed.search
    : undefined;
}
