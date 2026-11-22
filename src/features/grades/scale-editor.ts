import { el } from '@/core/el';
import { parsePercent, type Cutoff } from './breakdown';
import { isScale, PRESETS, type Preset, type ScaleScope } from './scale';

// The form for the student's letter scales (scale.ts), opened from the grade
// breakdown's ⋯ menu under its head. A switch at the top says what it's for:
// this course, or every course at the school. Most schools use a common
// scale, so the presets come first, as a card each with its cutoffs written
// out: one click and Save. "Edit cutoffs" opens each letter's cutoff to
// change, and a scale that's no preset shows as a card of its own, Custom.
// The last letter is always from 0%.

export interface ScaleEditorOptions {
  /** the student's scales as saved, if there are */
  saved: Partial<Record<ScaleScope, Cutoff[]>>;
  /** the course has a scale of its own in Canvas */
  courseHasOwn: boolean;
  save: (scope: ScaleScope, cutoffs: Cutoff[]) => void;
  /** forgets the scale for the course, or for the school */
  remove: (scope: ScaleScope) => void;
  close: () => void;
}

let forms = 0;

export function scaleEditor(options: ScaleEditorOptions): HTMLFormElement {
  const { saved } = options;
  const id = `cpp-scale-${String(++forms)}`;
  const form = el('form', 'cpp-grades-scale');
  form.setAttribute('aria-label', 'Letter scale');
  form.noValidate = true;
  const title = el('h3', 'cpp-grades-scale-title', 'Letter scale');

  // the course's when there's one to change, else the school's
  let scope: ScaleScope =
    saved.course || options.courseHasOwn ? 'course' : 'school';
  let cutoffs: Cutoff[] = [];

  const scopes = el('div', 'cpp-grades-scale-scopes');
  scopes.setAttribute('role', 'group');
  scopes.setAttribute('aria-label', 'Set it for');
  const scopeButtons = (
    [
      ['course', 'This course'],
      ['school', 'All courses'],
    ] as const
  ).map(([value, text]) => {
    const button = el('button', '', text);
    button.type = 'button';
    button.addEventListener('click', () => {
      if (scope === value) return;
      scope = value;
      drawScope();
    });
    return { value, button };
  });
  scopes.append(...scopeButtons.map((s) => s.button));

  // what each scope's scale is for, and the way back from it; both are laid
  // over each other, the other one out of sight, so the switch moves nothing
  const about = el('div', 'cpp-grades-scale-about');
  const panels = new Map(
    (['course', 'school'] as const).map((value) => {
      const panel = el('div', 'cpp-grades-scale-panel');
      panel.append(el('p', 'cpp-grades-note', aboutScope(value, options)));
      if (saved[value]) {
        // going back is rarer, so it's a link under the note
        const remove = el(
          'button',
          'cpp-grades-revert',
          value === 'course'
            ? 'Remove this course’s scale'
            : 'Use Canvas’s scale',
        );
        remove.type = 'button';
        remove.addEventListener('click', () => {
          options.remove(value);
        });
        const line = el('p', 'cpp-grades-note');
        line.append(remove);
        panel.append(line);
      }
      about.append(panel);
      return [value, panel];
    }),
  );

  const cards = el('div', 'cpp-grades-scale-cards');
  cards.setAttribute('role', 'radiogroup');
  cards.setAttribute('aria-label', 'Scale');
  // a card for each preset, and one for the scale as it is when it's none
  const drawCards = () => {
    const preset = presetOf(cutoffs);
    const shown: Preset[] = preset
      ? PRESETS
      : [...PRESETS, { name: 'Custom', cutoffs }];
    const focused = cards.contains(document.activeElement);
    cards.replaceChildren(
      ...shown.map((option, i) => {
        const card = el('label', 'cpp-grades-scale-card');
        const radio = el('input', '');
        radio.type = 'radio';
        radio.name = id;
        radio.checked = preset ? option === preset : option.name === 'Custom';
        radio.setAttribute('aria-label', option.name);
        const summary = el(
          'span',
          'cpp-grades-scale-summary',
          describe(option.cutoffs),
        );
        summary.id = `${id}-${String(i)}`;
        radio.setAttribute('aria-describedby', summary.id);
        radio.addEventListener('change', () => {
          cutoffs = option.cutoffs;
          fillFields();
          drawCards();
        });
        card.append(
          radio,
          el('span', 'cpp-grades-scale-name', option.name),
          summary,
        );
        return card;
      }),
    );
    // the focus stays on the checked card as the cards are drawn again
    if (focused) {
      cards.querySelector<HTMLInputElement>('input:checked')?.focus();
    }
  };

  // each letter's cutoff, behind "Edit cutoffs"
  const fields = el('div', 'cpp-grades-scale-fields');
  fields.hidden = true;
  const error = el('p', 'cpp-grades-scale-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  let letters: string[] = [];
  const inputs = () => [...fields.querySelectorAll('input')];

  // the scale as typed, or undefined while it isn't one
  const typed = (): Cutoff[] | undefined => {
    const values = inputs().map((input) => {
      const text = input.value.trim();
      return parsePercent(text.endsWith('%') ? text : `${text}%`);
    });
    if (values.some((v) => v === undefined)) return undefined;
    const scale = letters.map((name, i) => ({
      name,
      value: i < values.length ? (values[i] ?? 0) / 100 : 0,
    }));
    return isScale(scale) ? scale : undefined;
  };

  // the last letter's "below 60%", after the cutoff above it
  const below = (scale: Cutoff[]) => {
    const above = scale.at(-2);
    return above ? `below ${percent(above.value)}` : '';
  };

  const fillFields = () => {
    letters = cutoffs.map((c) => c.name);
    error.hidden = true;
    fields.replaceChildren(
      ...cutoffs.map((cutoff, i) => {
        const row = el('label', 'cpp-grades-scale-row');
        row.append(el('span', 'cpp-grades-scale-letter', cutoff.name));
        if (i === cutoffs.length - 1) {
          row.append(el('span', 'cpp-grades-scale-rest', below(cutoffs)));
          return row;
        }
        const input = el('input', '');
        input.type = 'text';
        input.inputMode = 'decimal';
        input.value = String(round(cutoff.value * 100));
        input.setAttribute('aria-label', `${cutoff.name} from, in percent`);
        input.addEventListener('input', () => {
          error.hidden = true;
          const scale = typed();
          if (!scale) return;
          cutoffs = scale;
          drawCards();
          const rest = fields.querySelector('.cpp-grades-scale-rest');
          if (rest) rest.textContent = below(scale);
        });
        row.append(input, el('span', 'cpp-grades-scale-unit', '% and up'));
        return row;
      }),
    );
  };

  // the switch, the note in sight and the scale for the scope: the one saved for it,
  // else the other one, to start from
  const drawScope = () => {
    for (const { value, button } of scopeButtons) {
      button.setAttribute('aria-pressed', String(value === scope));
    }
    for (const [value, panel] of panels) {
      const off = value !== scope;
      panel.classList.toggle('cpp-grades-scale-off', off);
      panel.inert = off;
    }
    const course = scope === 'course';
    cutoffs =
      saved[scope] ??
      saved[course ? 'school' : 'course'] ??
      PRESETS[0]?.cutoffs ??
      [];
    drawCards();
    fillFields();
  };

  const footer = el('div', 'cpp-grades-scale-actions');
  const edit = el('button', 'cpp-grades-revert', 'Edit cutoffs');
  edit.type = 'button';
  edit.setAttribute('aria-expanded', 'false');
  edit.addEventListener('click', () => {
    fields.hidden = !fields.hidden;
    edit.setAttribute('aria-expanded', String(!fields.hidden));
    if (!fields.hidden) inputs()[0]?.focus();
  });
  const cancel = el('button', 'cpp-grades-revert', 'Cancel');
  cancel.type = 'button';
  cancel.addEventListener('click', options.close);
  const save = el('button', 'cpp-grades-scale-save', 'Save');
  save.type = 'submit';
  const end = el('span', 'cpp-grades-scale-end');
  end.append(cancel, save);
  footer.append(edit, end);

  form.append(title, scopes, about, cards, fields, error, footer);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    // what's typed while the cutoffs are open, else the card chosen
    const scale = fields.hidden ? cutoffs : typed();
    if (scale) {
      options.save(scope, scale);
      return;
    }
    error.textContent =
      'Each cutoff needs to be a percent under the one above it.';
    error.hidden = false;
  });
  form.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    options.close();
  });

  drawScope();
  return form;
}

