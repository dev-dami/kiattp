import { describe, it, expect, vi } from "vitest";
import { serializeBody, parseResponse } from "../../src/core/serialize";

describe("serializeBody with binary types", () => {
  it("handles FormData without setting Content-Type", () => {
    const headers: Record<string, string> = {};
    const formData = new FormData();
    formData.append("file", new Blob(["test"]), "test.txt");

    const result = serializeBody(formData, headers, "POST");

    expect(result).toBe(formData);
    expect(headers["content-type"]).toBeUndefined();
  });

  it("handles URLSearchParams and sets content-type", () => {
    const headers: Record<string, string> = {};
    const params = new URLSearchParams("foo=bar&baz=qux");

    const result = serializeBody(params, headers, "POST");

    expect(result).toBe(params);
    expect(headers["content-type"]).toBe("application/x-www-form-urlencoded");
  });

  it("handles Blob", () => {
    const headers: Record<string, string> = {};
    const blob = new Blob(["test content"], { type: "text/plain" });

    const result = serializeBody(blob, headers, "POST");

    expect(result).toBe(blob);
  });

  it("handles ArrayBuffer", () => {
    const headers: Record<string, string> = {};
    const buffer = new ArrayBuffer(8);

    const result = serializeBody(buffer, headers, "POST");

    expect(result).toBe(buffer);
  });

  it("handles ArrayBufferView (Uint8Array)", () => {
    const headers: Record<string, string> = {};
    const view = new Uint8Array([1, 2, 3, 4]);

    const result = serializeBody(view, headers, "POST");

    expect(result).toBe(view);
  });

  it("returns undefined for GET requests", () => {
    const headers: Record<string, string> = {};
    const result = serializeBody({ foo: "bar" }, headers, "GET");
    expect(result).toBeUndefined();
  });

  it("returns undefined for HEAD requests", () => {
    const headers: Record<string, string> = {};
    const result = serializeBody({ foo: "bar" }, headers, "HEAD");
    expect(result).toBeUndefined();
  });

  it("returns undefined for null body", () => {
    const headers: Record<string, string> = {};
    const result = serializeBody(null, headers, "POST");
    expect(result).toBeUndefined();
  });

  it("returns undefined for undefined body", () => {
    const headers: Record<string, string> = {};
    const result = serializeBody(undefined, headers, "POST");
    expect(result).toBeUndefined();
  });

  it("serializes objects as JSON and sets content-type", () => {
    const headers: Record<string, string> = {};
    const body = { name: "test", value: 42 };

    const result = serializeBody(body, headers, "POST");

    expect(result).toBe('{"name":"test","value":42}');
    expect(headers["content-type"]).toBe("application/json");
  });

  it("preserves existing content-type header", () => {
    const headers: Record<string, string> = { "content-type": "application/custom-json" };
    const body = { name: "test" };

    serializeBody(body, headers, "POST");

    expect(headers["content-type"]).toBe("application/custom-json");
  });
});

describe("parseResponse with binary types", () => {
  it("returns null for empty body", async () => {
    const result = await parseResponse(null, {}, "json");
    expect(result).toBeNull();
  });

  it("returns text as-is for text responseType", async () => {
    const result = await parseResponse("hello world", {}, "text");
    expect(result).toBe("hello world");
  });

  it("parses JSON for json responseType", async () => {
    const result = await parseResponse('{"key":"value"}', {}, "json");
    expect(result).toEqual({ key: "value" });
  });

  it("falls back to text for invalid JSON", async () => {
    const result = await parseResponse("not json", {}, "json");
    expect(result).toBe("not json");
  });

  it("returns null for empty string with json type", async () => {
    const result = await parseResponse("", {}, "json");
    expect(result).toBeNull();
  });

  it("returns arraybuffer for arraybuffer responseType (string source)", async () => {
    const result = await parseResponse("test", {}, "arraybuffer");
    expect(result).toBeInstanceOf(ArrayBuffer);
  });
});
