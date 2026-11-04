import { daysUntil } from '@/core/days';

// How long until something's due, said the way a person would: "in 40
// minutes", "in 5 hours", "tomorrow", "in 3 days", "in 2 weeks".

export interface TimeLeft {
  text: string;
  // due within a day
  soon: boolean;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The time left until `due`, or undefined once it's past. */
export function timeLeft(
  due: Date,
  now: Date,
  locale?: string,
): TimeLeft | undefined {
  const left = due.getTime() - now.getTime();
  if (left <= 0) return undefined;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  // rounded down, so it never says there's more time than there is
  if (left < HOUR) {
    return {
      text: format.format(Math.max(1, Math.floor(left / MINUTE)), 'minute'),
      soon: true,
    };
  }
  if (left < DAY) {
    return { text: format.format(Math.floor(left / HOUR), 'hour'), soon: true };
  }
  // A day or more away it's counted in calendar days, so "tomorrow" is
  // tomorrow's date however late tonight it is.
  const days = daysUntil(due, now);
  if (days < 14) return { text: format.format(days, 'day'), soon: false };
  if (days < 60) {
    return { text: format.format(Math.floor(days / 7), 'week'), soon: false };
  }
  return { text: format.format(Math.round(days / 30), 'month'), soon: false };
}
