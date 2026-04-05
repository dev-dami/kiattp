# kiattp Benchmarks

## Latency (ops/sec, higher is better)

| | Ops/sec | Mean | p75 | p99 | vs Fetch |
|---|---|---|---|---|---|
| **native fetch()** | **5,707** | 0.175ms | 0.177ms | 0.322ms | — fastest |
| **kiattp get()** | **3,885** | 0.257ms | 0.276ms | 0.898ms | 1.47x slower |
| **axios.get()** | **937** | 1.067ms | 1.094ms | 4.834ms | 6.09x slower |

## Summary

- **kiattp is 4.1x faster than axios**
- **kiattp overhead over native fetch is ~0.08ms per request**
- Overhead comes from config normalization + interceptor pipeline (axios does the same, just slower)

## Environment

- Node.js 18+
- vitest `bench` mode
- MSW mock server (localhost)
- 1000+ iterations per benchmark
