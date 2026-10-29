import { saveOverride, type Work } from './planner';
import './done-check.css';

// The circle that checks work off in Canvas itself (a planner override, the
// same as Canvas's own To Do list), so the two agree. The same work can show
// in more than one place (its dashboard card and the sidebar's To Do), and
// every circle for it follows the one that was clicked.

interface View {
  check: HTMLInputElement;
  // shows the work as done or not around the circle (struck through, …)
  show: (done: boolean) => void;
}

const views = new WeakMap<Work, Set<View>>();

/** A circle for `work`; `show` is called with its state now and on changes. */
export function doneCheck(
  work: Work,
  show: (done: boolean) => void,
): HTMLInputElement {
  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'cpp-check';
  check.checked = work.done;
  check.setAttribute('aria-label', `Mark ${work.title} as done`);
  check.addEventListener('change', () => void markDone(work, check.checked));
  let set = views.get(work);
  if (!set) views.set(work, (set = new Set()));
  set.add({ check, show });
  show(work.done);
  return check;
}

// Shows the change at once and takes it back if Canvas doesn't save it.
async function markDone(work: Work, done: boolean): Promise<void> {
  display(work, done, true);
  const override = await saveOverride(work, done);
  if (override) {
    work.override = override;
    work.done = done;
  }
  display(work, work.done, false);
}

function display(work: Work, done: boolean, saving: boolean): void {
  const set = views.get(work);
  if (!set) return;
  for (const view of set) {
    // drawn again or turned off since; let it go
    if (!view.check.isConnected) {
      set.delete(view);
      continue;
    }
    view.check.checked = done;
    view.check.disabled = saving;
    view.show(done);
  }
}
