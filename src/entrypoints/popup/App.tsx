import { useEffect, useState } from 'react';
import type { WxtStorageItem } from '#imports';
import { cardAssignments } from '@/features/assignments/storage';
import { cardGrades } from '@/features/grades/storage';
import { themeEnabled } from '@/features/themes/storage';
import { SiteAccess } from './SiteAccess';

function App() {
  return (
    <main className="w-72">
      {/* padded per section, not on main, so the header's line runs edge to edge */}
      <h1 className="border-b border-base-300 px-4 py-2 text-sm font-semibold">
        canvas++
      </h1>
      {/* settings rows, separated by lines rather than boxed */}
      <div className="divide-y divide-base-300 px-4 pb-1">
        <Switch label="Dark theme" setting={themeEnabled} />
        <Switch label="Grades on cards" setting={cardGrades} />
        <Switch label="Assignments on cards" setting={cardAssignments} />
        <SiteAccess />
      </div>
    </main>
  );
}

function Switch({
  label,
  setting,
}: {
  label: string;
  setting: WxtStorageItem<boolean, Record<string, unknown>>;
}) {
  // undefined until storage answers, so the switch never flips visibly on open
  const [on, setOn] = useState<boolean>();

  useEffect(() => {
    void setting.getValue().then(setOn);
    return setting.watch(setOn);
  }, [setting]);

  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2.5 text-sm">
      {label}
      <input
        type="checkbox"
        role="switch"
        className="toggle toggle-primary toggle-sm"
        checked={on ?? false}
        disabled={on === undefined}
        onChange={(e) => void setting.setValue(e.currentTarget.checked)}
      />
    </label>
  );
}

export default App;
