import { el } from '@/core/el';
import { textOf } from '@/core/text';
import { whenParsed } from '@/core/when-parsed';
import {
  countedShare,
  parsePercent,
  readGroups,
  readScheme,
  readWeights,
  shownGroups,
  standing,
  type Cutoff,
  type Group,
  type Standing,
} from './breakdown';
import { controlsMenu } from './menu';
import { formatScore } from './scores';
import { gradeBreakdown } from './storage';

// Reworks the sidebar of a course's Grades page around the grade by group.
// Canvas's sidebar says only "Total: 89.67%" and lists the groups' weights;
// each group's grade is at the foot of the table, often a long scroll away.
// Ours shows the total large with its letter and how far the next letter is,
// how much of the grade it's based on so far, and every group with its grade,
// a bar, its weight and its points. All of it is read from what Canvas worked
// out in the page (breakdown.ts), so it costs no request and follows Canvas
// as it recalculates: What-If scores, and "Calculate based only on graded
// assignments". Canvas's controls go behind a ⋯ button (menu.ts), and its
// own sidebar is hidden while ours is there (sidebar.css).

const BLOCK = 'cpp-grades';

// what the block shows, compared between renders so Canvas's mutations that
// change nothing (and ours) don't draw it again
interface View {
  total?: { grade: string; letter?: string; standing?: Standing };
  // the total without What-If scores, while they're shown
  actual?: string;
  share?: number;
  groups: Group[];
}

export async function syncGradeBreakdown(): Promise<void> {
  // only a course's Grades page has the table and sidebar
  if (window.top !== window) return;
  if (!/^\/courses\/\d+\/grades\/?$/.test(location.pathname)) return;
  const locale = document.documentElement.lang || undefined;
  let observer: MutationObserver | undefined;
  let enabled = false;

  const apply = (on: boolean) => {
    enabled = on;
    observer?.disconnect();
    observer = undefined;
    document.querySelector(`.${BLOCK}`)?.remove();
    if (on) whenParsed(start);
  };

  // Canvas fills in the grades with its scripts after the page loads, and
  // again whenever they change
  const start = () => {
    const table = document.getElementById('grades_summary');
    const sidebar = document.getElementById('student-grades-right-content');
    if (!enabled || observer || !table || !sidebar) return;
    const render = renderer(table, sidebar, locale);
    observer = new MutationObserver(render);
    for (const watched of [table, sidebar]) {
      observer.observe(watched, {
        childList: true,
        subtree: true,
        characterData: true,
        // the What-If note comes and goes by its style
        attributes: true,
        attributeFilter: ['style'],
      });
    }
    render();
  };

  apply(await gradeBreakdown.getValue());
  gradeBreakdown.watch(apply);
}

function renderer(
  table: HTMLElement,
  sidebar: HTMLElement,
  locale: string | undefined,
): () => void {
  const scheme = pageScheme();
  const block = el('section', BLOCK);
  block.setAttribute('aria-label', 'Grade summary');
  // the menu stays across draws, so it stays open as Canvas recalculates;
  // its checkbox changes no markup the observer would see, so it renders too
  const label = el('h2', 'cpp-grades-label');
  const menu = controlsMenu(sidebar, () => {
    render();
  });
  const head = el('div', 'cpp-grades-head');
  head.append(label, menu.element);
  const body = el('div', 'cpp-grades-body');
  block.append(head, body);
  const revert = () => {
    sidebar.querySelector<HTMLElement>('#revert-all-to-actual-score')?.click();
  };
  let actual: string | undefined;
  let drawn = '';

  const render = () => {
    const view = read(table, sidebar, scheme);
    // the total as it is, kept for while What-If scores are shown
    const whatIf = showsWhatIf(sidebar);
    if (!whatIf) actual = view.total?.grade;
    else if (actual !== view.total?.grade) view.actual = actual;
    menu.sync();
    const key = JSON.stringify(view);
    if (key !== drawn || !block.isConnected) {
      drawn = key;
      draw(label, body, view, locale, revert);
      if (!block.isConnected) sidebar.prepend(block);
    }
  };
  return render;
}

