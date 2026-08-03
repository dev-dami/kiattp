import { describe, it, expect, afterEach } from 'vitest';
import { parseLinkHeader, attachLinks } from '../../src/core/links';
import { createInstance } from '../../src/instance';

describe('RFC 8288 Link header parsing', () => {
  it('returns empty frozen links object when header is undefined or empty', () => {
    const res1 = parseLinkHeader(undefined);
    const res2 = parseLinkHeader('');
    expect(res1).toEqual({});
    expect(res2).toEqual({});
  });

  it('parses single link with rel and resolves against base URL', () => {
    const header = '<https://api.example.com/items?page=2>; rel="next"';
    const links = parseLinkHeader(header, 'https://api.example.com/items?page=1');
    expect(links.next).toBeDefined();
    expect(links.next.url).toBe('https://api.example.com/items?page=2');
    expect(links.next.rel).toBe('next');
  });

  it('parses relative links and resolves against base URL', () => {
    const header = '</items?page=2>; rel="next", </items?page=1>; rel="prev"';
    const links = parseLinkHeader(header, 'https://api.example.com/items?page=1');
    expect(links.next.url).toBe('https://api.example.com/items?page=2');
    expect(links.prev.url).toBe('https://api.example.com/items?page=1');
  });

  it('parses multiple relations on a single link-value', () => {
    const header = '<https://api.example.com/first>; rel="first start"';
    const links = parseLinkHeader(header);
    expect(links.first.url).toBe('https://api.example.com/first');
    expect(links.start.url).toBe('https://api.example.com/first');
  });

  it('handles quotes, escaped characters and target attributes', () => {
    const header = '<https://api.example.com/page/3>; rel="next"; title="Chapter \\"Three\\""; type="application/json"';
    const links = parseLinkHeader(header);
    expect(links.next.url).toBe('https://api.example.com/page/3');
    expect(links.next.title).toBe('Chapter "Three"');
    expect(links.next.type).toBe('application/json');
  });

  it('first link-value for a relation wins per RFC 8288', () => {
    const header = '<https://api.example.com/first>; rel="next", <https://api.example.com/second>; rel="next"';
    const links = parseLinkHeader(header);
    expect(links.next.url).toBe('https://api.example.com/first');
  });
});

describe('Response follow() and paginate()', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('attachLinks adds deferred links getter and follow/next methods', async () => {
    const mockResponse: any = {
      headers: {
        link: '<https://api.example.com/page2>; rel="next"',
      },
      config: { url: 'https://api.example.com/page1' },
    };

    let followedUrl = '';
    attachLinks(mockResponse, 'https://api.example.com/page1', async (url) => {
      followedUrl = url;
      return { data: 'page2', status: 200 } as any;
    });

    expect(mockResponse.links.next.url).toBe('https://api.example.com/page2');
    const page2 = await mockResponse.next();
    expect(followedUrl).toBe('https://api.example.com/page2');
    expect(page2.data).toBe('page2');
  });

  it('instance.paginate yields pages sequentially using link relations', async () => {
    const pages: Record<string, any> = {
      'https://api.example.com/users?page=1': {
        data: [{ id: 1 }, { id: 2 }],
        headers: { link: '<https://api.example.com/users?page=2>; rel="next"' },
      },
      'https://api.example.com/users?page=2': {
        data: [{ id: 3 }, { id: 4 }],
        headers: { link: '<https://api.example.com/users?page=3>; rel="next"' },
      },
      'https://api.example.com/users?page=3': {
        data: [{ id: 5 }],
        headers: {},
      },
    };

    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = String(url);
      const pageData = pages[urlStr];
      return new Response(JSON.stringify(pageData.data), {
        status: 200,
        headers: pageData.headers,
      });
    }) as typeof fetch;

    const instance = createInstance();
    const collected: any[] = [];

    for await (const page of instance.paginate<any[]>('https://api.example.com/users?page=1')) {
      collected.push(...page.data);
    }

    expect(collected).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
  });
});
