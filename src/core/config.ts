import type { Config } from "../types";

const DEFAULT_VALIDATE_STATUS = (status: number) =>
  status >= 200 && status < 300;

const EMPTY_HEADERS: Record<string, string> = {};

export function defaultConfig(): Config {
  return {
    method: "GET",
    headers: EMPTY_HEADERS,
    validateStatus: DEFAULT_VALIDATE_STATUS,
  };
}

export function normalizeConfig(
  callConfig: Partial<Config>,
  instanceDefaults?: Partial<Config>,
): Config {
  const instanceHeaders = instanceDefaults?.headers;
  const callHeaders = callConfig.headers;

  // Only allocate mergedHeaders when there's something to merge
  const mergedHeaders =
    instanceHeaders || callHeaders
      ? { ...instanceHeaders, ...callHeaders }
      : EMPTY_HEADERS;

  const merged: Config = {
    ...defaultConfig(),
    ...instanceDefaults,
    ...callConfig,
    headers: mergedHeaders,
  };

  // Only normalize when there are headers
  if (Object.keys(mergedHeaders).length > 0) {
    const normalizedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(mergedHeaders)) {
      normalizedHeaders[key.toLowerCase()] = value;
    }
    merged.headers = normalizedHeaders;
  }

  return merged;
}
