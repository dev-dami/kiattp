import type { Config } from "../types";

function isAbsoluteUrl(url: string): boolean {
  return /^[a-z][a-z\d+\-.]*:/i.test(url);
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : url + "/";
}

function stripLeadingSlash(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}

export function buildUrl(
  config: Pick<Config, "baseURL" | "url" | "params">,
): string {
  let url = "";

  if (config.baseURL) {
    // Strip trailing slash from baseURL to avoid double slashes
    url = config.baseURL.endsWith("/")
      ? config.baseURL.slice(0, -1)
      : config.baseURL;
  }

  if (config.url) {
    if (isAbsoluteUrl(config.url)) {
      // Absolute URLs override baseURL completely
      url = config.url;
    } else {
      // Relative path: combine baseURL and url
      const baseURL = config.baseURL
        ? config.baseURL.endsWith("/")
          ? config.baseURL.slice(0, -1)
          : config.baseURL
        : "";
      const path = config.url.startsWith("/") ? config.url : "/" + config.url;
      url = baseURL + path;
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
