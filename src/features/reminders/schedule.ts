import { daysUntil } from '@/core/days';
import type { Work } from '@/core/planner';

// When to remind the user of work that's due, from what each Canvas site last
// listed: a day before and an hour before. Reminders the browser couldn't give
// on time (it was closed, or the computer asleep) are given once it can, the
// one for the time that's left: an hour before, if that's all there is. Work
// that's past due isn't reminded of; Canvas marks it late.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// shortest first
const LEADS = [HOUR, DAY];
// the most a notice lists by name
const LISTED = 3;
// A site's list is taken as current this long: a page sends it again, and
// the background asks for it again before a reminder, only once it's older.
const FRESH = 10 * MINUTE;
// a site that's listed nothing in this long is forgotten
const FORGET_AFTER = 14 * DAY;

/** Work that isn't done, as a site last listed it. */
export interface Due {
  // the planner's, unique on its site
  id: string;
  title: string;
  // the work's page, a path on its site; none for the user's own notes
  url?: string;
  course?: string;
  // ms since the epoch
  due: number;
}

export interface Site {
  // when it was listed
  at: number;
  works: Due[];
}

export interface Reminders {
  // by origin, like https://school.instructure.com
  sites: Record<string, Site>;
  // the reminders given, with when their work is due, so each is given once
  sent: Record<string, number>;
}

/** What a site's upcoming work is, from its planner. */
export function upcoming(works: Work[], now: number): Due[] {
  return works.flatMap(({ done, due, target, title, url, courseName }) =>
    !done && due.getTime() > now
      ? [
          {
            id: `${target.plannable_type}/${target.plannable_id}`,
            title,
            url,
            course: courseName,
            due: due.getTime(),
          },
        ]
      : [],
  );
}

// A reminder is for one due date: moved, the work is reminded of again.
const key = (origin: string, work: Due, lead: number) =>
  [origin, work.id, work.due, lead].join(' ');

// Whether a reminder for the work is due now: the one for the shortest lead
// it's within, unless that was given.
function owed(
  origin: string,
  work: Due,
  sent: Reminders['sent'],
  now: number,
): boolean {
  const left = work.due - now;
  const lead = LEADS.find((lead) => left <= lead);
  return left > 0 && lead !== undefined && !(key(origin, work, lead) in sent);
}

/** Whether a site's list is recent enough to go by without asking again. */
export function isFresh(site: Site | undefined, now: number): boolean {
  return site !== undefined && now - site.at < FRESH;
}

/** The sites to ask for their work again first: a reminder's due, and the
 * list it's from isn't fresh. */
export function sitesToRefresh(state: Reminders, now: number): string[] {
  return Object.entries(state.sites)
    .filter(
      ([origin, site]) =>
        !isFresh(site, now) &&
        site.works.some((work) => owed(origin, work, state.sent, now)),
    )
    .map(([origin]) => origin);
}

/** A notice for a site's work that's due soon. */
export interface Notice {
  origin: string;
  works: Due[];
}

/**
 * The notices due now, a site's together, and the state with them given.
 * What's past is dropped from it, and sites gone quiet are forgotten.
 */
export function remind(
  state: Reminders,
  now: number,
): { notices: Notice[]; state: Reminders } {
  const sent = Object.fromEntries(
    Object.entries(state.sent).filter(([, due]) => due > now),
  );
  const sites: Reminders['sites'] = {};
  const notices: Notice[] = [];
  for (const [origin, site] of Object.entries(state.sites)) {
    const works = site.works.filter(({ due }) => due > now);
    if (!works.length && now - site.at > FORGET_AFTER) continue;
    sites[origin] = { ...site, works };
    const due = works.filter((work) => owed(origin, work, sent, now));
    // a day before can't come after an hour before
    for (const work of due) {
      for (const lead of LEADS) {
        if (work.due - now <= lead) sent[key(origin, work, lead)] = work.due;
      }
    }
    if (due.length) notices.push({ origin, works: due });
  }
  return { notices, state: { sites, sent } };
}

/** When the next reminder is due, if there's one to come. */
export function nextReminder(
  state: Reminders,
  now: number,
): number | undefined {
  const times = Object.values(state.sites).flatMap(({ works }) =>
    works.flatMap(({ due }) =>
      LEADS.map((lead) => due - lead).filter((at) => at > now),
    ),
  );
  return times.length ? Math.min(...times) : undefined;
}

export interface NoticeText {
  title: string;
  message: string;
  // what clicking it opens: the work's page, or the site's dashboard for
  // several or for the user's own note
  url: string;
}

/** What a notice says. `locale` is for tests; it's the browser's. */
export function noticeText(
  { origin, works }: Notice,
  now: number,
  locale?: string,
): NoticeText {
  const when = (due: number) => {
    const date = new Date(due);
    const days = daysUntil(date, new Date(now));
    const day =
      days === 0
        ? 'today'
        : days === 1
          ? 'tomorrow'
          : date.toLocaleDateString(locale, { weekday: 'long' });
    const time = date.toLocaleTimeString(locale, {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${day} at ${time}`;
  };
  const dashboard = `${origin}/`;
  const [work] = works;
  if (works.length === 1 && work) {
    const page = work.url && new URL(work.url, origin);
    return {
      title: work.title,
      message: [`Due ${when(work.due)}`, work.course]
        .filter(Boolean)
        .join(' · '),
      // only ever a page on the work's own site
      url: page && page.origin === origin ? page.href : dashboard,
    };
  }
  // One a line. A banner shows about three lines, so past three the soonest
  // two are listed with a count of the rest.
  const sorted = works.toSorted((a, b) => a.due - b.due);
  const listed = sorted.length > LISTED ? sorted.slice(0, LISTED - 1) : sorted;
  const rest = sorted.length - listed.length;
  return {
    // two or more; quizzes and discussions are assignments to a student too
    title: `${String(works.length)} assignments due soon`,
    message: [
      ...listed.map((work) => `${work.title} due ${when(work.due)}`),
      ...(rest ? [`and ${String(rest)} more`] : []),
    ].join('\n'),
    url: dashboard,
  };
}
