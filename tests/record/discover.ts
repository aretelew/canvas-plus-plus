// Runs inside a signed-in Canvas tab (passed to page.evaluate, so it must be
// self-contained). Lists the student pages to record: the global pages, plus
// the course pages of the two active courses with the most visible tabs, so the
// fixtures cover as many page types (and two instructors' content) as possible.
// The second course's pages get a "-2" suffix.

export interface FixturePage {
  name: string;
  path: string;
}

export async function discoverPages(): Promise<FixturePage[]> {
  const get = async <T>(path: string): Promise<T | null> => {
    const res = await fetch(path, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return JSON.parse((await res.text()).replace(/^while\(1\);/, '')) as T;
  };
  const firstItem = async (path: string): Promise<string | null> => {
    const sep = path.includes('?') ? '&' : '?';
    const items = await get<{ html_url: string }[]>(`${path}${sep}per_page=1`);
    return items?.[0] ? new URL(items[0].html_url).pathname : null;
  };

  const pages: [string, string | null][] = [
    ['dashboard', '/'],
    ['courses', '/courses'],
    ['all-grades', '/grades'],
    ['calendar', '/calendar'],
    ['inbox', '/conversations'],
    ['profile-settings', '/profile/settings'],
    ['notification-settings', '/profile/communication'],
  ];

  const courses = await get<{ id: number }[]>(
    '/api/v1/courses?enrollment_state=active&enrollment_type=student&per_page=100',
  );
  const withTabs = await Promise.all(
    (courses ?? []).map(async ({ id }) => {
      const tabs = await get<{ id: string; hidden?: boolean }[]>(
        `/api/v1/courses/${String(id)}/tabs`,
      );
      return {
        id,
        tabs: (tabs ?? []).filter((t) => !t.hidden).map((t) => t.id),
      };
    }),
  );
  const chosen = withTabs
    .sort((a, b) => b.tabs.length - a.tabs.length)
    .slice(0, 2);

  for (const [i, course] of chosen.entries()) {
    const suffix = i === 0 ? '' : `-${String(i + 1)}`;
    const c = `/courses/${String(course.id)}`;
    const api = `/api/v1${c}`;
    // tab id -> [list page], plus [item page, API listing it] where one exists
    const byTab: Record<string, [string, string, [string, string]?]> = {
      modules: ['modules', `${c}/modules`],
      assignments: [
        'assignments',
        `${c}/assignments`,
        ['assignment', `${api}/assignments`],
      ],
      grades: ['grades', `${c}/grades`],
      syllabus: ['syllabus', `${c}/assignments/syllabus`],
      pages: ['pages', `${c}/pages`, ['page', `${api}/pages`]],
      files: ['files', `${c}/files`],
      discussions: [
        'discussions',
        `${c}/discussion_topics`,
        ['discussion', `${api}/discussion_topics`],
      ],
      announcements: [
        'announcements',
        `${c}/announcements`,
        ['announcement', `${api}/discussion_topics?only_announcements=true`],
      ],
      quizzes: ['quizzes', `${c}/quizzes`, ['quiz', `${api}/quizzes`]],
    };
    pages.push([`course-home${suffix}`, c]);
    for (const tab of course.tabs) {
      const entry = byTab[tab];
      if (!entry) continue;
      const [name, path, item] = entry;
      pages.push([name + suffix, path]);
      if (item) pages.push([item[0] + suffix, await firstItem(item[1])]);
    }
  }

  // New Quizzes runs in an iframe from its own origin. Record a quiz the
  // student has taken, and its results page, from the first course with one.
  for (const { id } of courses ?? []) {
    const assignments = await get<
      {
        html_url: string;
        is_quiz_lti_assignment?: boolean;
        submission?: { workflow_state: string };
      }[]
    >(
      `/api/v1/courses/${String(id)}/assignments?include[]=submission&per_page=100`,
    );
    const quiz = assignments?.find(
      (a) =>
        a.is_quiz_lti_assignment &&
        a.submission &&
        a.submission.workflow_state !== 'unsubmitted',
    );
    if (!quiz) continue;
    const path = new URL(quiz.html_url).pathname;
    const user = (window as { ENV?: { current_user_id?: string } }).ENV
      ?.current_user_id;
    pages.push(['new-quiz', path]);
    if (user) pages.push(['new-quiz-results', `${path}/submissions/${user}`]);
    break;
  }

  return pages.flatMap(([name, path]) => (path ? [{ name, path }] : []));
}