function read(
  table: Element,
  sidebar: Element,
  scheme: Cutoff[] | undefined,
): View {
  const weights = readWeights(
    sidebar.querySelector('#assignments-not-weighted table'),
  );
  const groups = readGroups(table, weights);
  const onlyGraded =
    sidebar.querySelector<HTMLInputElement>('#only_consider_graded_assignments')
      ?.checked ?? false;
  return {
    total: readTotal(sidebar, scheme),
    share: onlyGraded ? countedShare(groups) : undefined,
    groups: shownGroups(groups),
  };
}

// Canvas's total and letter; none when the teacher hid totals
function readTotal(
  sidebar: Element,
  scheme: Cutoff[] | undefined,
): View['total'] {
  const grade = textOf(sidebar.querySelector('.final_grade .grade'));
  if (!grade) return undefined;
  const letter = textOf(sidebar.querySelector('#final_letter_grade_text'));
  const percent = parsePercent(grade);
  const place =
    scheme && percent !== undefined ? standing(percent, scheme) : undefined;
  return {
    grade,
    // Canvas writes "–" while there's no letter
    letter: /\p{L}/u.test(letter) ? letter : undefined,
    // only when it agrees with Canvas's letter, which is what counts
    standing: place?.letter === letter ? place : undefined,
  };
}

function draw(
  label: HTMLElement,
  body: HTMLElement,
  view: View,
  locale: string | undefined,
  revert: () => void,
): void {
  const percent = (n: number) => formatScore(n, locale);
  const children: Node[] = [];
  const { total } = view;
  label.textContent = !total
    ? ''
    : view.actual
      ? 'Total with What-If'
      : 'Total';
  if (total) {
    const score = el('p', 'cpp-grades-score', total.grade);
    if (total.letter) {
      score.append(' ', el('span', 'cpp-grades-letter', total.letter));
    }
    children.push(score);
    if (view.actual) {
      // Canvas's Revert button, hidden with the rest of its sidebar
      const note = el('p', 'cpp-grades-note', `Actual ${view.actual} · `);
      const undo = el('button', 'cpp-grades-revert', 'Revert');
      undo.type = 'button';
      undo.addEventListener('click', revert);
      note.append(undo);
      children.push(note);
    }
    const next = total.standing?.next;
    const notes = [
      next && `${percent(next.gap)} to ${next.letter}`,
      view.share !== undefined &&
        `Based on ${percent(view.share)} of the grade so far`,
    ].filter((note) => typeof note === 'string');
    for (const note of notes) children.push(el('p', 'cpp-grades-note', note));
  }
  if (view.groups.length) {
    const list = el('ul', '');
    list.append(...view.groups.map((group) => groupRow(group, percent)));
    children.push(list);
  }
  body.replaceChildren(...children);
}

function groupRow(group: Group, percent: (n: number) => string): HTMLElement {
  const row = el('li', group.percent === undefined ? 'cpp-ungraded' : '');
  const line = el('div', 'cpp-grades-row');
  line.append(
    el('span', 'cpp-grades-name', group.name),
    el(
      'span',
      'cpp-grades-value',
      group.percent === undefined ? '–' : percent(group.percent),
    ),
  );
  const bar = el('div', 'cpp-grades-bar');
  bar.setAttribute('aria-hidden', 'true');
  const fill = el('span', '');
  fill.style.width = `${String(Math.min(Math.max(group.percent ?? 0, 0), 100))}%`;
  bar.append(fill);
  // an ungraded group's dash and empty bar say it's not graded
  const meta = [
    group.weight !== undefined && `${percent(group.weight)} of grade`,
    group.percent !== undefined && group.points && `${group.points} pts`,
  ].filter((part) => typeof part === 'string');
  row.append(line, bar);
  if (meta.length) row.append(el('div', 'cpp-grades-meta', meta.join(' · ')));
  return row;
}

// Canvas shows its "NOT your official score" note while What-If scores are
// in the grades
function showsWhatIf(sidebar: Element): boolean {
  const note = sidebar.querySelector<HTMLElement>('#student-grades-revert');
  return !!note && note.style.display !== 'none';
}

// the course's grading scheme, from the ENV Canvas writes into a script
function pageScheme(): Cutoff[] | undefined {
  for (const script of document.scripts) {
    const scheme = readScheme(script.text);
    if (scheme) return scheme;
  }
  return undefined;
}