// what a scale for the scope is for, beside what this course keeps
function aboutScope(scope: ScaleScope, options: ScaleEditorOptions): string {
  if (scope === 'course') {
    return options.courseHasOwn
      ? 'Only for this course, in place of the scale its teacher set in Canvas.'
      : 'Only for this course. Other courses keep theirs.';
  }
  if (options.saved.course) {
    return 'For courses with Canvas’s default scale or none. This course keeps the scale you set for it.';
  }
  return options.courseHasOwn
    ? 'For courses with Canvas’s default scale or none. This course keeps the scale its teacher set in Canvas.'
    : 'Used where a course has Canvas’s default scale, or none.';
}

// the preset the cutoffs are, if they're one; both are made the same way,
// percent over 100
function presetOf(cutoffs: Cutoff[]): Preset | undefined {
  const text = JSON.stringify(cutoffs);
  return PRESETS.find((preset) => JSON.stringify(preset.cutoffs) === text);
}

// "A 90 · B 80 · C 70 · D 60": every letter but the last, which is from 0
function describe(cutoffs: Cutoff[]): string {
  return cutoffs
    .slice(0, -1)
    .map((c) => `${c.name} ${String(round(c.value * 100))}`)
    .join(' · ');
}

const round = (n: number) => Math.round(n * 100) / 100;
const percent = (value: number) => `${String(round(value * 100))}%`;
