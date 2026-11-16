import { describe, expect, it } from 'vitest';
import { when } from './when';

// a Saturday afternoon, in the local time zone the dates are read in
const NOW = new Date(2026, 10, 14, 15, 0);
// 11:59 PM that many days on, as Canvas has things due
const day = (days: number) =>
  new Date(2026, 10, 14 + days, 23, 59).toISOString();
const hoursOn = (hours: number) =>
  new Date(NOW.getTime() + hours * 3_600_000).toISOString();

describe('when', () => {
  it('says the time left within a day, and the day after that', () => {
    expect(when({ due: hoursOn(5) }, NOW, 'en-US')?.text).toBe('in 5 hours');
    expect(when({ due: day(1) }, NOW, 'en-US')?.text).toBe('Tomorrow');
    expect(when({ due: day(4) }, NOW, 'en-US')?.text).toBe('Wed, Nov 18');
    expect(when({ due: day(-1) }, NOW, 'en-US')?.text).toBe('Yesterday');
    expect(when({ due: day(-4) }, NOW, 'en-US')?.text).toBe('Tue, Nov 10');
  });

  it("marks work still to hand in as urgent when it's late or due within a day, and when it's due tomorrow", () => {
    const pending = (due: string) =>
      when({ due, pending: true }, NOW, 'en-US')?.urgency;
    expect(pending(day(-4))).toBe('urgent');
    expect(pending(hoursOn(-1))).toBe('urgent');
    expect(pending(hoursOn(5))).toBe('urgent');
    expect(pending(day(1))).toBe('tomorrow');
    expect(pending(day(4))).toBeUndefined();
  });

  it("doesn't mark what's handed in, however late or soon", () => {
    for (const due of [day(-4), hoursOn(5), day(1)]) {
      expect(when({ due }, NOW, 'en-US')?.urgency).toBeUndefined();
    }
  });

  it('says when a post was posted, never marked', () => {
    expect(when({ posted: hoursOn(-2) }, NOW, 'en-US')).toEqual({
      text: 'Today',
    });
    expect(when({ posted: day(-3) }, NOW, 'en-US')).toEqual({
      text: 'Wed, Nov 11',
    });
  });

  it('has nothing to say for what has no date', () => {
    expect(when({}, NOW, 'en-US')).toBeUndefined();
  });
});
