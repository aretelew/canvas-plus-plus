import { describe, expect, it } from 'vitest';
import { timeLeft } from './time-left';

// a Tuesday afternoon, local time
const NOW = new Date(2026, 9, 27, 16, 0);
const at = (day: number, hour = 23, minute = 59) =>
  new Date(2026, 9, day, hour, minute);
const left = (due: Date) => timeLeft(due, NOW, 'en-US');

describe('timeLeft', () => {
  it('says nothing once the due date has passed', () => {
    expect(left(at(27, 15, 59))).toBeUndefined();
    expect(left(NOW)).toBeUndefined();
  });

  it('counts minutes in the last hour, never zero', () => {
    expect(left(at(27, 16, 40))).toEqual({ text: 'in 40 minutes', soon: true });
    expect(left(new Date(NOW.getTime() + 20_000))).toEqual({
      text: 'in 1 minute',
      soon: true,
    });
  });

  it('counts whole hours within a day, rounded down', () => {
    expect(left(at(27, 21, 59))).toEqual({ text: 'in 5 hours', soon: true });
    expect(left(at(28, 15, 59))).toEqual({ text: 'in 23 hours', soon: true });
  });

  it('counts calendar days from a day away', () => {
    expect(left(at(28, 16, 30))).toEqual({ text: 'tomorrow', soon: false });
    expect(left(at(29, 9, 0))).toEqual({ text: 'in 2 days', soon: false });
    expect(left(at(31 + 9))).toEqual({ text: 'in 13 days', soon: false });
  });

  it('counts weeks, then months', () => {
    expect(left(at(31 + 10))).toEqual({ text: 'in 2 weeks', soon: false });
    expect(left(at(31 + 30 + 20))).toEqual({ text: 'in 7 weeks', soon: false });
    expect(left(new Date(2027, 1, 1))).toEqual({
      text: 'in 3 months',
      soon: false,
    });
  });
});
