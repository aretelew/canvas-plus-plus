import { useEffect, useState } from 'react';
import { themeEnabled } from '@/features/themes/storage';

function App() {
  // undefined until storage answers, so the switch never flips visibly on open
  const [enabled, setEnabled] = useState<boolean>();

  useEffect(() => {
    void themeEnabled.getValue().then(setEnabled);
    return themeEnabled.watch(setEnabled);
  }, []);

  return (
    <main className="w-72">
      {/* padded per section, not on main, so the header's line runs edge to edge */}
      <h1 className="border-b border-base-300 px-4 py-2 text-sm font-semibold">
        canvas++
      </h1>
      {/* settings rows, separated by lines rather than boxed */}
      <div className="divide-y divide-base-300 px-4 pb-1">
        <label className="flex cursor-pointer items-center justify-between gap-4 py-2.5 text-sm">
          Dark theme
          <input
            type="checkbox"
            role="switch"
            className="toggle toggle-primary toggle-sm"
            checked={enabled ?? false}
            disabled={enabled === undefined}
            onChange={(e) =>
              void themeEnabled.setValue(e.currentTarget.checked)
            }
          />
        </label>
      </div>
    </main>
  );
}

export default App;
