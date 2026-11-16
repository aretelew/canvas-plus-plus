import { daysUntil } from '@/core/days';
import { timeLeft } from '@/core/time-left';
import type { Entry } from './match';

// The date on a result's second line: when work is due or a post was posted,
// as a person would say it ("in 5 hours", "Tomorrow", "Tue, Nov 4"). Work
// still to hand in is urgent once it's late or due within a day, and marked
// less so when it's due tomorrow.

export interface When {
  text: string;
  urgency?: 'urgent' | 'tomorrow';
}

/** Undefined for what has no date. */
export function when(
  { due, posted, pending }: Pick<Entry, 'due' | 'posted' | 'pending'>,
  now: Date,
  locale?: string,
): When | undefined {
  if (due !== undefined) {
    return dueWhen(new Date(due), now, pending === true, locale);
  }
  if (posted !== undefined) {
    return { text: dayText(new Date(posted), now, locale) };
  }
  return undefined;
}

// Within a day it's the time left, as on the dashboard; past that, the day.
function dueWhen(
  due: Date,
  now: Date,
  pending: boolean,
  locale: string | undefined,
): When {
  const left = timeLeft(due, now, locale);
  const text = left?.soon ? left.text : dayText(due, now, locale);
  if (!pending) return { text };
  if (!left || left.soon) return { text, urgency: 'urgent' };
  return daysUntil(due, now) === 1 ? { text, urgency: 'tomorrow' } : { text };
}

// "Yesterday", "Today" and "Tomorrow", and "Tue, Nov 4" for other days
function dayText(date: Date, now: Date, locale: string | undefined): string {
  const days = daysUntil(date, now);
  if (Math.abs(days) > 1) {
    return date.toLocaleDateString(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }
  const word = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
    days,
    'day',
  );
  return word.charAt(0).toLocaleUpperCase(locale) + word.slice(1);
}
