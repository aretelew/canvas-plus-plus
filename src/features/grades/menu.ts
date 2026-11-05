import { el } from '@/core/el';
import { textOf } from '@/core/text';

// Canvas's controls in the Grades sidebar ("Calculate based only on graded
// assignments", "Show All Details", "Show Saved "What-If" Scores") behind a
// ⋯ button at the top of the grade breakdown (sidebar.ts), instead of a
// stack of buttons under it that few people use. Canvas's own stay in the
// page, hidden (sidebar.css): each item here clicks Canvas's, so Canvas's
// handlers do what they always did, and the items carry Canvas's labels, in
// the page's language.

export interface ControlsMenu {
  element: HTMLElement;
  /** brings the items in line with Canvas's controls, as its scripts change them */
  sync(): void;
}

/** `changed` runs after an item clicks one of Canvas's controls. */
export function controlsMenu(
  sidebar: Element,
  changed: () => void,
): ControlsMenu {
  const element = el('div', 'cpp-grades-menu');
  const toggle = el('button', 'cpp-grades-more');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Grade options');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.append(dots());
  const panel = el('div', 'cpp-grades-panel');
  panel.hidden = true;
  element.append(toggle, panel);

  let listening: AbortController | undefined;
  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    listening?.abort();
    listening = undefined;
    if (!open) return;
    listening = new AbortController();
    const { signal } = listening;
    const away = (event: Event) => {
      if (!element.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away, { signal });
    document.addEventListener('focusin', away, { signal });
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape') return;
        setOpen(false);
        toggle.focus();
      },
      { signal },
    );
  };
  toggle.addEventListener('click', () => {
    setOpen(panel.hidden);
  });

  const syncs: (() => void)[] = [];

  // one of Canvas's switches, as a checkbox that leaves the menu open
  const addSwitch = (canvas: HTMLElement, label: string, on: () => boolean) => {
    const item = el('label', 'cpp-grades-item');
    const box = el('input', '');
    box.type = 'checkbox';
    box.addEventListener('change', () => {
      canvas.click();
      changed();
    });
    item.append(box, label);
    panel.append(item);
    syncs.push(() => {
      box.checked = on();
    });
  };

  const onlyGraded = sidebar.querySelector<HTMLInputElement>(
    '#only_consider_graded_assignments',
  );
  if (onlyGraded) {
    const label = sidebar.querySelector(
      'label[for="only_consider_graded_assignments"]',
    );
    addSwitch(onlyGraded, textOf(label), () => onlyGraded.checked);
  }
  // a button Canvas marks `showAll` while on, and relabels "Hide All
  // Details"; the item keeps the first label
  const details = sidebar.querySelector<HTMLElement>(
    '#show_all_details_button',
  );
  if (details) {
    addSwitch(details, textOf(details), () =>
      details.classList.contains('showAll'),
    );
  }

  // Canvas's button for the What-If scores the student saved, there only
  // while it has some not yet shown; it closes the menu as it changes them
  const saved = sidebar.querySelector<HTMLElement>('.show_guess_grades_link');
  if (saved) {
    const item = el('button', 'cpp-grades-item', textOf(saved));
    item.type = 'button';
    item.addEventListener('click', () => {
      setOpen(false);
      saved.click();
      changed();
    });
    panel.append(item);
    syncs.push(() => {
      const wrapper = saved.closest<HTMLElement>('.show_guess_grades');
      const hidden =
        !wrapper?.classList.contains('exists') ||
        wrapper.style.display === 'none';
      if (item.hidden !== hidden) item.hidden = hidden;
    });
  }

  // in the place of Canvas's paragraph about What-If scores, which is there
  // only when the grades can take one
  if (sidebar.querySelector('#whatif-score-description')) {
    panel.append(
      el(
        'p',
        'cpp-grades-tip',
        'Click a score in the table to try a What-If grade.',
      ),
    );
  }

  element.hidden = !panel.childElementCount;
  return {
    element,
    sync: () => {
      for (const sync of syncs) sync();
    },
  };
}

// three dots, in the text color
function dots(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  for (const x of [3, 8, 13]) {
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', String(x));
    dot.setAttribute('cy', '8');
    dot.setAttribute('r', '1.5');
    svg.append(dot);
  }
  return svg;
}
