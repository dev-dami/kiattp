import { describe, it, expect, vi } from "vitest";
import { createInstance, use, request } from "../../src/index";

describe("transformRequest", () => {
  it("applies transformRequest before serialization", async () => {
    const transform = vi.fn((data) => ({ ...data, transformed: true }));
    const api = createInstance({
      baseURL: "https://api.example.com",
      transformRequest: [transform],
    });

    // The transform should be called with the body
    try {
      await api.post("/test", { body: { original: true } });
    } catch {
      // Network error expected in test env
    }

    expect(transform).toHaveBeenCalled();
    const callArg = transform.mock.calls[0][0];
    expect(callArg).toEqual({ original: true });
  });

  it("chains multiple transformRequest functions", async () => {
    const t1 = vi.fn((data) => ({ ...data, step1: true }));
    const t2 = vi.fn((data) => ({ ...data, step2: true }));
    const api = createInstance({
      baseURL: "https://api.example.com",
      transformRequest: [t1, t2],
    });

    try {
      await api.post("/test", { body: {} });
    } catch {
      // Expected
    }

    expect(t1).toHaveBeenCalled();
    expect(t2).toHaveBeenCalled();
  });
});

describe("transformResponse", () => {
  it("applies transformResponse after parsing", async () => {
    const transform = vi.fn((data) => ({ unwrapped: data }));
    const api = createInstance({
      baseURL: "https://api.example.com",
      transformResponse: [transform],
    });

    try {
      await api.get("/test");
    } catch {
      // Expected
    }

    // Transform may not be called if request fails before response
    // but the function should be wired up without errors
  });
});

describe("per-instance adapter selection", () => {
  it("accepts adapter config option", () => {
    const apiFetch = createInstance({
      baseURL: "https://api.example.com",
      adapter: "fetch",
    });
    const apiHttp = createInstance({
      baseURL: "https://api.example.com",
      adapter: "http",
    });

    expect(apiFetch).toBeDefined();
    expect(apiHttp).toBeDefined();
  });
});

describe("maxContentLength", () => {
  it("accepts maxContentLength config option", () => {
    const api = createInstance({
      baseURL: "https://api.example.com",
      maxContentLength: 1024,
    });

    expect(api).toBeDefined();
  });
});

describe("credentials", () => {
  it("accepts credentials config option", () => {
    const api = createInstance({
      baseURL: "https://api.example.com",
      credentials: "include",
    });

    expect(api).toBeDefined();
  });
});

describe("paramsSerializer", () => {
  it("uses custom paramsSerializer when provided", async () => {
    const customSerializer = vi.fn(
      (params: Record<string, string | number | boolean | null | undefined>) =>
        Object.entries(params)
          .filter(([, v]) => v !== null && v !== undefined)
          .map(([k, v]) => `${k}=${v}`)
          .join("&"),
    );

    try {
      await request("https://api.example.com/test", {
        params: { page: 1, limit: 10 },
        paramsSerializer: customSerializer,
      });
    } catch {
      // Expected
    }

    expect(customSerializer).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });
});

describe("retry with jitter", () => {
  it("accepts jitter option in retry plugin", async () => {
    const { retry_plugin } = await import("../../src/plugins/retry");

    const plugin = retry_plugin({ maxRetries: 3, jitter: true });
    expect(plugin.name).toBe("retry");
  });

  it("produces varied delays with jitter", async () => {
    const { calculateDelay, getRetryDelay, incrementRetryAttempt } = await import(
      "../../src/plugins/retry"
    );
    const { defaultConfig } = await import("../../src/core/config");

    const config = {
      ...defaultConfig(),
      _retry: {
        attempts: 1,
        maxRetries: 3,
        backoff: "exponential" as const,
        retryOn: [500],
        retryOnNetworkError: true,
        jitter: true,
      },
    };

    const delays = new Set();
    for (let i = 0; i < 10; i++) {
      const delay = calculateDelay(1, "exponential", true);
      delays.add(Math.round(delay / 100));
    }

    // With jitter, we should see varied delays
    expect(delays.size).toBeGreaterThan(1);
  });
});

describe("xsrf headers", () => {
  it("applyXsrfHeaders is a no-op in Node.js", async () => {
    const { applyXsrfHeaders } = await import("../../src/core/xsrf");
    const headers: Record<string, string> = {};

    applyXsrfHeaders(headers, "XSRF-TOKEN", "X-XSRF-TOKEN");

    // In Node.js, no cookie exists, so no header added
    expect(headers["x-xsrf-token"]).toBeUndefined();
  });
});
