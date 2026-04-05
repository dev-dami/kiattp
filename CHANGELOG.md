# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-05

### Added

- **Core HTTP client** — `request()` function with automatic adapter detection (Fetch API for browser/runtime, Node.js `http`/`https` for Node).
- **Instance API** — `createInstance()` for creating HTTP clients with preconfigured defaults (base URL, headers, timeout, etc.).
- **Convenience methods** — Top-level shorthand functions: `get`, `post`, `put`, `patch`, `del`, `head`, `options`.
- **Request interceptors** — Chainable request interceptor support via `interceptors.request.use()`.
- **Response interceptors** — Chainable response interceptor support via `interceptors.response.use()`.
- **Plugin system** — Extensible plugin architecture with `onRequest`, `onResponse`, and `onError` hooks; global plugin registration via `use()`.
- **Retry plugin** — Configurable retry logic with three backoff strategies (`fixed`, `linear`, `exponential`), customizable status-code triggers, and optional network-error retry.
- **Logger plugin** — Built-in request/response logging plugin.
- **Timeout plugin** — Global timeout configuration via plugin.
- **Axios compatibility layer** — Axios-style API surface exposed via the `kiattp/axios` export entry point.
- **BodyType support** — Rich request body types: `string`, `FormData`, `URLSearchParams`, `Blob`, `ArrayBuffer`, `ArrayBufferView`, `ReadableStream`, `Record<string, unknown>`, and arrays.
- **Progress callbacks** — `onUploadProgress` and `onDownloadProgress` callbacks with `loaded`, `total`, and `bytes` information.
- **Binary response types** — `responseType` support for `blob`, `arraybuffer`, and `stream` in addition to `json` and `text`.
- **Base URL merging** — Intelligent `baseURL` + `url` resolution with edge-case handling: absolute URLs override `baseURL`, trailing/leading slash normalization, and query string parameter encoding via `params`.
- **Header deep merging** — Instance-level headers are deep-merged with per-request headers; header keys are normalized to lowercase.
- **Abort signal support** — Cancellation of in-flight requests via the standard `AbortSignal`.
- **Proxy configuration** — `ProxyConfig` type for defining proxy host, port, protocol, and authentication.
- **Redirect control** — `maxRedirects` configuration for limiting automatic redirects.
- **Custom status validation** — `validateStatus` callback for customizing which HTTP status codes are considered successful.
- **TypeScript-first** — Full type definitions for all public APIs (`Config`, `Response`, `HttpError`, `Plugin`, `Instance`, etc.).
- **Zero runtime dependencies** — No external packages required at runtime.
- **Node.js 18+** — Engine requirement ensures modern runtime features.
