import { describe, expect, it } from 'vitest';
import { cleanHar, FIXTURE_ORIGIN, type Har } from './clean-har';

const SCHOOL = 'https://canvas.school.edu';

const raw: Har = {
  log: {
    entries: [
      {
        startedDateTime: '2026-10-27T13:00:00.000Z',
        request: {
          method: 'GET',
          url: `${SCHOOL}/courses/1`,
          headers: [
            { name: 'Cookie', value: '_normandy_session=secret' },
            { name: 'X-CSRF-Token', value: 'secret' },
            { name: 'Referer', value: `${SCHOOL}/` },
          ],
          cookies: [{ name: '_normandy_session', value: 'secret' }],
        },
        response: {
          headers: [
            { name: 'Set-Cookie', value: 'log_session_id=secret' },
            { name: 'Content-Type', value: 'text/html' },
            {
              name: 'Content-Security-Policy',
              value: "frame-ancestors 'self' canvas.school.edu",
            },
          ],
          cookies: [{ name: 'log_session_id', value: 'secret' }],
          content: {
            text: `<a href="${SCHOOL}/courses/1/modules">Modules</a>`,
          },
        },
      },
      {
        startedDateTime: '2026-10-27T13:00:00.100Z',
        request: { method: 'GET', url: `${SCHOOL}/logo.png`, headers: [] },
        response: {
          headers: [],
          content: { text: 'aHR0cHM6Ly9jYW52YXM=', encoding: 'base64' },
        },
      },
    ],
  },
};

describe('cleanHar', () => {
  const [page, image] = cleanHar(raw, SCHOOL).log.entries;

  it('drops every login secret', () => {
    expect(JSON.stringify(cleanHar(raw, SCHOOL))).not.toContain('secret');
  });

  it('moves the school origin to one the content script matches', () => {
    expect(page?.request.url).toBe(`${FIXTURE_ORIGIN}/courses/1`);
    expect(page?.request.headers).toContainEqual({
      name: 'Referer',
      value: `${FIXTURE_ORIGIN}/`,
    });
    expect(page?.response.content.text).toBe(
      `<a href="${FIXTURE_ORIGIN}/courses/1/modules">Modules</a>`,
    );
  });

  it('rewrites POST bodies, which replay matches on', () => {
    const launch = cleanHar(
      {
        log: {
          entries: [
            {
              startedDateTime: '2026-10-27T13:00:00.000Z',
              request: {
                method: 'POST',
                url: 'https://school.quiz-lti-iad-prod.instructure.com/lti/launch',
                headers: [],
                postData: {
                  text: `return_url=${encodeURIComponent(SCHOOL)}&origin=${SCHOOL}`,
                },
              },
              response: { headers: [], content: {} },
            },
          ],
        },
      },
      SCHOOL,
    ).log.entries[0];
    expect(launch?.request.postData?.text).toBe(
      `return_url=${encodeURIComponent(FIXTURE_ORIGIN)}&origin=${FIXTURE_ORIGIN}`,
    );
  });

  it('rewrites bare hosts, like CSP frame-ancestors', () => {
    expect(page?.response.headers).toContainEqual({
      name: 'Content-Security-Policy',
      value: "frame-ancestors 'self' fixture.instructure.com",
    });
  });

  it('keeps the copy of a repeated request that has its body', () => {
    const entry = (url: string, text?: string) => ({
      startedDateTime: '2026-10-27T13:00:00.000Z',
      request: { method: 'GET', url, headers: [] },
      response: { headers: [], content: text ? { text } : {} },
    });
    const pdf = `${SCHOOL}/file.pdf`;
    const redirect = `${SCHOOL}/files/1/preview`;
    const cleaned = cleanHar(
      {
        log: {
          entries: [
            entry(redirect), // a redirect has no body either: kept
            entry(pdf), // cut short
            entry(pdf, 'JVBERi0x'),
          ],
        },
      },
      SCHOOL,
    ).log.entries.map((e) => [e.request.url, e.response.content.text]);
    expect(cleaned).toEqual([
      [`${FIXTURE_ORIGIN}/files/1/preview`, undefined],
      [`${FIXTURE_ORIGIN}/file.pdf`, 'JVBERi0x'],
    ]);
  });

  it('leaves binary bodies untouched', () => {
    expect(image?.response.content).toEqual(
      raw.log.entries[1]?.response.content,
    );
  });
});
