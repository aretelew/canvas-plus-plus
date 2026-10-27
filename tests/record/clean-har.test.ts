import { describe, expect, it } from 'vitest';
import { cleanHar, FIXTURE_ORIGIN, type Har } from './clean-har';

const SCHOOL = 'https://canvas.school.edu';

const raw: Har = {
  log: {
    entries: [
      {
        startedDateTime: '2026-10-27T13:00:00.000Z',
        request: {
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
          ],
          cookies: [{ name: 'log_session_id', value: 'secret' }],
          content: {
            text: `<a href="${SCHOOL}/courses/1/modules">Modules</a>`,
          },
        },
      },
      {
        startedDateTime: '2026-10-27T13:00:00.100Z',
        request: { url: `${SCHOOL}/logo.png`, headers: [] },
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

  it('leaves binary bodies untouched', () => {
    expect(image?.response.content).toEqual(
      raw.log.entries[1]?.response.content,
    );
  });
});
