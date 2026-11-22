import { storage } from '#imports';

// On from the start: it only marks what Canvas already knows, on a quiz's
// results.
export const quizAnswers = storage.defineItem<boolean>('sync:quizAnswers', {
  fallback: true,
});
