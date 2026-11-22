import { browser, type Browser } from '#imports';
import { ACCEPT } from '@/core/canvas-api';
import { fetchPlannerItems, WINDOW_DAYS, worksOf } from '@/core/planner';
import {
  type Due,
  type Notice,
  nextReminder,
  noticeText,
  remind,
  type Reminders,
  sitesToRefresh,
  upcoming,
} from './schedule';
import { PERMISSION, reminders, type WorksMessage } from './storage';

// Reminders before work is due, as the browser's own notifications. Each
// Canvas page sends its site's upcoming work here (page.ts); one alarm wakes
// the background for the next reminder. Just before it's given, the site's
// work is asked for again unless a page just sent it, so work handed in since
// isn't reminded of. When that can't be done (signed out, or the browser
// won't send the session), what the site last listed is used.

const ALARM = 'canvas++:reminders';
// a notice's id is this and what clicking it opens, so a click needs nothing
// stored, and a work's next reminder replaces its last
const NOTICE = 'canvas++:';
const DAY = 24 * 60 * 60 * 1000;
// A notice's image, one clear pixel: macOS already shows the browser's icon
// beside it. Chrome needs one, and drops a notice without it, though it says
// the notice was made.
const NO_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// Only there while the permission is granted.
const notifications = () =>
  browser.notifications as typeof browser.notifications | undefined;

/** Listens for what reminders need; call at the background's start. */
export function startReminders(): void {
  browser.alarms.onAlarm.addListener(({ name }) => {
    if (name === ALARM) void check();
  });
  browser.runtime.onMessage.addListener((message, sender) => {
    if (isWorksMessage(message)) void receive(message, sender);
  });
  listenForClicks();
  browser.permissions.onAdded.addListener(({ permissions = [] }) => {
    if (permissions.includes(PERMISSION)) void syncReminders();
  });
  browser.permissions.onRemoved.addListener(({ permissions = [] }) => {
    if (permissions.includes(PERMISSION)) void syncReminders();
  });
}

/**
 * Starts or stops reminders as the permission is, and gives any that came due
 * while the browser was closed. Alarms may not outlast a restart (Firefox's
 * don't), so it's for the browser's start too.
 */
export const syncReminders = (): Promise<void> => queued(syncNow);

async function syncNow(): Promise<void> {
  const on = await browser.permissions.contains({ permissions: [PERMISSION] });
  const state = await reminders.getValue();
  if (!on) {
    if (state) await reminders.removeValue();
    await browser.alarms.clear(ALARM);
    return;
  }
  listenForClicks();
  // content scripts start listing their sites' work when this appears
  if (!state) await reminders.setValue({ sites: {}, sent: {} });
  await checkNow();
}

let listening = false;

// The API appears once the permission is granted, which may be after the
// background started.
function listenForClicks() {
  const api = notifications();
  if (!api || listening) return;
  listening = true;
  api.onClicked.addListener((id) => {
    if (!id.startsWith(NOTICE)) return;
    void api.clear(id);
    const url = new URL(id.slice(NOTICE.length));
    if (url.protocol === 'https:') void browser.tabs.create({ url: url.href });
  });
}

function isWorksMessage(message: unknown): message is WorksMessage {
  if (typeof message !== 'object' || message === null) return false;
  const { type, works } = message as Record<string, unknown>;
  return type === 'canvas++:works' && Array.isArray(works);
}

// A page's list of its site's work. The site is the page's, from the browser,
// and only a top frame lists it.
async function receive(
  { works }: WorksMessage,
  { id, url, frameId }: Browser.runtime.MessageSender,
): Promise<void> {
  if (id !== browser.runtime.id || frameId !== 0 || !url) return;
  const { origin, protocol } = new URL(url);
  if (protocol !== 'https:') return;
  await check({ origin, works });
}

let running = Promise.resolve();

// One at a time, so two can't both give a reminder, or undo the other's.
function queued(task: () => Promise<void>): Promise<void> {
  running = running.then(task, task);
  return running;
}

/**
 * Takes in a site's work, if a page sent it, then gives the reminders due and
 * sets the alarm for the next.
 */
const check = (site?: Listed): Promise<void> => queued(() => checkNow(site));

// a site's work, as a page of it listed it
interface Listed {
  origin: string;
  works: Due[];
}

async function checkNow(site?: Listed): Promise<void> {
  let state = await reminders.getValue();
  // turned off meanwhile
  if (!state) return;
  const now = Date.now();
  if (site) state = withSite(state, site.origin, site.works, now);
  const refreshed = await Promise.all(
    sitesToRefresh(state, now).map(
      async (origin) => [origin, await fetchUpcoming(origin, now)] as const,
    ),
  );
  for (const [origin, works] of refreshed) {
    if (works) state = withSite(state, origin, works, now);
  }
  const reminded = remind(state, now);
  await reminders.setValue(reminded.state);
  for (const notice of reminded.notices) await show(notice, now);
  const next = nextReminder(reminded.state, now);
  if (next === undefined) await browser.alarms.clear(ALARM);
  else await browser.alarms.create(ALARM, { when: next });
}

const withSite = (
  state: Reminders,
  origin: string,
  works: Due[],
  now: number,
): Reminders => ({
  ...state,
  sites: { ...state.sites, [origin]: { at: now, works } },
});

// The site's upcoming work, asked for from here with the user's session;
// undefined when that fails.
async function fetchUpcoming(
  origin: string,
  now: number,
): Promise<Due[] | undefined> {
  const items = await fetchPlannerItems(
    origin,
    new Date(now),
    new Date(now + WINDOW_DAYS * DAY),
    (url) =>
      fetch(url, { credentials: 'include', headers: { Accept: ACCEPT } }),
  );
  return items && upcoming(worksOf(items), now);
}

async function show(notice: Notice, now: number): Promise<void> {
  const { title, message, url } = noticeText(notice, now);
  try {
    await notifications()?.create(`${NOTICE}${url}`, {
      type: 'basic',
      iconUrl: NO_ICON,
      title,
      message,
    });
  } catch {
    // the permission was taken back meanwhile
  }
}
