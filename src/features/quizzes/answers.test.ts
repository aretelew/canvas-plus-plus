// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CORRECT,
  markCorrectAnswers,
  REDUNDANT,
  unmarkCorrectAnswers,
} from './answers';

// New Quizzes' markup for a multiple choice result, trimmed to what's read:
// an option is plain, or boxed as right or wrong with a note under the box: a
// correct answer's text under its label, or a verdict with no label
const option = (text: string, picked = false) => `
  <div data-cid="RadioInput"><div>
    <input type="radio" disabled ${picked ? 'checked' : ''}>
    <label><span><div class="user_content"><p>${text}</p></div></span></label>
  </div></div>`;
const checkbox = (text: string, picked = false) => `
  <div data-cid="Checkbox"><div>
    <input type="checkbox" disabled ${picked ? 'checked' : ''}>
    <label><span><div class="user_content"><p>${text}</p></div></span></label>
  </div></div>`;
const boxed = (inner: string, note: string) => `
  <div><div class="fs-mask">
    <div><div>✗</div><div>${inner}</div></div>
    <div><span>${note.startsWith('<') ? 'Correct Answer:' : ''}</span>
      <div class="user_content">${note}</div></div>
  </div></div>`;
const question = (...rows: string[]) =>
  `<div data-automation="sdk-item-wrapper"><div>${rows.join('')}</div></div>`;

const TAGS = `[${CORRECT}], [${REDUNDANT}]`;

const rowOf = (text: string) =>
  [...document.querySelectorAll('[data-cid="RadioInput"]')].find(
    (o) => o.textContent.trim() === text,
  )?.parentElement;

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('markCorrectAnswers', () => {
  it('tags the option the note names, and the note', () => {
    document.body.innerHTML = question(
      `<div>${option('Presentation to network')}</div>`,
      boxed(
        option('Network to presentation', true),
        '<p>Presentation to network</p>',
      ),
      `<div>${option('Short to host')}</div>`,
    );
    markCorrectAnswers(document.body);
    expect(rowOf('Presentation to network')?.hasAttribute(CORRECT)).toBe(true);
    expect(document.querySelectorAll(`[${CORRECT}]`)).toHaveLength(1);
    expect(document.querySelector(`[${REDUNDANT}]`)?.textContent).toContain(
      'Correct Answer:',
    );
  });

  it('matches across the whitespace Canvas writes', () => {
    document.body.innerHTML = question(
      `<div>${option('a&nbsp;stateful  firewall')}</div>`,
      boxed(option('a packet filter', true), '<p>a stateful firewall</p>'),
    );
    markCorrectAnswers(document.body);
    expect(document.querySelectorAll(`[${CORRECT}]`)).toHaveLength(1);
  });

  it("tags a wrong pick's unlabelled note, not a missed option's", () => {
    document.body.innerHTML = question(
      boxed(checkbox('Slower', true), 'Selected Answer - Incorrect'),
      boxed(checkbox('Faster'), 'Missed Option - Incorrect'),
    );
    markCorrectAnswers(document.body);
    const tagged = [...document.querySelectorAll(TAGS)];
    expect(tagged.map((n) => n.textContent.trim())).toEqual([
      'Selected Answer - Incorrect',
    ]);
  });

  it('leaves a correct answer note that names no option', () => {
    document.body.innerHTML = question(
      `<div>${option('A')}</div>`,
      boxed(option('B', true), '<p>C</p>'),
    );
    markCorrectAnswers(document.body);
    expect(document.querySelector(TAGS)).toBeNull();
  });

  it('marks neither of two options alike', () => {
    document.body.innerHTML = question(
      `<div>${option('Same')}</div>`,
      `<div>${option('Same')}</div>`,
      boxed(option('Other', true), '<p>Same</p>'),
    );
    markCorrectAnswers(document.body);
    expect(document.querySelector(`[${CORRECT}]`)).toBeNull();
  });

  it('marks each question by its own note', () => {
    document.body.innerHTML =
      question(
        `<div>${option('A')}</div>`,
        boxed(option('B', true), '<p>A</p>'),
      ) +
      question(
        `<div>${option('B')}</div>`,
        boxed(option('A', true), '<p>B</p>'),
      );
    markCorrectAnswers(document.body);
    const [first, second] = document.querySelectorAll(
      '[data-automation="sdk-item-wrapper"]',
    );
    expect(first?.querySelector(`[${CORRECT}]`)?.textContent.trim()).toBe('A');
    expect(second?.querySelector(`[${CORRECT}]`)?.textContent.trim()).toBe('B');
  });
});

it('unmarkCorrectAnswers takes every tag off', () => {
  document.body.innerHTML = question(
    `<div>${option('A')}</div>`,
    boxed(option('B', true), '<p>A</p>'),
    boxed(checkbox('C', true), 'Selected Answer - Incorrect'),
  );
  markCorrectAnswers(document.body);
  unmarkCorrectAnswers(document.body);
  expect(document.querySelector(TAGS)).toBeNull();
});
