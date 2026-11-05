/** An element's text with its whitespace collapsed; "" for none. */
export const textOf = (element: Element | null): string =>
  element?.textContent.replace(/\s+/g, ' ').trim() ?? '';
