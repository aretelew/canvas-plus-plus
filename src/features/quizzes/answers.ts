import { textOf } from '@/core/text';

// On a New Quizzes result, a multiple choice question answered wrong shows the
// answer picked in a red box with a note under it repeating the correct
// answer's text ("Correct Answer: …"), and leaves the correct answer itself
// unmarked among the others. This finds the option that note names and tags
// it, for answers.css to mark the way Canvas marks a correct answer picked.
//
// The notes under a pick then say nothing new, so they're tagged to hide: that
// one, and the unlabelled verdict a wrong pick can get instead ("Selected
// Answer - Incorrect"), which its red box already says. A missed option's
// note ("Missed Option - Incorrect") stays: its box is red like a wrong
// pick's, and the note is what tells the two apart.
//
// Canvas's class names are generated, so the parts are found by what's stable:
// its automation hooks, its input components, and the note as the second part
// of a marked answer's box (the first is the box itself).

export const CORRECT = 'data-cpp-correct-answer';
export const REDUNDANT = 'data-cpp-redundant-note';

const QUESTION = '[data-automation="sdk-item-wrapper"]';
const OPTION = '[data-cid="RadioInput"]';
const NOTE = '.fs-mask > :nth-child(2)';

/** Tags the correct answer of each question in `root` answered wrong, and
 * the notes under its picks. Tagging again changes nothing. */
export function markCorrectAnswers(root: ParentNode): void {
  for (const question of root.querySelectorAll(QUESTION)) {
    for (const note of question.querySelectorAll(NOTE)) {
      const box = note.previousElementSibling;
      if (!box?.querySelector('input:checked')) continue;
      // a verdict has no label; the correct answer's note has "Correct Answer:"
      if (!textOf(note.firstElementChild)) {
        note.setAttribute(REDUNDANT, '');
        continue;
      }
      const row = optionNamed(
        question,
        textOf(note.querySelector('.user_content')),
      );
      if (!row) continue;
      row.setAttribute(CORRECT, '');
      note.setAttribute(REDUNDANT, '');
    }
  }
}

// The row of the one option in `question` whose text is `text`. None for no
// text, or for two options alike, which can't be told apart.
function optionNamed(question: Element, text: string): Element | null {
  if (!text) return null;
  const named = [...question.querySelectorAll(OPTION)].filter(
    (option) => textOf(option.querySelector('label .user_content')) === text,
  );
  return named.length === 1 ? (named[0]?.parentElement ?? null) : null;
}

/** Takes the tags back off. */
export function unmarkCorrectAnswers(root: ParentNode): void {
  for (const tagged of root.querySelectorAll(`[${CORRECT}], [${REDUNDANT}]`)) {
    tagged.removeAttribute(CORRECT);
    tagged.removeAttribute(REDUNDANT);
  }
}
