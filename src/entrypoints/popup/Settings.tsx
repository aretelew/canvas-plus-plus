import { type ReactNode, useEffect, useState } from 'react';
import { browser, storage } from '#imports';
import { customDomains } from '@/features/domains/domains';
import { External } from './icons';
import { PageLink } from './PageLink';
import { settings } from './sections';

const REPO = 'https://github.com/aretelew/canvas-plus-plus';

// The popup's settings page, opened by the gear: what's set once rather than
// flipped often. Rows, like the popup's other pages.
export function Settings({
  sitesFocused,
  onOpenSites,
}: {
  sitesFocused: boolean;
  onOpenSites: () => void;
}) {
  const { version } = browser.runtime.getManifest();
  return (
    <>
      <PageLink label="Sites" focused={sitesFocused} onOpen={onOpenSites} />
      <Reset />
      <ExternalLink href={`${REPO}/issues/new`}>Report a problem</ExternalLink>
      <ExternalLink href={`${REPO}/blob/main/PRIVACY.md`}>
        Privacy policy
      </ExternalLink>
      <p className="px-4 py-2.5 text-sm text-base-content/70">
        Version {version}
      </p>
    </>
  );
}

// Where canvas++ runs: everywhere Instructure hosts Canvas, and schools' own
// Canvas domains the user turned it on for (from the popup's main page);
// removing one takes back the permission.
export function Sites() {
  const [domains, setDomains] = useState<string[]>();

  useEffect(() => {
    const load = () => void customDomains().then(setDomains);
    load();
    browser.permissions.onAdded.addListener(load);
    browser.permissions.onRemoved.addListener(load);
    return () => {
      browser.permissions.onAdded.removeListener(load);
      browser.permissions.onRemoved.removeListener(load);
    };
  }, []);

  return (
    <>
      <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
        <span className="font-mono">*.instructure.com</span>
        <span className="text-base-content/70">Always on</span>
      </div>
      {domains?.map((pattern) => {
        const host = new URL(pattern).host;
        return (
          <ActionRow
            key={pattern}
            action="Remove"
            actionLabel={`Remove canvas++ from ${host}`}
            onAction={() =>
              void browser.permissions.remove({ origins: [pattern] })
            }
          >
            {/* hosts have no spaces to wrap at, and some are long */}
            <span className="font-mono wrap-anywhere">{host}</span>
          </ActionRow>
        );
      })}
      <p className="px-4 py-2.5 text-sm text-base-content/70">
        If your school's Canvas has its own domain, open it and enable canvas++
        from this popup.
      </p>
    </>
  );
}

// Puts every setting back to its default. The schools' domains are
// permissions, not settings, so they stay. It takes a second click, so a stray
// one doesn't undo every choice.
function Reset() {
  const [step, setStep] = useState<'idle' | 'confirming' | 'done'>('idle');

  // asking again, or saying it's done, only for a few seconds
  useEffect(() => {
    if (step === 'idle') return;
    const timer = setTimeout(() => {
      setStep('idle');
    }, 3000);
    return () => {
      clearTimeout(timer);
    };
  }, [step]);

  return (
    <ActionRow
      action={
        step === 'confirming' ? 'Confirm' : step === 'done' ? 'Done' : 'Reset'
      }
      warning={step === 'confirming'}
      onAction={() => {
        if (step === 'confirming') {
          void storage.removeItems(settings).then(() => {
            setStep('done');
          });
        } else {
          setStep('confirming');
        }
      }}
    >
      Reset all settings
    </ActionRow>
  );
}

// A row with a button at its end for taking something away: it fills the
// end top to bottom, like the header's back arrow fills its corner, and turns
// red on hover, or while it's `warning` that a second click will go ahead.
function ActionRow({
  children,
  action,
  actionLabel,
  warning = false,
  onAction,
}: {
  children: ReactNode;
  action: string;
  actionLabel?: string;
  warning?: boolean;
  onAction: () => void;
}) {
  return (
    <div className="flex justify-between gap-4 pl-4 text-sm">
      <span className="min-w-0 py-2.5">{children}</span>
      <button
        type="button"
        className={`shrink-0 cursor-pointer px-4 hover:bg-base-200 hover:text-error ${warning ? 'text-error' : 'text-base-content/70'}`}
        aria-label={actionLabel}
        onClick={onAction}
      >
        {action}
      </button>
    </div>
  );
}

// A row that opens the link in a tab, which closes the popup.
function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center justify-between px-4 py-2.5 text-sm hover:bg-base-200"
    >
      {children}
      <External className="text-base-content/50 group-hover:text-base-content" />
    </a>
  );
}
