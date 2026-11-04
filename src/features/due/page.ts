import { canvasJson } from '@/core/canvas-api';
import { whenParsed } from '@/core/when-parsed';
import { timeUntilDue } from './storage';
import { timeLeft } from './time-left';

// Puts how long is left ("in 5 hours", "tomorrow") after the due dates Canvas
// shows, as part of their text: an assignment's own page, a course's
// assignments list and its modules. In a row of details ("Due Nov 10 at
// 11:59pm | 9 pts") it's a detail of its own, so Canvas's separators go
// around it. The lists on our dashboard cards (features/assignments) have
// room for only a day, so there it takes the day's place. Within a day it's
// red (due.css). There's no timer: the labels are worked out again whenever
// the tab comes back into view, which is when one left open would have gone
// stale. Once a date has passed its label hides: Canvas already marks late
// work, and knows whether it was turned in, which a date alone doesn't.

const LABEL = 'cpp-time-left';
// Canvas's own date component gives the exact time in <time datetime>: the
// header of an assignment's page, and each row of the assignments list.
const TIMES = 'time[data-testid="due-date"], .assignment-date-due time';
// The modules page writes only the day ("Dec 4"), filled in after the page
// loads, into an element named for its module item.
const MODULE_DATES = '.due_date_display';
const MODULE_ITEM = /^module-item-(\d+)-due-date$/;
// one of the details in a list row, which Canvas separates with " | " or
// spaces
const DETAIL = 'ig-details__item';
// a card's day, which the time left stands in for
const CARD_DAYS = '.cpp-card-due .cpp-day';

// what /courses/:id/modules/items/assignment_info gives for each module item
interface ItemInfo {
  due_date: string | null;
}

export async function syncTimeUntilDue(): Promise<void> {
  // due dates are never in a frame
  if (window.top !== window) return;
  const locale = document.documentElement.lang || undefined;
  let observer: MutationObserver | undefined;
  let enabled = false;
  let moduleDues: Promise<Map<string, Date>> | undefined;

  const render = (label: HTMLElement) => {
    const left = timeLeft(
      new Date(label.dataset.due ?? ''),
      new Date(),
      locale,
    );
    label.hidden = !left;
    label.textContent = left?.text ?? '';
    label.classList.toggle('cpp-soon', left?.soon ?? false);
  };

  // where a date's label goes: after the detail it's in, or the date itself
  const anchor = (date: Element) => date.closest(`.${DETAIL}`) ?? date;
  const labelled = (date: Element) =>
    anchor(date).nextElementSibling?.classList.contains(LABEL) ?? false;

  const add = (date: Element, due: Date) => {
    const after = anchor(date);
    const detail = after.classList.contains(DETAIL);
    const label = document.createElement(detail ? 'div' : 'span');
    label.classList.add(LABEL);
    if (detail) label.classList.add(DETAIL);
    label.dataset.due = due.toISOString();
    render(label);
    after.after(label);
  };

  const refresh = () => {
    if (document.visibilityState !== 'visible') return;
    for (const label of document.querySelectorAll<HTMLElement>(`.${LABEL}`)) {
      render(label);
    }
  };

  const decorate = (content: Element) => {
    for (const time of content.querySelectorAll<HTMLTimeElement>(TIMES)) {
      const date = time.closest('[data-testid="friendly-date-time"]') ?? time;
      const due = new Date(time.dateTime);
      if (!labelled(date) && !Number.isNaN(due.getTime())) add(date, due);
    }
    // in the day's place, which shows again once the date has passed (due.css)
    for (const day of content.querySelectorAll(CARD_DAYS)) {
      const time = day.closest('time');
      if (time && !labelled(day)) add(day, new Date(time.dateTime));
    }
    // asked for only once a module item shows its day
    const shown = [...content.querySelectorAll(MODULE_DATES)].some((date) =>
      date.textContent.trim(),
    );
    if (!shown) return;
    void (moduleDues ??= loadModuleDues()).then((dues) => {
      // turned off while they loaded
      if (observer) labelModuleDates(content, dues);
    });
  };

  const labelModuleDates = (content: Element, dues: Map<string, Date>) => {
    for (const date of content.querySelectorAll(MODULE_DATES)) {
      const due = dues.get(MODULE_ITEM.exec(date.id)?.[1] ?? '');
      if (due && date.textContent.trim() && !labelled(date)) add(date, due);
    }
  };

  // Canvas draws its dates with React and jQuery after the page loads, in
  // its main content
  const start = () => {
    const content = document.getElementById('content');
    if (!enabled || observer || !content) return;
    observer = new MutationObserver(() => {
      decorate(content);
    });
    observer.observe(content, { childList: true, subtree: true });
    decorate(content);
  };

  const apply = (on: boolean) => {
    enabled = on;
    observer?.disconnect();
    observer = undefined;
    for (const label of document.querySelectorAll(`.${LABEL}`)) label.remove();
    if (on) whenParsed(start);
  };

  document.addEventListener('visibilitychange', refresh);
  apply(await timeUntilDue.getValue());
  timeUntilDue.watch(apply);
}

// The exact due times of the course's module items, from the request Canvas
// makes for the days it writes; none when it fails.
async function loadModuleDues(): Promise<Map<string, Date>> {
  const course = /^\/courses\/(\d+)/.exec(location.pathname)?.[1];
  if (course === undefined) return new Map();
  const info = await canvasJson<Record<string, ItemInfo>>(
    `/courses/${course}/modules/items/assignment_info`,
  );
  return new Map(
    Object.entries(info ?? {}).flatMap(([item, { due_date }]) =>
      due_date ? [[item, new Date(due_date)]] : [],
    ),
  );
}
