import type { Config } from "../types";

function isAbsoluteUrl(url: string): boolean {
  return /^[a-z][a-z\d+\-.]*:/i.test(url);
}

function serializeParamsWithStyle(
  params: Record<string, any>,
  style: 'repeat' | 'brackets' | 'indices' | 'comma' = 'repeat',
): string {
  const parts: string[] = [];

  for (const [key, val] of Object.entries(params)) {
    if (val === null || val === undefined) continue;

    if (Array.isArray(val)) {
      if (val.length === 0) continue;

      if (style === 'comma') {
        const joined = val.filter((v) => v !== null && v !== undefined).map(String).join(',');
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(joined)}`);
      } else {
        val.forEach((item, idx) => {
          if (item === null || item === undefined) return;
          let paramKey = key;
          if (style === 'brackets') paramKey = `${key}[]`;
          else if (style === 'indices') paramKey = `${key}[${idx}]`;
          parts.push(`${encodeURIComponent(paramKey)}=${encodeURIComponent(String(item))}`);
        });
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`);
    }
  }

  return parts.join('&');
}

function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function buildUrl(
  config: Pick<Config, "baseURL" | "url" | "params" | "paramsSerializer">,
): string {
  let url = "";

  if (config.url) {
    if (isAbsoluteUrl(config.url)) {
      url = config.url;
    } else {
      const baseURL = config.baseURL ? trimTrailingSlash(config.baseURL) : "";
      const path = config.url.startsWith("/") ? config.url : "/" + config.url;
      url = baseURL + path;
    }
  } else if (config.baseURL) {
    url = trimTrailingSlash(config.baseURL);
  }

  if (config.params && Object.keys(config.params).length > 0) {
    let queryString = "";
    if (typeof config.paramsSerializer === "function") {
      queryString = config.paramsSerializer(config.params);
    } else if (typeof config.paramsSerializer === "string") {
      queryString = serializeParamsWithStyle(config.params, config.paramsSerializer);
    } else {
      queryString = serializeParamsWithStyle(config.params, "repeat");
    }

    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  return url;
}
