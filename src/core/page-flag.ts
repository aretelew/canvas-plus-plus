import type { WxtStorageItem } from '#imports';
import { readMirror, writeMirror } from './page-mirror';

// A switch that changes the page through CSS alone: while it's on, <html>
// carries `data-cpp-<name>` for the feature's stylesheet to key on. A copy in
// the page's localStorage (`canvas++:<name>`) sets it before the first paint,
// so what it hides doesn't show for a moment on every page load (see
// page-mirror.ts).
export async function syncPageFlag(
  setting: WxtStorageItem<boolean, Record<string, unknown>>,
  name: string,
): Promise<void> {
  const key = `canvas++:${name}`;
  const apply = (on: boolean) => {
    document.documentElement.toggleAttribute(`data-cpp-${name}`, on);
    writeMirror(key, on ? '1' : undefined);
  };
  apply(readMirror(key) !== undefined);
  apply(await setting.getValue());
  setting.watch(apply);
}
