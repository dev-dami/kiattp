import type { Config } from "../types";

function isAbsoluteUrl(url: string): boolean {
  return /^[a-z][a-z\d+\-.]*:/i.test(url);
}

export function buildUrl(
  config: Pick<Config, "baseURL" | "url" | "params">,
): string {
  let url = "";

  if (config.baseURL) {
    url = config.baseURL;
  }

  if (config.url) {
    if (isAbsoluteUrl(config.url)) {
      url = config.url;
    } else {
      const base = url.endsWith("/") ? url.slice(0, -1) : url;
      const path = config.url.startsWith("/") ? config.url : "/" + config.url;
      url = base + path;
    }
  }

  if (config.params && Object.keys(config.params).length > 0) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(config.params)) {
      if (value !== null && value !== undefined) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString().replace(/\+/g, "%20");
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  return url;
}
