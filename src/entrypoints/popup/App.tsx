import { useEffect, useState } from 'react';
import type { WxtStorageItem } from '#imports';
import { cardAssignments } from '@/features/assignments/storage';
import { cardGrades } from '@/features/grades/storage';
import { hideLogo } from '@/features/logo/storage';
import { themeEnabled, themeOled } from '@/features/themes/storage';
import { SiteAccess } from './SiteAccess';

type Setting = WxtStorageItem<boolean, Record<string, unknown>>;

function App() {
  const dark = useSetting(themeEnabled);
  return (
    <main className="w-72">
      {/* padded per section, not on main, so the header's line runs edge to edge */}
      <h1 className="border-b border-base-300 px-4 py-2 text-sm font-semibold">
        canvas++
      </h1>
      {/* settings rows, separated by lines rather than boxed */}
      <div className="divide-y divide-base-300 px-4 pb-1">
        <Switch label="Dark theme" setting={themeEnabled} />
        <Switch
          label="True black (OLED)"
          setting={themeOled}
          nested
          disabled={!dark}
        />
        <Switch label="Grades on cards" setting={cardGrades} />
        <Switch label="Assignments on cards" setting={cardAssignments} />
        <Switch label="Hide school logo" setting={hideLogo} />
        <SiteAccess />
      </div>
    </main>
  );
}

// A setting's value, kept current; undefined until storage answers.
function useSetting(setting: Setting): boolean | undefined {
  const [on, setOn] = useState<boolean>();
  useEffect(() => {
    void setting.getValue().then(setOn);
    return setting.watch(setOn);
  }, [setting]);
  return on;
}

// `nested` is a sub-setting of the switch above it, indented under it.
function Switch({
  label,
  setting,
  nested = false,
  disabled = false,
}: {
  label: string;
  setting: Setting;
  nested?: boolean;
  disabled?: boolean;
}) {
  const on = useSetting(setting);
  const loading = on === undefined;

  return (
    <label
      className={`flex items-center justify-between gap-4 py-2.5 text-sm ${nested ? 'pl-4' : ''} ${disabled ? 'cursor-default text-base-content/50' : 'cursor-pointer'}`}
    >
      {label}
      {/* hidden until storage answers, then swapped for a fresh input: flipping
          this one would play the toggle's slide every time the popup opens */}
      <input
        key={loading ? 'loading' : 'loaded'}
        type="checkbox"
        role="switch"
        className={`toggle toggle-primary toggle-sm ${loading ? 'invisible' : ''}`}
        checked={on ?? false}
        disabled={loading || disabled}
        onChange={(e) => void setting.setValue(e.currentTarget.checked)}
      />
    </label>
  );
}

export default App;
