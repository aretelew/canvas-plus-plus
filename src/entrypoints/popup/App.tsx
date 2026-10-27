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
    <>
      <h1>canvas++</h1>
      <label>
        <input
          type="checkbox"
          role="switch"
          checked={enabled ?? false}
          disabled={enabled === undefined}
          onChange={(e) => void themeEnabled.setValue(e.currentTarget.checked)}
        />
        Dark theme
      </label>
    </>
  );
}

export default App;
