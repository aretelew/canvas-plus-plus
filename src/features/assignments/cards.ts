import { canvasFetch } from '@/core/canvas-api';
import { syncCardFeature, type Card } from '@/core/dashboard-cards';
import {
  cardLists,
  type Override,
  type PlannerItem,
  type Work,
} from './planner';
import { cardAssignments } from './storage';

// Lists each course's assignments at the bottom of its dashboard card: what's
// past due and unfinished, then what's due in the next two weeks. Finished
// work is struck through, and its circle checks it off in Canvas itself (a
// planner override, the same as Canvas's own To Do list), so the two agree.
// The items come from Canvas's planner API, fetched the first time the lists
// are on.

const LIST = 'cpp-card-due';

// overdue work stays listed this long, as Canvas's To Do sidebar has it
const WINDOW_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

export function syncCardAssignments(): Promise<void> {
  return syncCardFeature({
    setting: cardAssignments,
    marker: LIST,
    load: fetchLists,
    decorate: addList,
  });
}

function addList(card: Card, byCourse: Map<string, Work[]>): void {
  const works = byCourse.get(card.courseId) ?? [];
  const locale = document.documentElement.lang || undefined;
  const section = document.createElement('section');
  section.className = LIST;
  if (card.name) section.setAttribute('aria-label', `Due in ${card.name}`);
  const heading = document.createElement('h3');
  heading.textContent = 'Due';
  section.append(heading);
  if (works.length === 0) {
    const none = document.createElement('p');
    none.textContent = 'Nothing due';
    section.append(none);
  } else {
    const list = document.createElement('ul');
    list.append(...works.map((work) => row(work, locale)));
    section.append(list);
  }
  card.element.append(section);
}

function row(work: Work, locale: string | undefined): HTMLLIElement {
  const li = document.createElement('li');
  showDone(li, work, work.done);

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.checked = work.done;
  check.setAttribute('aria-label', `Mark ${work.title} as done`);
  check.addEventListener('change', () => void markDone(work, check, li));

  const title = document.createElement('a');
  title.href = work.url;
  title.textContent = work.title;

  const date = document.createElement('time');
  date.dateTime = work.due.toISOString();
  date.title = work.due.toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  date.textContent = work.due.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });
  // read out only while the row is marked overdue (assignments.css)
  const late = document.createElement('span');
  late.className = 'cpp-late screenreader-only';
  late.textContent = 'Overdue: ';
  date.prepend(late);

  li.append(check, title, date);
  return li;
}

// Strikes the row through when done, and marks it red when it's late and not.
function showDone(li: HTMLLIElement, work: Work, done: boolean): void {
  li.classList.toggle('cpp-done', done);
  li.classList.toggle('cpp-overdue', !done && work.due < new Date());
}

// Shows the change at once and takes it back if Canvas doesn't save it.
async function markDone(
  work: Work,
  check: HTMLInputElement,
  li: HTMLLIElement,
): Promise<void> {
  const done = check.checked;
  showDone(li, work, done);
  check.disabled = true;
  const override = await saveOverride(work, done);
  check.disabled = false;
  if (override) {
    work.override = override;
    work.done = done;
  } else {
    check.checked = !done;
    showDone(li, work, !done);
  }
}

// An override is created the first time and updated after that. Canvas resets
// `dismissed` (hidden from the To Do sidebar) when it isn't sent, so it's sent
// as it was.
async function saveOverride(
  work: Work,
  done: boolean,
): Promise<Override | undefined> {
  const { override } = work;
  try {
    const response = await (override
      ? canvasFetch(`/api/v1/planner/overrides/${override.id}`, {
          method: 'PUT',
          json: { marked_complete: done, dismissed: override.dismissed },
        })
      : canvasFetch('/api/v1/planner/overrides', {
          method: 'POST',
          json: { ...work.target, marked_complete: done },
        }));
    return response.ok ? ((await response.json()) as Override) : undefined;
  } catch {
    return undefined;
  }
}

// No lists on a failed request; they're tried again on the next page load.
async function fetchLists(): Promise<Map<string, Work[]>> {
  const now = new Date();
  const query = new URLSearchParams({
    start_date: new Date(now.getTime() - WINDOW_DAYS * DAY).toISOString(),
    end_date: new Date(now.getTime() + WINDOW_DAYS * DAY).toISOString(),
    per_page: '100',
  });
  const items: PlannerItem[] = [];
  try {
    // two weeks either way fits one page for nearly everyone; Canvas says
    // where the next one is in the Link header
    let next: string | undefined = `/api/v1/planner/items?${query}`;
    while (next) {
      const response = await canvasFetch(next);
      if (!response.ok) return new Map();
      items.push(...((await response.json()) as PlannerItem[]));
      next = nextPage(response.headers.get('Link'));
    }
  } catch {
    return new Map();
  }
  return cardLists(items, now);
}

function nextPage(link: string | null): string | undefined {
  const url = /<([^>]+)>;\s*rel="next"/.exec(link ?? '')?.[1];
  // only ever Canvas's own pages
  return url && new URL(url).origin === location.origin ? url : undefined;
}
