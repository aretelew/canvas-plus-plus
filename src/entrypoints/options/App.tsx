import { useEffect, useState } from 'react';
import { browser } from '#imports';
import { customDomains } from '@/features/domains/domains';

// Schools' own Canvas domains the user turned canvas++ on for (from the
// popup); removing one takes back the permission.
function App() {
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
    <main className="max-w-md p-4">
      <h1 className="pb-1 text-base font-semibold">Your school's Canvas</h1>
      <p className="pb-3 text-sm text-base-content/70">
        canvas++ runs on every *.instructure.com site. If your school uses its
        own domain, open it and click the canvas++ button to turn it on there.
      </p>
      {domains?.length ? (
        <ul className="rounded-box bg-base-200">
          {domains.map((pattern) => (
            <li
              key={pattern}
              className="flex items-center justify-between gap-4 px-3 py-2"
            >
              <span className="text-sm">{new URL(pattern).host}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  void browser.permissions.remove({ origins: [pattern] })
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}

export default App;
