/**
 * Calendar days from `now`'s date to `date`'s, in local time: 0 on the same
 * day, 1 the next, negative before.
 */
export function daysUntil(date: Date, now: Date): number {
  return Math.round(
    (startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );
}

// local midnight; rounding the days between two absorbs a DST hour
function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}
