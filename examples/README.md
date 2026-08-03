# kiattp DevTools Interactive TUI Examples

This directory contains a complete, self-contained demonstration of `kiattp/devtools` in **interactive ANSI TUI mode**, complete with a built-in zero-dependency mock HTTP server.

## Files

- `server.ts`: Mock HTTP server with realistic endpoints, custom response headers (`X-Request-ID`, `Cache-Control`), delays, and error handling.
- `demo-tui.ts`: Interactive TUI demo script executing parallel and sequential requests and rendering the interactive ANSI network tab.

## Running the Demo

### With Bun:
```bash
bun examples/demo-tui.ts
```

### With Node.js / tsx:
```bash
npx tsx examples/demo-tui.ts
```

## TUI Keyboard Controls

| Key | Action |
| --- | --- |
| `↑` / `k` | Move selection UP |
| `↓` / `j` | Move selection DOWN |
| `Enter` / `Space` / `i` | Toggle Network Inspection Panel for selected request |
| `Tab` | Switch Inspector view tabs (`ALL` → `HEADERS` → `BODY`) |
| `r` / `R` | Clear request history / Reload |
| `q` / `Q` / `Ctrl+C` | Exit TUI dashboard |
