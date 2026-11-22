import { whenParsed } from '@/core/when-parsed';
import { markCorrectAnswers, unmarkCorrectAnswers } from './answers';
import { quizAnswers } from './storage';

// New Quizzes draws its results with React after the page loads: in a frame
// of the submission page, on a page of their own, or on a quiz-lti host. So
// every page is watched, which costs one lookup per change on pages with none.
export async function syncQuizAnswers(): Promise<void> {
  let observer: MutationObserver | undefined;
  let enabled = false;

  const start = () => {
    if (!enabled || observer) return;
    const { body } = document;
    // tags are attributes, which this doesn't watch, so tagging can't loop
    observer = new MutationObserver(() => {
      markCorrectAnswers(body);
    });
    observer.observe(body, { childList: true, subtree: true });
    markCorrectAnswers(body);
  };

  const apply = (on: boolean) => {
    enabled = on;
    observer?.disconnect();
    observer = undefined;
    unmarkCorrectAnswers(document);
    if (on) whenParsed(start);
  };

  apply(await quizAnswers.getValue());
  quizAnswers.watch(apply);
}
