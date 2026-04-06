import type { Config } from "../types";

function isAbsoluteUrl(url: string): boolean {
  return /^[a-z][a-z\d+\-.]*:/i.test(url);
}

function defaultSerializeParams(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      searchParams.append(key, String(value));
    }
  }
  return searchParams.toString().replace(/\+/g, "%20");
}

function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function buildUrl(
  config: Pick<Config, "baseURL" | "url" | "params" | "paramsSerializer">,
): string {
  let url = "";

  if (config.baseURL) {
    url = trimTrailingSlash(config.baseURL);
  }

  if (config.url) {
    if (isAbsoluteUrl(config.url)) {
      url = config.url;
    } else {
      const baseURL = config.baseURL ? trimTrailingSlash(config.baseURL) : "";
      const path = config.url.startsWith("/") ? config.url : "/" + config.url;
      url = baseURL + path;
    }
  }

  if (config.params && Object.keys(config.params).length > 0) {
    const queryString = config.paramsSerializer
      ? config.paramsSerializer(config.params)
      : defaultSerializeParams(config.params);
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  return url;
}
