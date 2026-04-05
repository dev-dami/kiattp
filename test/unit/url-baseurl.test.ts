import { describe, it, expect } from "vitest";
import { buildUrl } from "../../src/core/url";

describe("buildUrl with baseURL edge cases", () => {
  it("combines baseURL with relative path", () => {
    const result = buildUrl({ baseURL: "https://api.example.com", url: "users" });
    expect(result).toBe("https://api.example.com/users");
  });

  it("combines baseURL with leading slash path", () => {
    const result = buildUrl({ baseURL: "https://api.example.com", url: "/users" });
    expect(result).toBe("https://api.example.com/users");
  });

  it("handles baseURL with trailing slash", () => {
    const result = buildUrl({ baseURL: "https://api.example.com/", url: "users" });
    expect(result).toBe("https://api.example.com/users");
  });

  it("handles baseURL with trailing slash and leading slash path", () => {
    const result = buildUrl({ baseURL: "https://api.example.com/", url: "/users" });
    expect(result).toBe("https://api.example.com/users");
  });

  it("handles baseURL without trailing slash and path without leading slash", () => {
    const result = buildUrl({ baseURL: "https://api.example.com", url: "users" });
    expect(result).toBe("https://api.example.com/users");
  });

  it("absolute URL overrides baseURL", () => {
    const result = buildUrl({ baseURL: "https://api.example.com", url: "https://other.com/path" });
    expect(result).toBe("https://other.com/path");
  });

  it("handles nested paths", () => {
    const result = buildUrl({ baseURL: "https://api.example.com/api", url: "v1/users" });
    expect(result).toBe("https://api.example.com/api/v1/users");
  });

  it("handles baseURL with path and relative path", () => {
    const result = buildUrl({ baseURL: "https://api.example.com/api/v1/", url: "users" });
    expect(result).toBe("https://api.example.com/api/v1/users");
  });

  it("handles only url without baseURL", () => {
    const result = buildUrl({ url: "https://api.example.com/users" });
    expect(result).toBe("https://api.example.com/users");
  });

  it("handles only relative url without baseURL", () => {
    const result = buildUrl({ url: "/users" });
    expect(result).toBe("/users");
  });

  it("adds query params to combined url", () => {
    const result = buildUrl({
      baseURL: "https://api.example.com",
      url: "users",
      params: { page: "1", limit: "10" },
    });
    expect(result).toBe("https://api.example.com/users?page=1&limit=10");
  });

  it("adds query params with null/undefined filtering", () => {
    const result = buildUrl({
      baseURL: "https://api.example.com",
      url: "users",
      params: { page: "1", limit: null, filter: undefined, active: "true" },
    });
    expect(result).toBe("https://api.example.com/users?page=1&active=true");
  });

  it("handles baseURL ending with multiple slashes", () => {
    const result = buildUrl({ baseURL: "https://api.example.com///", url: "users" });
    // Only strips one trailing slash
    expect(result).toBe("https://api.example.com///users");
  });

  it("handles empty url with baseURL", () => {
    const result = buildUrl({ baseURL: "https://api.example.com", url: "" });
    expect(result).toBe("https://api.example.com");
  });
});
