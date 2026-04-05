import type { ResponseType } from "../types";

const NO_BODY_METHODS = new Set(["GET", "HEAD"]);

export function serializeBody(
  body: unknown,
  headers: Record<string, string>,
  method?: string,
): BodyInit | undefined {
  if (method && NO_BODY_METHODS.has(method.toUpperCase())) {
    return undefined;
  }

  if (body === undefined || body === null) {
    return undefined;
  }

  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return body;
  }

  if (body instanceof URLSearchParams) {
    return body;
  }

  if (typeof body === "string") {
    return body;
  }

  // def: serialize as JSON
  if (!headers["content-type"]) {
    headers["content-type"] = "application/json";
  }
  try {
    return JSON.stringify(body);
  } catch (err) {
    throw new TypeError(
      `Failed to serialize body as JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function parseResponse(
  bodyText: string,
  _headers: Record<string, string>,
  responseType?: ResponseType,
): Promise<unknown> {
  if (!bodyText) {
    return null;
  }

  if (responseType === "text") {
    return bodyText;
  }

  // def: try JSON, fall back text
  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
}
