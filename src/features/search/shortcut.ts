// The search box's shortcut, ⌘K on Apple devices and Ctrl+K elsewhere, the
// key sites like GitHub and Slack use for theirs. Ctrl+K stays the browser's
// on a Mac, where it's a text field's "delete to the end of the line".

const apple = /Mac|iPhone|iPad/.test(navigator.userAgent);

export const SHORTCUT = apple ? '⌘K' : 'Ctrl+K';

/** The same, as ARIA names its keys, for `aria-keyshortcuts`. */
export const SHORTCUT_KEYS = apple ? 'Meta+K' : 'Control+K';

export function isShortcut(event: KeyboardEvent): boolean {
  const held = apple ? event.metaKey : event.ctrlKey;
  const others = apple ? event.ctrlKey : event.metaKey;
  return (
    held &&
    !others &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === 'k'
  );
}
