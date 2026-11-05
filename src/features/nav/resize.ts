import { readMirror, writeMirror } from '@/core/page-mirror';
import { NAV_MIN_WIDTH as MIN_WIDTH, navWidth } from './storage';

// The sidebar's width, which the user sets by dragging its edge (or with the
// arrow keys on the edge's handle) and resets with a double-click. nav.css
// reads it from `--cpp-nav-dragged-width`, set in a <style> of its own: a theme's
// recolor pass clears the `--cpp-` properties in <html>'s inline style. A copy
// in the page's localStorage sets it before the first paint (see
// page-mirror.ts).

const MIRROR_KEY = 'canvas++:nav-width';
const MAX_WIDTH = 400;
const STEP = 16;

const clamp = (width: number) =>
  Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width)));

let shown = MIN_WIDTH;
let sheet: HTMLStyleElement | undefined;

function show(width: number): void {
  shown = width;
  // at document_start there's no <head> yet
  sheet ??= document.documentElement.appendChild(
    document.createElement('style'),
  );
  sheet.textContent = `:root { --cpp-nav-dragged-width: ${String(width)}px; }`;
  for (const handle of document.querySelectorAll('.cpp-nav-resize')) {
    handle.setAttribute('aria-valuenow', String(width));
  }
}

function apply(width: number): void {
  const next = clamp(width);
  show(next);
  writeMirror(MIRROR_KEY, next === MIN_WIDTH ? undefined : String(next));
}

export async function syncNavWidth(): Promise<void> {
  const mirrored = Number(readMirror(MIRROR_KEY));
  if (mirrored) show(clamp(mirrored));
  apply(await navWidth.getValue());
  navWidth.watch(apply);
}

/** The handle on the sidebar's right edge. `className` marks it as ours. */
export function resizeHandle(className: string): HTMLElement {
  const handle = document.createElement('div');
  handle.className = `${className} cpp-nav-resize`;
  handle.tabIndex = 0;
  handle.title = 'Drag to resize, double-click to reset';
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-label', 'Resize sidebar');
  handle.setAttribute('aria-valuemin', String(MIN_WIDTH));
  handle.setAttribute('aria-valuemax', String(MAX_WIDTH));
  handle.setAttribute('aria-valuenow', String(shown));

  const save = (width: number) => {
    const next = clamp(width);
    apply(next);
    void navWidth.setValue(next);
  };

  handle.addEventListener('pointerdown', (down) => {
    if (down.button !== 0) return;
    down.preventDefault();
    handle.setPointerCapture(down.pointerId);
    document.documentElement.toggleAttribute('data-cpp-nav-resizing', true);
    // a cancelled drag has no position of its own, so it keeps the last one
    let width = shown;
    const drag = new AbortController();
    const end = () => {
      drag.abort();
      document.documentElement.removeAttribute('data-cpp-nav-resizing');
      save(width);
    };
    handle.addEventListener(
      'pointermove',
      (event) => {
        width = clamp(event.clientX);
        show(width);
      },
      { signal: drag.signal },
    );
    handle.addEventListener('pointerup', end, { signal: drag.signal });
    handle.addEventListener('pointercancel', end, { signal: drag.signal });
  });

  handle.addEventListener('dblclick', () => {
    save(MIN_WIDTH);
  });

  handle.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    save(shown + (event.key === 'ArrowLeft' ? -STEP : STEP));
  });

  return handle;
}
