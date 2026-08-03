import { describe, it, expect } from 'vitest';
import {
  devtools_plugin,
  DevtoolsTUI,
  clamp,
  truncate,
  stripAnsi,
  visibleLength,
  padRightAnsi,
  padLeftAnsi,
  formatBytesAnsi,
  renderWaterfallAnsi,
} from '../../src/plugins/devtools.js';
import type { Config, Response, HttpError } from '../../src/types.js';

describe('devtools_plugin ANSI & Layout Fit Tests', () => {
  it('boundary checking: clamp() locks values within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-10, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });

  it('boundary checking: truncate() safely trims strings with ellipsis', () => {
    expect(truncate('hello world', 20)).toBe('hello world');
    expect(truncate('hello world', 8)).toBe('hello...');
    expect(truncate('hello world', 3)).toBe('...');
    expect(truncate('hello world', 0)).toBe('');
  });

  it('ANSI string measurement: stripAnsi & visibleLength measure plain chars', () => {
    const ansiStr = '\x1b[36m\x1b[1mGET\x1b[0m';
    expect(stripAnsi(ansiStr)).toBe('GET');
    expect(visibleLength(ansiStr)).toBe(3);
  });

  it('ANSI padding: padRightAnsi & padLeftAnsi align strings cleanly', () => {
    const ansiStr = '\x1b[36mGET\x1b[0m'; // visible length 3
    const padded = padRightAnsi(ansiStr, 6);
    expect(visibleLength(padded)).toBe(6);
    expect(padded.endsWith('   ')).toBe(true);

    const paddedLeft = padLeftAnsi(ansiStr, 6);
    expect(visibleLength(paddedLeft)).toBe(6);
    expect(paddedLeft.startsWith('   ')).toBe(true);
  });

  it('formats bytes in ANSI format', () => {
    expect(formatBytesAnsi(500)).toContain('500 B');
    expect(formatBytesAnsi(2048)).toContain('2.0 KB');
    expect(formatBytesAnsi(2 * 1024 * 1024)).toContain('2.0 MB');
    expect(formatBytesAnsi(undefined)).toBe('  -   ');
  });

  it('renders ANSI waterfall bars', () => {
    const barPlain = renderWaterfallAnsi(50, 100, 10, false);
    expect(barPlain).toBe('█████░░░░░');

    const barColor = renderWaterfallAnsi(50, 100, 10, true);
    expect(barColor).toContain('\x1b[36m'); // ANSI Cyan
    expect(barColor).toContain('█████');
  });

  it('prints ANSI table header and request row on success', async () => {
    const outputLines: string[] = [];
    const plugin = devtools_plugin({
      output: (msg) => outputLines.push(msg),
      color: false,
    });

    const config: Config = { url: 'https://api.example.com/users', method: 'GET' };
    const processedConfig = await plugin.onRequest!(config);

    expect(outputLines.length).toBe(1);
    expect(outputLines[0]).toContain('KIATTP DEVTOOLS');

    const response: Response = {
      data: { id: 1, name: 'Alice' },
      status: 200,
      statusText: 'OK',
      headers: { 'content-length': '25' },
      config: processedConfig,
    };

    await plugin.onResponse!(response);

    expect(outputLines.length).toBe(2);
    expect(outputLines[1]).toContain('GET');
    expect(outputLines[1]).toContain('/users');
    expect(outputLines[1]).toContain('200');
    expect(outputLines[1]).toContain('25 B');
  });

  it('handles error responses in ANSI mode with [ERR]', async () => {
    const outputLines: string[] = [];
    const plugin = devtools_plugin({
      output: (msg) => outputLines.push(msg),
      color: false,
    });

    const config: Config = { url: 'https://api.example.com/not-found', method: 'POST' };
    const processedConfig = await plugin.onRequest!(config);

    const error: HttpError = Object.assign(new Error('HTTP 404'), {
      name: 'HttpError' as const,
      status: 404,
      statusText: 'Not Found',
      config: processedConfig,
    });

    expect(() => plugin.onError!(error)).toThrow('HTTP 404');

    expect(outputLines.length).toBe(2);
    expect(outputLines[1]).toContain('POST');
    expect(outputLines[1]).toContain('/not-found');
    expect(outputLines[1]).toContain('404');
    expect(outputLines[1]).toContain('[ERR]');
  });

  it('TUI Controller instantiates cleanly without crashing', () => {
    const tui = new DevtoolsTUI('TEST TUI', false);
    expect(tui).toBeDefined();
    expect(typeof tui.start).toBe('function');
    expect(typeof tui.stop).toBe('function');
    expect(typeof tui.clear).toBe('function');
  });
});
