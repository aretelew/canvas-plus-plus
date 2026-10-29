import { useEffect, useState } from 'react';
import { browser } from '#imports';
import { looksLikeCanvas } from '@/features/domains/detect';
import {
  customDomains,
  isBuiltIn,
  sitePattern,
} from '@/features/domains/domains';

// The current tab's site, if it's Canvas on a school's own domain.
type Site = { status: 'offer' | 'on'; host: string; pattern: string } | null;

async function currentSite(): Promise<Site> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith('https://') || isBuiltIn(tab.url)) {
    return null;
  }
  const host = new URL(tab.url).host;
  const pattern = sitePattern(tab.url);
  if ((await customDomains()).includes(pattern)) {
    return { status: 'on', host, pattern };
  }
  // opening the popup grants access to this tab (activeTab), enough to look
  const [injection] = await browser.scripting
    .executeScript({ target: { tabId: tab.id }, func: looksLikeCanvas })
    .catch(() => []);
  return injection?.result === true ? { status: 'offer', host, pattern } : null;
}

export function SiteAccess() {
  const [site, setSite] = useState<Site>(null);

  useEffect(() => {
    void currentSite().then(setSite);
  }, []);

  // a row of the popup's main page, under the sections
  if (!site) return null;
  if (site.status === 'on') {
    return (
      <div className="px-4 py-2.5">
        <SiteStatus host={site.host} state="Enabled" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <SiteStatus host={site.host} state="Not enabled" />
      <button
        type="button"
        className="btn btn-primary btn-sm shrink-0 rounded-none text-sm transition-none"
        aria-label={`Enable canvas++ on ${site.host}`}
        onClick={() => {
          // first thing in the click: Firefox only allows it from a user action
          void browser.permissions
            .request({ origins: [site.pattern] })
            .then((granted) => {
              if (granted) setSite({ ...site, status: 'on' });
            });
        }}
      >
        Enable
      </button>
    </div>
  );
}

// The site's host, in mono like an address, over what canvas++ does there.
function SiteStatus({ host, state }: { host: string; state: string }) {
  return (
    <div className="min-w-0 text-sm">
      {/* hosts have no spaces to wrap at, and some are long */}
      <p className="font-mono wrap-anywhere">{host}</p>
      <p className="text-base-content/70">{state}</p>
    </div>
  );
}
