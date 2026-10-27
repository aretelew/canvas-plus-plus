import type { WxtStorageItem } from '#imports';

// Features that add something to each dashboard course card (a grade, a list
// of assignments) while their setting is on. Canvas draws the cards with React
// after the page loads, and draws them again when the dashboard switches views
// (replacing their container), so while a feature is on an observer on the
// document gives every card without its addition one.

export interface Card {
  element: Element;
  courseId: string;
  // the course's name, as Canvas labels the card
  name: string | null;
}

interface CardFeature<T> {
  setting: WxtStorageItem<boolean, Record<string, unknown>>;
  // the class on what the feature adds, to tell decorated cards apart and
  // remove it all when turned off
  marker: string;
  // what the feature shows, loaded the first time it's on in a page
  load: () => Promise<T>;
  // adds an element with the marker class to the card, or nothing
  decorate: (card: Card, data: T) => void;
}

export async function syncCardFeature<T>({
  setting,
  marker,
  load,
  decorate,
}: CardFeature<T>): Promise<void> {
  // the cards are on the dashboard, the site's root, and never in a frame
  if (location.pathname !== '/' || window.top !== window) return;
  const cards = document.getElementsByClassName('ic-DashboardCard');
  let data: Promise<T> | undefined;
  let observer: MutationObserver | undefined;
  let enabled = false;

  const decorateAll = (value: T) => {
    for (const element of cards) {
      if (element.getElementsByClassName(marker).length > 0) continue;
      const card = readCard(element);
      if (card) decorate(card, value);
    }
  };

  const apply = async (on: boolean) => {
    enabled = on;
    if (!on) {
      observer?.disconnect();
      observer = undefined;
      for (const added of document.querySelectorAll(`.${marker}`)) {
        added.remove();
      }
      return;
    }
    const value = await (data ??= load());
    // turned off (or on twice) while it loaded
    if (!enabled || observer) return;
    observer = new MutationObserver(() => {
      decorateAll(value);
    });
    observer.observe(document, { childList: true, subtree: true });
    decorateAll(value);
  };

  // not awaited: a switch flipped while the data loads must still be heard
  void apply(await setting.getValue());
  setting.watch((on) => void apply(on));
}

function readCard(element: Element): Card | undefined {
  const href = element
    .querySelector('.ic-DashboardCard__link')
    ?.getAttribute('href');
  const courseId = /\/courses\/(\d+)/.exec(href ?? '')?.[1];
  if (courseId === undefined) return undefined;
  return { element, courseId, name: element.getAttribute('aria-label') };
}
