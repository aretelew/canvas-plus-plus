import { browser } from '#imports';

// Canvas on a school's own domain (canvas.case.edu). The manifest's content
// script only covers *.instructure.com, so the same script is registered at
// runtime for each domain the user turns on. The granted host permissions are
// the list of domains; nothing else is stored.

const SCRIPT_ID = 'canvas++:custom-domains';
// the manifest content script's built files (src/entrypoints/content.ts)
const SCRIPT = {
  js: ['content-scripts/content.js'],
  css: ['content-scripts/content.css'],
};

/** The match pattern for a page's site, like `https://canvas.case.edu/*`. */
export function sitePattern(url: string): string {
  return `${new URL(url).origin}/*`;
}

/** Whether the manifest's content script already runs on this page. */
export function isBuiltIn(url: string): boolean {
  const { protocol, hostname } = new URL(url);
  return (
    protocol === 'https:' &&
    (hostname === 'instructure.com' || hostname.endsWith('.instructure.com'))
  );
}

// Whether a granted origin is one site the user turned on, like
// `https://canvas.case.edu/*`. The optional permission for every https site
// can also be granted whole from the browser's settings; that must not theme
// (and write tags into) every site.
export function isCustomDomain(pattern: string): boolean {
  return /^https:\/\/[^*/]+\/\*$/.test(pattern) && !isBuiltIn(pattern);
}

/** Match patterns of the custom domains the user has turned on. */
export async function customDomains(): Promise<string[]> {
  const { origins = [] } = await browser.permissions.getAll();
  return origins.filter(isCustomDomain);
}

let syncing = Promise.resolve();

/**
 * Makes the registered content script match exactly the granted custom
 * domains. Calls are queued, so overlapping events can't register it twice.
 */
export function syncRegistration(): Promise<void> {
  syncing = syncing.then(sync, sync);
  return syncing;
}

async function sync(): Promise<void> {
  const [domains, registered] = await Promise.all([
    customDomains(),
    browser.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] }),
  ]);
  if (!domains.length) {
    if (registered.length) {
      await browser.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    }
    return;
  }
  const script = {
    id: SCRIPT_ID,
    matches: domains,
    ...SCRIPT,
    // as in the manifest: before first paint, and in Canvas's own frames
    // (the Rich Content Editor's has no URL of its own)
    runAt: 'document_start' as const,
    allFrames: true,
    matchOriginAsFallback: true,
  };
  // updated in place, so no page loads in a gap with nothing registered
  if (registered.length) {
    await browser.scripting.updateContentScripts([script]);
  } else {
    await browser.scripting.registerContentScripts([script]);
  }
}

/**
 * Themes pages already open on newly turned-on domains; a registered script
 * only runs on pages loaded after it.
 */
export async function themeOpenTabs(origins: string[]): Promise<void> {
  const domains = origins.filter(isCustomDomain);
  if (!domains.length) return;
  const tabs = await browser.tabs.query({ url: domains });
  await Promise.all(
    tabs.map(async ({ id }) => {
      if (id === undefined) return;
      const target = { tabId: id, allFrames: true };
      try {
        await browser.scripting.insertCSS({ target, files: SCRIPT.css });
        // executeScript takes its own path form, from the extension's root
        await browser.scripting.executeScript({
          target,
          files: ['/content-scripts/content.js'],
        });
      } catch {
        // the tab navigated away or closed meanwhile; nothing to theme
      }
    }),
  );
}
