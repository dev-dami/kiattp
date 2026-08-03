import type { CookieJar } from '../types';

export interface Cookie {
  key: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: Date;
}

export class MemoryCookieJar implements CookieJar {
  private cookies: Cookie[] = [];

  public setCookie(cookieStr: string, requestUrl: string): void {
    if (!cookieStr) return;
    const parts = cookieStr.split(';').map((p) => p.trim());
    const kv = parts[0];
    if (!kv) return;

    const eqIdx = kv.indexOf('=');
    if (eqIdx === -1) return;

    const key = kv.slice(0, eqIdx).trim();
    const value = kv.slice(eqIdx + 1).trim();

    let domain: string | undefined;
    let path = '/';
    let expires: Date | undefined;

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      const partEq = part.indexOf('=');
      const pKey = (partEq === -1 ? part : part.slice(0, partEq)).toLowerCase().trim();
      const pVal = partEq === -1 ? '' : part.slice(partEq + 1).trim();

      if (pKey === 'domain') domain = pVal.replace(/^\./, '').toLowerCase();
      else if (pKey === 'path') path = pVal;
      else if (pKey === 'expires') {
        const d = new Date(pVal);
        if (!isNaN(d.getTime())) expires = d;
      }
    }

    if (!domain && requestUrl) {
      try {
        domain = new URL(requestUrl).hostname.toLowerCase();
      } catch {
        // ignore
      }
    }

    // Remove existing cookie with same key & domain & path
    this.cookies = this.cookies.filter(
      (c) => !(c.key === key && c.domain === domain && c.path === path),
    );

    this.cookies.push({ key, value, domain, path, expires });
  }

  public getCookieString(requestUrl: string): string {
    let hostname = '';
    let pathname = '/';
    try {
      const u = new URL(requestUrl);
      hostname = u.hostname.toLowerCase();
      pathname = u.pathname;
    } catch {
      // ignore
    }

    const now = new Date();
    const active: string[] = [];

    for (const c of this.cookies) {
      if (c.expires && c.expires < now) continue;

      if (c.domain && hostname) {
        if (hostname !== c.domain && !hostname.endsWith('.' + c.domain)) continue;
      }

      if (c.path && !pathname.startsWith(c.path)) continue;

      active.push(`${c.key}=${c.value}`);
    }

    return active.join('; ');
  }
}
