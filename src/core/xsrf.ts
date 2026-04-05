/**
 * XSRF/CSRF protection.
 * Reads a cookie and attaches its value as a request header.
 * No-op in non-browser environments.
 */

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(
    new RegExp('(^| )' + name + '=([^;]+)'),
  );
  return match?.[2];
}

export function applyXsrfHeaders(
  headers: Record<string, string>,
  xsrfCookieName?: string,
  xsrfHeaderName?: string,
): void {
  if (!xsrfCookieName || !xsrfHeaderName) return;
  if (typeof document === 'undefined') return;
  const value = getCookie(xsrfCookieName);
  if (value) {
    headers[xsrfHeaderName.toLowerCase()] = value;
  }
}
