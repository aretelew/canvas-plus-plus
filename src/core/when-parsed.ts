// Content scripts start at document_start, before the body exists: runs `run`
// once the document has been parsed, or now if it has been.
export function whenParsed(run: () => void): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else run();
}
