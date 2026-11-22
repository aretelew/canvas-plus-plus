import { storage } from '#imports';

export const quizAnswers = storage.defineItem<boolean>('sync:quizAnswers', {
  fallback: false,
});
