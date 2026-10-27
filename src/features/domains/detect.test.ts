// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { looksLikeCanvas } from './detect';

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('looksLikeCanvas', () => {
  it('finds the app shell', () => {
    document.body.innerHTML = '<div id="application" class="ic-app"></div>';
    expect(looksLikeCanvas()).toBe(true);
  });

  it('finds the brand stylesheet on the login page', () => {
    document.head.innerHTML =
      '<link rel="stylesheet" href="https://du11hjcvx0uqb.cloudfront.net/dist/brandable_css/123/variables.css">';
    expect(looksLikeCanvas()).toBe(true);
  });

  it('ignores other sites', () => {
    document.body.innerHTML = '<div id="application"></div>';
    expect(looksLikeCanvas()).toBe(false);
  });
});
