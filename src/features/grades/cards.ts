import { currentScores, formatScore, type Course } from './scores';
import { cardGrades } from './storage';

// Puts each course's current grade on its dashboard card: a pill at the top
// left of the card's color or image, linking to the course's Grades page.
// Courses with nothing to show (no grades yet, totals hidden by the teacher,
// not a student there) get no pill.
//
// The scores come from one request to Canvas's API, made the first time grades
// are on. Canvas draws the cards with React after the page loads, and draws
// them again when the dashboard switches views (replacing their container),
// so while grades are on an observer on the document adds pills to headers
// that don't have one.

const HEADER = 'ic-DashboardCard__header';
const PILL = 'cpp-card-grade';

// every active course fits in one page (per_page tops out at 100)
const COURSES =
  '/api/v1/courses?enrollment_state=active&include[]=total_scores&include[]=current_grading_period_scores&include[]=restrict_quantitative_data&per_page=100';

// Firefox's global object in content scripts; its fetch runs as the page
declare const content: { fetch: typeof fetch };

let scores: Promise<Map<string, number>> | undefined;
let observer: MutationObserver | undefined;
let enabled = false;

export async function syncCardGrades(): Promise<void> {
  // the cards are on the dashboard, the site's root, and never in a frame
  if (location.pathname !== '/' || window.top !== window) return;
  apply(await cardGrades.getValue());
  cardGrades.watch(apply);
}

function apply(on: boolean): void {
  enabled = on;
  if (on) {
    void (scores ??= fetchScores()).then(addPillsAsCardsAppear);
    return;
  }
  observer?.disconnect();
  observer = undefined;
  for (const pill of document.querySelectorAll(`.${PILL}`)) pill.remove();
}

function addPillsAsCardsAppear(byCourse: Map<string, number>): void {
  // turned off (or on twice) while the scores loaded, or nothing to show
  if (!enabled || observer || !byCourse.size) return;
  const headers = document.getElementsByClassName(HEADER);
  const addPills = () => {
    for (const header of headers) {
      if (!header.querySelector(`:scope > .${PILL}`)) addPill(header, byCourse);
    }
  };
  observer = new MutationObserver(addPills);
  observer.observe(document, { childList: true, subtree: true });
  addPills();
}

function addPill(header: Element, byCourse: Map<string, number>): void {
  const href = header
    .querySelector('.ic-DashboardCard__link')
    ?.getAttribute('href');
  const id = /\/courses\/(\d+)/.exec(href ?? '')?.[1];
  if (id === undefined) return;
  const score = byCourse.get(id);
  if (score === undefined) return;
  const grade = formatScore(score, document.documentElement.lang || undefined);
  const course = header
    .closest('.ic-DashboardCard')
    ?.getAttribute('aria-label');
  const pill = document.createElement('a');
  pill.className = PILL;
  pill.href = `/courses/${id}/grades`;
  pill.textContent = grade;
  if (course) pill.setAttribute('aria-label', `${course} grades: ${grade}`);
  // first, so the tab order follows the layout (it sits top left)
  header.prepend(pill);
}

// No grades on a failed request; they're tried again on the next page load.
async function fetchScores(): Promise<Map<string, number>> {
  const url = new URL(COURSES, location.origin);
  // As Canvas's own scripts ask: ids as strings (some are past what a JS
  // number holds exactly), and application/json, without which Canvas puts
  // `while(1);` in front of the JSON.
  const init = {
    headers: { Accept: 'application/json+canvas-string-ids, application/json' },
  };
  try {
    // Firefox runs a content script's own requests as the extension, without
    // the user's Canvas session
    const response = await (import.meta.env.FIREFOX
      ? content.fetch(url, init)
      : fetch(url, init));
    if (!response.ok) return new Map();
    return currentScores((await response.json()) as Course[]);
  } catch {
    return new Map();
  }
}
