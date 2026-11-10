/** An element's text with its whitespace collapsed; "" for none. */
export const textOf = (element: Element | null): string =>
  element?.textContent.replace(/\s+/g, ' ').trim() ?? '';

/**
 * The words in some HTML, its whitespace collapsed. Each piece of text is kept
 * apart, so "<p>Hi</p><p>there</p>" reads "Hi there", not "Hithere". It's
 * parsed into a document of its own, which runs no scripts and loads nothing.
 */
export function htmlText(html: string): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const walker = parsed.createTreeWalker(parsed.body, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  while (walker.nextNode()) {
    const { nodeValue, parentElement } = walker.currentNode;
    // a style sheet's or script's text isn't read
    if (parentElement?.closest('style, script')) continue;
    parts.push(nodeValue ?? '');
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
