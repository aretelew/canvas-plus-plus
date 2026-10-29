import { syncCardFeature, type Card } from '@/core/dashboard-cards';
import { doneCheck } from '@/core/done-check';
import { loadWorks, type Work } from '@/core/planner';
import { cardLists } from './lists';
import { cardAssignments } from './storage';

// Lists each course's assignments at the bottom of its dashboard card: what's
// past due and unfinished, then what's due in the next two weeks. Finished
// work is struck through, and its circle checks it off in Canvas itself
// (core/done-check.ts). The work comes from Canvas's planner API
// (core/planner.ts), asked for the first time the lists are on.

const LIST = 'cpp-card-due';

export function syncCardAssignments(): Promise<void> {
  return syncCardFeature({
    setting: cardAssignments,
    marker: LIST,
    // no lists on a failed request; they're tried again on the next page load
    load: async () => cardLists((await loadWorks()) ?? [], new Date()),
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
  // struck through when done, red when it's late and not
  const check = doneCheck(work, (done) => {
    li.classList.toggle('cpp-done', done);
    li.classList.toggle('cpp-overdue', !done && work.due < new Date());
  });

  const title = document.createElement('a');
  // cardLists only lists work with a page
  title.href = work.url ?? '';
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
