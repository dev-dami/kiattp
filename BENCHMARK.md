# kiattp Benchmarks

|                  |Ops/sec  |Mean   |p75    |p99    |
|------------------|---------|-------|-------|-------|
|**native fetch()**|**5,707**|0.175ms|0.177ms|0.322ms|
|**kiattp get()**  |**3,885**|0.257ms|0.276ms|0.898ms|
|**axios.get()**   |**937**  |1.067ms|1.094ms|4.834ms|

- kiattp is **4.1x faster than Axios** at mean latency
- kiattp is **5.4x faster than Axios at p99**
- ~0.08ms overhead over native fetch — cost of config normalization + interceptor pipeline

**Environment:** Node.js 18+, vitest `bench`, MSW mock server (localhost), 1000+ iterations.

```bash
npm run bench
```