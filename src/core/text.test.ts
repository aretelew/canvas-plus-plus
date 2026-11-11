// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { htmlText } from './text';

describe('htmlText', () => {
  it('keeps the words of separate elements apart and collapses whitespace', () => {
    expect(htmlText('<p>Midterm  is</p><p>in\n<b>Room</b>&nbsp;12</p>')).toBe(
      'Midterm is in Room 12',
    );
  });

  it("leaves out a style sheet's and a script's text", () => {
    expect(
      htmlText('<style>p { color: red }</style><p>Hi</p><script>x()</script>'),
    ).toBe('Hi');
  });

  it('is empty for no text', () => {
    expect(htmlText('')).toBe('');
    expect(htmlText('<img src="a.png">')).toBe('');
  });
});
