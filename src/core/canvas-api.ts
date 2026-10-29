// Requests to Canvas's REST API from a content script, made the way Canvas's
// own scripts make them, with the user's session.

// Firefox's global object in content scripts; its fetch runs as the page
declare const content: { fetch: typeof fetch };

interface Request {
  method?: 'GET' | 'POST' | 'PUT';
  // sent as the JSON body
  json?: unknown;
}

/** `path` is on this Canvas site (or a full URL Canvas gave, like a next page). */
export function canvasFetch(
  path: string,
  { method = 'GET', json }: Request = {},
): Promise<Response> {
  const url = new URL(path, location.origin);
  const init: RequestInit = {
    method,
    headers: {
      // ids as strings (some are past what a JS number holds exactly), and
      // application/json, without which Canvas puts `while(1);` in front
      Accept: 'application/json+canvas-string-ids, application/json',
      // Canvas checks writes made with the session cookie against this
      // cookie's value, sent back as a header
      ...(method !== 'GET' && { 'X-CSRF-Token': csrfToken() }),
      ...(json !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: json === undefined ? undefined : JSON.stringify(json),
  };
  // Firefox runs a content script's own requests as the extension, without
  // the user's Canvas session
  return import.meta.env.FIREFOX ? content.fetch(url, init) : fetch(url, init);
}

/** The response's JSON, or undefined when the request fails. */
export async function canvasJson<T>(
  path: string,
  request?: Request,
): Promise<T | undefined> {
  try {
    const response = await canvasFetch(path, request);
    return response.ok ? ((await response.json()) as T) : undefined;
  } catch {
    return undefined;
  }
}

function csrfToken(): string {
  const token = /(?:^|;\s*)_csrf_token=([^;]*)/.exec(document.cookie)?.[1];
  return token ? decodeURIComponent(token) : '';
}
