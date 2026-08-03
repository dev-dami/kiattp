import type { Config } from "../types";

const DEFAULT_VALIDATE_STATUS = (status: number) =>
  status >= 200 && status < 300;

const DEFAULT_CONFIG: Config = {
  method: "GET",
  validateStatus: DEFAULT_VALIDATE_STATUS,
};

export function defaultConfig(): Config {
  return { ...DEFAULT_CONFIG, headers: {} };
}

/**
 * True when every key is already lowercase, letting us skip building a second
 * object. Header names are short and usually already normalized, so this scan
 * is cheaper than the allocation it avoids.
 */
function isAlreadyLowercase(headers: Record<string, string>): boolean {
  for (const key in headers) {
    for (let i = 0; i < key.length; i++) {
      const c = key.charCodeAt(i);
      if (c >= 65 && c <= 90) return false;
    }
  }
  return true;
}

function lowercaseKeys(src: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key in src) out[key.toLowerCase()] = src[key];
  return out;
}

export function normalizeConfig(
  callConfig: Partial<Config>,
  instanceDefaults?: Partial<Config>,
): Config {
  const instanceHeaders = instanceDefaults?.headers;
  const callHeaders = callConfig.headers;

  // Always a fresh object. `headers` is mutated downstream by serializeBody,
  // applyXsrfHeaders and request interceptors, so a shared module-level or
  // caller-owned object would leak mutations across unrelated requests.
  let headers: Record<string, string>;
  if (instanceHeaders && callHeaders) {
    headers = { ...instanceHeaders, ...callHeaders };
    if (!isAlreadyLowercase(headers)) headers = lowercaseKeys(headers);
  } else {
    const src = instanceHeaders || callHeaders;
    if (!src) {
      headers = {};
    } else {
      headers = isAlreadyLowercase(src) ? { ...src } : lowercaseKeys(src);
    }
  }

  const merged: Config = {
    ...DEFAULT_CONFIG,
    ...instanceDefaults,
    ...callConfig,
    headers,
  };

  // An explicit `undefined` for these survives the spread and would otherwise
  // crash the pipeline, so restore the defaults rather than trusting the merge.
  if (typeof merged.validateStatus !== "function") {
    merged.validateStatus = DEFAULT_VALIDATE_STATUS;
  }
  merged.method = merged.method
    ? (merged.method.toUpperCase() as Config["method"])
    : "GET";

  return merged;
}
