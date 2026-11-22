import { browser } from '#imports';
import { loadWorks } from '@/core/planner';
import { isFresh, type Reminders, upcoming } from './schedule';
import { reminders, type WorksMessage } from './storage';

// With reminders on, a Canvas page sends its site's upcoming work to the
// background (background.ts), which reminds the user of it. From the planner
// request the page's other features share, and only once what the background
// has for the site isn't fresh, so most pages ask for nothing.

export async function syncReminders(): Promise<void> {
  // the background takes only a top frame's list
  if (window.top !== window) return;
  let sending = false;
  const send = (state: Reminders | null) => {
    if (
      !state ||
      sending ||
      isFresh(state.sites[location.origin], Date.now())
    ) {
      return;
    }
    sending = true;
    void loadWorks().then(async (works) => {
      if (works) {
        const message: WorksMessage = {
          type: 'canvas++:works',
          works: upcoming(works, Date.now()),
        };
        // the background sends no answer, which Chrome may call an error
        await browser.runtime.sendMessage(message).catch(() => undefined);
      }
      sending = false;
    });
  };
  send(await reminders.getValue());
  // turned on while the page is open
  reminders.watch(send);
}
