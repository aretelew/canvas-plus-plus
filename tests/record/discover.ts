// Runs inside a signed-in Canvas tab (passed to page.evaluate, so it must be
// self-contained). Lists the student pages to record, picking the active course
// with the most visible tabs so the fixtures cover as many page types as
// possible.

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

  let course: { id: number; tabs: string[] } | null = null;
  const courses = await get<{ id: number }[]>(
    '/api/v1/courses?enrollment_state=active&enrollment_type=student&per_page=100',
  );
  for (const { id } of courses ?? []) {
    const tabs = await get<{ id: string; hidden?: boolean }[]>(
      `/api/v1/courses/${String(id)}/tabs`,
    );
    const visible = (tabs ?? []).filter((t) => !t.hidden).map((t) => t.id);
    if (!course || visible.length > course.tabs.length) {
      course = { id, tabs: visible };
    }
  }

  if (course) {
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
    pages.push(['course-home', c]);
    for (const tab of course.tabs) {
      const entry = byTab[tab];
      if (!entry) continue;
      const [name, path, item] = entry;
      pages.push([name, path]);
      if (item) pages.push([item[0], await firstItem(item[1])]);
    }
  }

  return pages.flatMap(([name, path]) => (path ? [{ name, path }] : []));
}
