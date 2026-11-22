import { el } from '@/core/el';
import { textOf } from '@/core/text';
import { whenParsed } from '@/core/when-parsed';
import {
  countedShare,
  finalsLast,
  hasScheme,
  isDefaultScheme,
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
import {
  agrees,
  isWeighted,
  needs,
  predictable,
  totalOf,
  withPredictions,
  type Need,
} from './predict';
import {
  chooseScale,
  isStudents,
  type CourseScheme,
  type Scale,
  type ScaleScope,
} from './scale';
import { scaleEditor } from './scale-editor';
import { formatScore } from './scores';
import { courseScales, gradeBreakdown, schoolScales } from './storage';

// Reworks the sidebar of a course's Grades page around the grade by group.
// Canvas's sidebar says only "Total: 89.67%" and lists the groups' weights;
// each group's grade is at the foot of the table, often a long scroll away.
// Ours shows the total large with its letter and how far the next letter is,
// how much of the grade it's based on so far, and every group with its grade,
// a bar, its weight and its points. All of it is read from what Canvas worked
// out in the page (breakdown.ts), so it costs no request and follows Canvas
// as it recalculates: What-If scores, and "Calculate based only on graded
// assignments". Canvas's controls go behind a ⋯ button (menu.ts), and its
// own sidebar is hidden while ours is there (sidebar.css). A group's grade
// can be clicked to predict it, and the total follows (predict.ts); the
// predictions last until the page is left. The letters are by the scale the
// student set for the course, else the course's own, or where it has only
// Canvas's default or none, by the student's scale for their school
// (scale.ts).

const BLOCK = 'cpp-grades';

// the student's scales that apply on the page
type Saved = Partial<Record<ScaleScope, Cutoff[]>>;

// saves a scale under its key, or with none, forgets it; the record is
// written again whole, as storage holds it
async function setScale(
  item: typeof schoolScales,
  key: string,
  cutoffs: Cutoff[] | undefined,
): Promise<void> {
  const others = Object.entries(await item.getValue()).filter(
    ([saved]) => saved !== key,
  );
  await item.setValue(
    Object.fromEntries(cutoffs ? [...others, [key, cutoffs]] : others),
  );
}

// what the block shows, compared between renders so Canvas's mutations that
// change nothing (and ours) don't draw it again
interface View {
  total?: { grade: string; letter?: string; standing?: Standing };
  // the total without What-If scores, while they're shown
  actual?: string;
  // Canvas's total, while predictions stand in for some groups' grades
  current?: string;
  share?: number;
  // the letters are by a scale of the student's, which the note names
  scale?: string;
  groups: Row[];
}

interface Row extends Group {
  /** its grade can be predicted */
  editable?: boolean;
  /** its grade is a prediction */
  predicted?: boolean;
  /** what it needs for each letter, while it's the one group ungraded */
  needs?: Need[];
}

// what the drawn block's buttons do
interface Actions {
  revert: () => void;
  reset: () => void;
  /**
   * a prediction for the group, or none to go back to Canvas's grade, and
   * whether its grade takes the focus back from the field
   */
  predict: (
    name: string,
    percent: number | undefined,
    refocus: boolean,
  ) => void;
}

export async function syncGradeBreakdown(): Promise<void> {
  // only a course's Grades page has the table and sidebar
  if (window.top !== window) return;
  if (!/^\/courses\/\d+\/grades\/?$/.test(location.pathname)) return;
  const locale = document.documentElement.lang || undefined;
  let observer: MutationObserver | undefined;
  let enabled = false;
  let rescale: (() => void) | undefined;
  // the student's scales for the school, by its Canvas site, and for the
  // course, by its path on it
  const course = `${location.host}${location.pathname.replace(/\/grades\/?$/, '')}`;
  const saved: Saved = {
    school: (await schoolScales.getValue())[location.host],
    course: (await courseScales.getValue())[course],
  };
  schoolScales.watch((scales) => {
    saved.school = scales[location.host];
    rescale?.();
  });
  courseScales.watch((scales) => {
    saved.course = scales[course];
    rescale?.();
  });

  const apply = (on: boolean) => {
    enabled = on;
    observer?.disconnect();
    observer = undefined;
    rescale = undefined;
    document.querySelector(`.${BLOCK}`)?.remove();
    if (on) whenParsed(start);
  };

  // Canvas fills in the grades with its scripts after the page loads, and
  // again whenever they change
  const start = () => {
    const table = document.getElementById('grades_summary');
    const sidebar = document.getElementById('student-grades-right-content');
    if (!enabled || observer || !table || !sidebar) return;
    const drawn = renderer(table, sidebar, locale, saved, course);
    const render = () => {
      drawn.render();
    };
    rescale = drawn.rescale;
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
  saved: Readonly<Saved>,
  course: string,
): { render: () => void; rescale: () => void } {
  const page = pageScheme();
  const scale = () => chooseScale(page, saved.school, saved.course);
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

  // the scales' form, under the head while it's open
  let editor: HTMLFormElement | undefined;
  const closeEditor = () => {
    editor?.remove();
    editor = undefined;
    menu.element.querySelector<HTMLElement>('.cpp-grades-more')?.focus();
  };
  const saveScale = (scope: ScaleScope, cutoffs: Cutoff[] | undefined) => {
    closeEditor();
    void (scope === 'course'
      ? setScale(courseScales, course, cutoffs)
      : setScale(schoolScales, location.host, cutoffs));
  };
  menu.addItem('Letter Scale Settings', () => {
    if (!editor) {
      editor = scaleEditor({
        saved: { ...saved },
        courseHasOwn: page !== undefined && !page.isDefault,
        save: saveScale,
        remove: (scope) => {
          saveScale(scope, undefined);
        },
        close: closeEditor,
      });
      head.after(editor);
    }
    editor.querySelector<HTMLInputElement>('input:checked')?.focus();
  });

  const predictions = new Map<string, number>();
  const actions: Actions = {
    revert: () => {
      sidebar
        .querySelector<HTMLElement>('#revert-all-to-actual-score')
        ?.click();
    },
    reset: () => {
      predictions.clear();
      render(true);
    },
    predict: (name, percent, refocus) => {
      if (percent === undefined) predictions.delete(name);
      else predictions.set(name, percent);
      // drawn again even when it's unchanged, for the grade's button
      render(true);
      if (!refocus) return;
      body
        .querySelector<HTMLElement>(
          `[data-group="${CSS.escape(name)}"] .cpp-grades-value`,
        )
        ?.focus();
    },
  };
  let actual: string | undefined;
  let drawn = '';

  const render = (force = false) => {
    const view = read(table, sidebar, scale(), predictions, locale);
    // the total as it is, kept for while What-If scores are shown
    const canvasTotal = view.current ?? view.total?.grade;
    const whatIf = showsWhatIf(sidebar);
    if (!whatIf) actual = canvasTotal;
    else if (actual !== canvasTotal) view.actual = actual;
    menu.sync();
    const key = JSON.stringify(view);
    if (force || key !== drawn || !block.isConnected) {
      drawn = key;
      draw(label, body, view, locale, actions);
      if (!block.isConnected) sidebar.prepend(block);
    }
  };
  return {
    render: () => {
      render();
    },
    rescale: () => {
      render(true);
    },
  };
}

function read(
  table: Element,
  sidebar: Element,
  scale: Scale | undefined,
  predictions: ReadonlyMap<string, number>,
  locale: string | undefined,
): View {
  const scheme = scale?.cutoffs;
  const weights = readWeights(
    sidebar.querySelector('#assignments-not-weighted table'),
  );
  const canvasGroups = readGroups(table, weights);
  const onlyGraded =
    sidebar.querySelector<HTMLInputElement>('#only_consider_graded_assignments')
      ?.checked ?? false;
  const canvasTotal = readTotal(sidebar, scale);
  // predictions only where the groups add up to Canvas's total, so the total
  // they predict is the one Canvas would show; not where it hides the total
  const percent = canvasTotal && parsePercent(canvasTotal.grade);
  const editable = percent !== undefined && agrees(canvasGroups, percent);
  const predicted = new Set(
    editable
      ? canvasGroups.map((g) => g.name).filter((n) => predictions.has(n))
      : [],
  );
  const groups = predicted.size
    ? withPredictions(canvasGroups, predictions)
    : canvasGroups;
  const weighted = isWeighted(groups);

  let total = canvasTotal;
  const projected = predicted.size ? totalOf(groups) : undefined;
  if (projected !== undefined) {
    const place = scheme && standing(projected, scheme);
    total = {
      grade: formatScore(projected, locale),
      letter: place?.letter,
      standing: place,
    };
  }

  const rows: Row[] = shownGroups(groups).map((group) => ({
    ...group,
    // Canvas's points are for Canvas's grade
    points: predicted.has(group.name) ? undefined : group.points,
    editable: editable && predictable(group, weighted),
    predicted: predicted.has(group.name),
  }));
  // what the last group to be graded needs, once the rest have a grade
  const open = rows.filter((row) => row.editable && row.percent === undefined);
  if (scheme && open.length === 1 && open[0]) {
    const need = needs(groups, open[0].name, scheme);
    if (need.length) open[0].needs = need;
  }
  return {
    total,
    current: projected === undefined ? undefined : canvasTotal?.grade,
    share: onlyGraded ? countedShare(groups) : undefined,
    scale:
      scale?.source === 'yours'
        ? 'your course scale'
        : scale?.source === 'school'
          ? 'school scale'
          : undefined,
    // the needs show on the one group left, which goes last with no final
    groups: finalsLast(rows, (row) => row.needs !== undefined),
  };
}

// Canvas's total and letter, or the student's scale's letter in its place;
// none when the teacher hid totals
function readTotal(sidebar: Element, scale: Scale | undefined): View['total'] {
  const grade = textOf(sidebar.querySelector('.final_grade .grade'));
  if (!grade) return undefined;
  const letter = textOf(sidebar.querySelector('#final_letter_grade_text'));
  const percent = parsePercent(grade);
  const place =
    scale && percent !== undefined
      ? standing(percent, scale.cutoffs)
      : undefined;
  if (isStudents(scale?.source)) {
    return { grade, letter: place?.letter, standing: place };
  }
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
  actions: Actions,
): void {
  const percent = (n: number) => formatScore(n, locale);
  const children: Node[] = [];
  const { total } = view;
  label.textContent = !total
    ? ''
    : view.current
      ? 'Projected total'
      : view.actual
        ? 'Total with What-If'
        : 'Total';
  if (total) {
    const score = el('p', 'cpp-grades-score', total.grade);
    if (total.letter) {
      score.append(' ', el('span', 'cpp-grades-letter', total.letter));
    }
    children.push(score);
    if (view.current) {
      children.push(
        undoNote(`Current ${view.current}`, 'Reset', actions.reset),
      );
    }
    if (view.actual) {
      // Canvas's Revert button, hidden with the rest of its sidebar
      children.push(
        undoNote(`Actual ${view.actual}`, 'Revert', actions.revert),
      );
    }
    const next = total.standing?.next;
    // a letter by the student's scale says so, as Canvas's own may differ
    const place = [
      next && `${percent(next.gap)} to ${next.letter}`,
      total.letter && view.scale,
    ].filter((part) => typeof part === 'string');
    const notes = [
      place.join(' · '),
      view.share !== undefined &&
        `Based on ${percent(view.share)} of the grade so far`,
    ].filter((note): note is string => typeof note === 'string' && !!note);
    for (const note of notes) children.push(el('p', 'cpp-grades-note', note));
  }
  if (view.groups.length) {
    const list = el('ul', '');
    list.append(
      ...view.groups.map((group) => groupRow(group, percent, actions.predict)),
    );
    children.push(list);
  }
  body.replaceChildren(...children);
}

// "Actual 89.67% · Revert"
function undoNote(text: string, undo: string, onClick: () => void) {
  const note = el('p', 'cpp-grades-note', `${text} · `);
  const button = el('button', 'cpp-grades-revert', undo);
  button.type = 'button';
  button.addEventListener('click', onClick);
  note.append(button);
  return note;
}

function groupRow(
  group: Row,
  percent: (n: number) => string,
  predict: Actions['predict'],
): HTMLElement {
  const row = el(
    'li',
    group.predicted
      ? 'cpp-predicted'
      : group.percent === undefined
        ? 'cpp-ungraded'
        : '',
  );
  row.dataset.group = group.name;
  const line = el('div', 'cpp-grades-row');
  const shown = group.percent === undefined ? '–' : percent(group.percent);
  line.append(
    el('span', 'cpp-grades-name', group.name),
    group.editable
      ? predictButton(group, shown, predict)
      : el('span', 'cpp-grades-value', shown),
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
  if (group.predicted) meta.push('predicted');
  row.append(line, bar);
  if (meta.length) row.append(el('div', 'cpp-grades-meta', meta.join(' · ')));
  if (group.needs) row.append(needTiles(group.name, group.needs, percent));
  return row;
}

// what the group needs for each letter, a card each: "A needs" over "88.16%"
function needTiles(
  name: string,
  needs: Need[],
  percent: (n: number) => string,
): HTMLElement {
  const tiles = el('div', 'cpp-grades-needs');
  tiles.setAttribute('role', 'list');
  tiles.setAttribute('aria-label', `What ${name} needs`);
  for (const need of needs) {
    const tile = el('div', 'cpp-grades-needs-tile');
    tile.setAttribute('role', 'listitem');
    tile.append(
      el('span', 'cpp-grades-for', `${need.letter} needs`),
      el('span', 'cpp-grades-need', percent(need.percent)),
    );
    tiles.append(tile);
  }
  return tiles;
}

// a group's grade as a button that turns into a field for a prediction:
// Enter or leaving it keeps what's typed, emptied it goes back to Canvas's
// grade, and Escape leaves it as it was
function predictButton(
  group: Row,
  shown: string,
  predict: Actions['predict'],
): HTMLElement {
  const button = el('button', 'cpp-grades-value', shown);
  button.type = 'button';
  button.title = 'Predict a grade';
  button.setAttribute('aria-label', `${group.name}: ${shown}. Predict a grade`);
  button.addEventListener('click', () => {
    const field = el('input', 'cpp-grades-value cpp-grades-input');
    field.type = 'text';
    field.inputMode = 'decimal';
    field.setAttribute(
      'aria-label',
      `Predicted grade for ${group.name}, in percent`,
    );
    field.value = group.percent === undefined ? '' : String(group.percent);
    // what it was: the prediction, or none for Canvas's grade
    const before = group.predicted ? group.percent : undefined;
    let done = false;
    const finish = (keep: boolean, refocus: boolean) => {
      // drawing the block again takes the field away, which can blur it
      if (done) return;
      done = true;
      const typed = field.value.trim();
      const value = typed
        ? parsePercent(typed.endsWith('%') ? typed : `${typed}%`)
        : undefined;
      const unreadable = !!typed && (value === undefined || value < 0);
      // Canvas's own grade typed back is no prediction
      const canvas = !group.predicted && value === group.percent;
      predict(
        group.name,
        !keep || unreadable ? before : canvas ? undefined : value,
        refocus,
      );
    };
    field.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== 'Escape') return;
      // the key would otherwise press the grade's button as it takes the
      // focus, and Escape close the ⋯ menu too
      event.preventDefault();
      event.stopPropagation();
      finish(event.key === 'Enter', true);
    });
    field.addEventListener('blur', () => {
      finish(true, false);
    });
    button.replaceWith(field);
    field.focus();
    field.select();
  });
  return button;
}

// Canvas shows its "NOT your official score" note while What-If scores are
// in the grades
function showsWhatIf(sidebar: Element): boolean {
  const note = sidebar.querySelector<HTMLElement>('#student-grades-revert');
  return !!note && note.style.display !== 'none';
}

// the course's grading scheme, from the ENV Canvas writes into a script
function pageScheme(): CourseScheme | undefined {
  for (const { text } of document.scripts) {
    if (!hasScheme(text)) continue;
    return { cutoffs: readScheme(text), isDefault: isDefaultScheme(text) };
  }
  return undefined;
}
