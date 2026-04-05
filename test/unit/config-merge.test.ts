import { describe, it, expect, vi } from "vitest";
import { normalizeConfig } from "../../src/core/config";

describe("normalizeConfig with behavior merging", () => {
  it("deep merges headers from instance defaults and call config", () => {
    const instanceDefaults = {
      headers: { "x-api-key": "secret", "x-version": "1.0" },
    };
    const callConfig = {
      headers: { "x-request-id": "abc123" },
    };

    const result = normalizeConfig(callConfig, instanceDefaults);

    expect(result.headers["x-api-key"]).toBe("secret");
    expect(result.headers["x-version"]).toBe("1.0");
    expect(result.headers["x-request-id"]).toBe("abc123");
  });

  it("call config headers override instance headers with same key", () => {
    const instanceDefaults = {
      headers: { "content-type": "application/xml" },
    };
    const callConfig = {
      headers: { "content-type": "application/json" },
    };

    const result = normalizeConfig(callConfig, instanceDefaults);

    expect(result.headers["content-type"]).toBe("application/json");
  });

  it("normalizes header keys to lowercase", () => {
    const callConfig = {
      headers: { "X-API-Key": "secret", "Content-Type": "application/json" },
    };

    const result = normalizeConfig(callConfig);

    expect(result.headers["x-api-key"]).toBe("secret");
    expect(result.headers["content-type"]).toBe("application/json");
  });

  it("handles undefined instance defaults", () => {
    const callConfig = {
      url: "/test",
      method: "POST" as const,
      headers: { "x-custom": "value" },
    };

    const result = normalizeConfig(callConfig);

    expect(result.url).toBe("/test");
    expect(result.method).toBe("POST");
    expect(result.headers["x-custom"]).toBe("value");
  });

  it("handles empty call config", () => {
    const instanceDefaults = {
      baseURL: "https://api.example.com",
      headers: { "x-api-key": "secret" },
    };

    const result = normalizeConfig({}, instanceDefaults);

    expect(result.baseURL).toBe("https://api.example.com");
    expect(result.headers["x-api-key"]).toBe("secret");
  });

  it("preserves progress callbacks in merged config", () => {
    const onUploadProgress = vi.fn();
    const onDownloadProgress = vi.fn();

    const callConfig = {
      onUploadProgress,
      onDownloadProgress,
    };

    const result = normalizeConfig(callConfig);

    expect(result.onUploadProgress).toBe(onUploadProgress);
    expect(result.onDownloadProgress).toBe(onDownloadProgress);
  });

  it("handles body with FormData type", () => {
    const formData = new FormData();
    formData.append("file", new Blob(["test"]), "test.txt");

    const result = normalizeConfig({ body: formData, method: "POST" });

    expect(result.body).toBe(formData);
  });

  it("handles body with ArrayBuffer type", () => {
    const buffer = new ArrayBuffer(8);

    const result = normalizeConfig({ body: buffer, method: "POST" });

    expect(result.body).toBe(buffer);
  });
});
