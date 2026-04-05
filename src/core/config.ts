import type { Config } from "../types";

export function defaultConfig(): Config {
  return {
    method: "GET",
    headers: {},
    validateStatus: (status: number) => status >= 200 && status < 300,
  };
}

export function normalizeConfig(
  callConfig: Partial<Config>,
  instanceDefaults?: Partial<Config>,
): Config {
  // Deep merge headers to preserve instance defaults
  const mergedHeaders: Record<string, string> = {
    ...(instanceDefaults?.headers || {}),
    ...(callConfig.headers || {}),
  };

  const merged: Config = {
    ...defaultConfig(),
    ...instanceDefaults,
    ...callConfig,
    headers: mergedHeaders,
  };
  const config: Config = { ...merged };

  // Normalize header keys to lowercase
  const normalizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(config.headers || {})) {
    normalizedHeaders[key.toLowerCase()] = value;
  }
  config.headers = normalizedHeaders;

  return config;
}
