import type { Link, Links, Response } from '../types';

/**
 * Shared empty result for the common case of a response with no Link header.
 * Frozen so an accidental write throws instead of leaking across requests.
 */
const NO_LINKS: Links = Object.freeze({});

function resolveUrl(ref: string, base?: string): string {
  if (!base) return ref;
  try {
    return new URL(ref, base).toString();
  } catch {
    return ref;
  }
}

/**
 * Parse an RFC 8288 `Link` header into a map keyed by relation type.
 *
 * Uses a single-pass scanner rather than splitting on commas: both the URI
 * reference and quoted parameter values are allowed to contain `,` and `;`,
 * so a split-based parser corrupts them.
 *
 *   Link: <https://api.example.com/repos?page=2>; rel="next"
 *
 * Multiple relations on one link-value (`rel="next last"`) register the link
 * under each. Per RFC 8288 the first occurrence of a parameter wins, as does
 * the first link-value for a given relation.
 */
export function parseLinkHeader(header: string | undefined, base?: string): Links {
  if (!header) return NO_LINKS;

  const links: Record<string, Link> = {};
  const len = header.length;
  let i = 0;
  let found = false;

  while (i < len) {
    // Advance to the start of the next link-value.
    while (i < len && header[i] !== '<') i++;
    if (i >= len) break;
    i++;

    const uriStart = i;
    while (i < len && header[i] !== '>') i++;
    if (i >= len) break; // unterminated URI reference — discard
    const uriRef = header.slice(uriStart, i).trim();
    i++;

    // Parameters, up to an unquoted ',' which begins the next link-value.
    const params: Record<string, string> = {};
    while (i < len) {
      while (i < len && (header[i] === ' ' || header[i] === '\t')) i++;
      if (i >= len) break;
      if (header[i] === ',') {
        i++;
        break;
      }
      if (header[i] !== ';') {
        i++; // unexpected byte — resync
        continue;
      }
      i++;
      while (i < len && (header[i] === ' ' || header[i] === '\t')) i++;

      const nameStart = i;
      while (i < len && header[i] !== '=' && header[i] !== ';' && header[i] !== ',') i++;
      const name = header.slice(nameStart, i).trim().toLowerCase();

      let value = '';
      if (i < len && header[i] === '=') {
        i++;
        while (i < len && (header[i] === ' ' || header[i] === '\t')) i++;

        if (i < len && header[i] === '"') {
          i++;
          let buf = '';
          while (i < len) {
            const ch = header[i];
            if (ch === '\\' && i + 1 < len) {
              buf += header[i + 1];
              i += 2;
              continue;
            }
            if (ch === '"') {
              i++;
              break;
            }
            buf += ch;
            i++;
          }
          value = buf;
        } else {
          const valueStart = i;
          while (i < len && header[i] !== ';' && header[i] !== ',') i++;
          value = header.slice(valueStart, i).trim();
        }
      }

      if (name && params[name] === undefined) params[name] = value;
    }

    const rel = params.rel;
    if (!rel) continue; // a link-value without `rel` is not addressable

    const url = resolveUrl(uriRef, base);

    for (const token of rel.split(/\s+/)) {
      if (!token) continue;
      const key = token.toLowerCase();
      if (links[key]) continue; // first link-value for a relation wins
      links[key] = { ...params, rel: key, url };
      found = true;
    }
  }

  return found ? links : NO_LINKS;
}

/**
 * A minimal request function, used to follow a link from a response back
 * through the same pipeline (and therefore the same interceptors) that
 * produced it.
 */
export type Follower = <T>(url: string, config: Record<string, unknown>) => Promise<Response<T>>;

/**
 * Attach `links`, `follow()` and `next()` to a response.
 *
 * Parsing is deferred behind a getter: the vast majority of responses carry no
 * Link header, and those that do are usually only inspected via `next()`.
 */
export function attachLinks<T>(response: Response<T>, base: string | undefined, follow: Follower): void {
  const header = response.headers.link;

  if (header) {
    let cached: Links | undefined;
    Object.defineProperty(response, 'links', {
      configurable: true,
      enumerable: true,
      get() {
        return (cached ??= parseLinkHeader(header, base));
      },
    });
  } else {
    response.links = NO_LINKS;
  }

  Object.defineProperty(response, 'follow', {
    configurable: true,
    enumerable: false,
    value: function followRel(rel: string) {
      const target = response.links[rel.toLowerCase()];
      if (!target) return Promise.resolve(null);

      // The link URL already carries its own query string, so `params` and
      // `baseURL` from the originating config must not be re-applied.
      const { params: _params, baseURL: _baseURL, url: _url, ...rest } = response.config as Record<string, unknown>;
      return follow(target.url, rest);
    },
  });

  Object.defineProperty(response, 'next', {
    configurable: true,
    enumerable: false,
    value: function nextPage() {
      return (response as Response<T> & { follow: (rel: string) => Promise<Response<T> | null> }).follow('next');
    },
  });
}
