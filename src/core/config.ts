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
  const merged: Config = {
    ...defaultConfig(),
    ...instanceDefaults,
    ...callConfig,
  };
  const config: Config = { ...merged };
  const headers: Record<string, string> = { ...merged.headers };
  const normalizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }
  config.headers = normalizedHeaders;

  return config;
}
