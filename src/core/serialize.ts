import type { BodyType, ResponseType } from "../types";

const NO_BODY_METHODS = new Set(["GET", "HEAD"]);

export function serializeBody(
  body: BodyType,
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
    // Don't set Content-Type for FormData; the browser sets the boundary
    return body;
  }

  if (body instanceof URLSearchParams) {
    if (!headers["content-type"]) {
      headers["content-type"] = "application/x-www-form-urlencoded";
    }
    return body;
  }

  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return body;
  }

  if (body instanceof ArrayBuffer) {
    return body;
  }

  if (ArrayBuffer.isView(body)) {
    return body as BodyInit;
  }

  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
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

type FetchResponse = globalThis.Response;

export async function parseResponse(
  bodySource: FetchResponse | string | ReadableStream | null,
  _headers: Record<string, string>,
  responseType?: ResponseType,
): Promise<unknown> {
  if (!bodySource) {
    return null;
  }

  // Handle fetch Response objects
  if (bodySource instanceof globalThis.Response) {
    const resp = bodySource as FetchResponse;
    switch (responseType) {
      case "blob":
        return resp.blob();
      case "arraybuffer":
        return resp.arrayBuffer();
      case "stream":
        return resp.body;
      case "text":
        return resp.text();
      case "json":
      default: {
        const text = await resp.text();
        if (!text) return null;
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }
    }
  }

  // Handle string body (from Node.js http adapter or fallback)
  if (typeof bodySource === "string") {
    if (!bodySource) return null;
    if (responseType === "text") {
      return bodySource;
    }
    if (responseType === "arraybuffer") {
      return new TextEncoder().encode(bodySource).buffer;
    }

    // def: try JSON, fall back text
    try {
      return JSON.parse(bodySource);
    } catch {
      return bodySource;
    }
  }

  return bodySource;
}
