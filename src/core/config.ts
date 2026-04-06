import type { Config } from "../types";

const DEFAULT_VALIDATE_STATUS = (status: number) =>
  status >= 200 && status < 300;

const EMPTY_HEADERS: Record<string, string> = {};

const DEFAULT_CONFIG: Config = {
  method: "GET",
  headers: EMPTY_HEADERS,
  validateStatus: DEFAULT_VALIDATE_STATUS,
};

export function defaultConfig(): Config {
  return { ...DEFAULT_CONFIG };
}

export function normalizeConfig(
  callConfig: Partial<Config>,
  instanceDefaults?: Partial<Config>,
): Config {
  const instanceHeaders = instanceDefaults?.headers;
  const callHeaders = callConfig.headers;

  const mergedHeaders =
    instanceHeaders || callHeaders
      ? { ...instanceHeaders, ...callHeaders }
      : EMPTY_HEADERS;

  const merged: Config = {
    ...DEFAULT_CONFIG,
    ...instanceDefaults,
    ...callConfig,
    headers: mergedHeaders,
  };

  if (Object.keys(mergedHeaders).length > 0) {
    const normalizedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(mergedHeaders)) {
      normalizedHeaders[key.toLowerCase()] = value;
    }
    merged.headers = normalizedHeaders;
  }

  return merged;
}
