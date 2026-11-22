import { browser } from '#imports';

// Only under `npm run dev`. WXT's background connects to the dev server once
// and never reconnects: once that socket drops, every build after it is missed
// until the extension is reloaded by hand. This keeps a socket of its own, and
// when it closes, tries again until the server answers and then reloads the
// extension. Starting up, WXT's background reconnects, registers the content
// script as built now, and reloads the open Canvas tabs.

// the dev server's address, which WXT defines in dev builds
declare const __DEV_SERVER_ORIGIN__: string;

const RETRY_MS = 2000;

export function reloadWhenDevServerReturns(): void {
  connect(false);
}

// A connection that fails closes too, so this also retries while the server
// is down.
function connect(reloadOnOpen: boolean): void {
  // Vite's dev server only accepts sockets with its protocol
  const socket = new WebSocket(__DEV_SERVER_ORIGIN__, 'vite-hmr');
  if (reloadOnOpen) {
    socket.addEventListener('open', () => {
      browser.runtime.reload();
    });
  }
  socket.addEventListener(
    'close',
    () => {
      setTimeout(() => {
        connect(true);
      }, RETRY_MS);
    },
    { once: true },
  );
}
