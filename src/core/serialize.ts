import type { BodyType, ResponseType } from "../types";

const NO_BODY_METHODS = new Set(["GET", "HEAD"]);

export function serializeBody(
  body: BodyType,
  headers: Record<string, string>,
  method?: string,
): BodyInit | undefined {
  const m = method?.toUpperCase();
  if (m === "GET" || m === "HEAD") return undefined;
  if (body === undefined || body === null) return undefined;

  if (typeof FormData !== "undefined" && body instanceof FormData) return body;
  if (body instanceof URLSearchParams) {
    if (!headers["content-type"]) headers["content-type"] = "application/x-www-form-urlencoded";
    return body;
  }
  if (typeof Blob !== "undefined" && body instanceof Blob) return body;
  if (body instanceof ArrayBuffer) return body;
  if (ArrayBuffer.isView(body)) return body as BodyInit;
  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) return body;
  if (typeof body === "string") return body;

  if (!headers["content-type"]) headers["content-type"] = "application/json";
  try { return JSON.stringify(body); } catch (err) {
    throw new TypeError(`JSON serialize failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

type FetchResponse = globalThis.Response;

export async function parseResponse(
  bodySource: FetchResponse | string | ReadableStream | null,
  headers: Record<string, string>,
  responseType?: ResponseType,
): Promise<unknown> {
  if (!bodySource) return null;

  if (bodySource instanceof globalThis.Response) {
    const r = bodySource as FetchResponse;
    if (responseType === "blob") return r.blob();
    if (responseType === "arraybuffer") return r.arrayBuffer();
    if (responseType === "stream") return r.body;
    if (responseType === "text") return r.text();
    // responseType === "json" or undefined: parse as JSON
    const text = await r.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  }

  if (typeof bodySource === "string") {
    if (responseType === "text") return bodySource;
    if (responseType === "arraybuffer") return new TextEncoder().encode(bodySource).buffer;
    if (responseType === "json" || !headers["content-type"]) {
      try { return JSON.parse(bodySource); } catch { return bodySource; }
    }
    return bodySource;
  }

  return bodySource;
}
