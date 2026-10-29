// Focuses an element as it appears, or as a ref is pointed at it. Module-level,
// so re-renders don't call it again.
export function focus(el: HTMLElement | null) {
  el?.focus();
}
