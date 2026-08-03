import type { Plugin, Config, Response, HttpError } from '../types.js';

export interface DevtoolsOptions {
  /** Output stream callback (defaults to process.stderr.write if available, or console.log) */
  output?: (message: string) => void;
  /** Force enable or disable ANSI formatting (auto-detected from NO_COLOR env var) */
  color?: boolean;
  /** Filter requests by URL pattern */
  filter?: string | RegExp;
  /** Custom label header for the devtools table */
  label?: string;
  /** Enable interactive full-screen ANSI TUI mode (zero-dependency) */
  tui?: boolean;
  /** Enable header details logging on response */
  showHeaders?: boolean;
}

export interface TrackedRequest {
  id: number;
  method: string;
  url: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: number;
  statusText?: string;
  sizeBytes?: number;
  error?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: unknown;
  responseHeaders?: Record<string, string>;
  responseBody?: unknown;
}

let globalReqId = 0;

// Utility: Strip ANSI escape codes to measure visible string length accurately
export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

export function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

export function padRightAnsi(str: string, width: number): string {
  const vLen = visibleLength(str);
  if (vLen >= width) return str;
  return str + ' '.repeat(width - vLen);
}

export function padLeftAnsi(str: string, width: number): string {
  const vLen = visibleLength(str);
  if (vLen >= width) return str;
  return ' '.repeat(width - vLen) + str;
}

// Boundary checking helper: clamps number within min and max
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// Boundary checking helper: safely truncates string to exact char limit with optional suffix
export function truncate(str: string, maxLen: number, suffix = '...'): string {
  if (!str) return '';
  if (maxLen <= 0) return '';
  const plain = stripAnsi(str);
  if (plain.length <= maxLen) return str;
  if (maxLen <= suffix.length) return suffix.slice(0, maxLen);
  return str.slice(0, maxLen - suffix.length) + suffix;
}

// Format bytes in clean ANSI format
export function formatBytesAnsi(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '  -   ';
  if (bytes < 1024) return `${bytes} B`.padStart(6);
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`.padStart(6);
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`.padStart(6);
}

// ANSI Escape Codes for Styling
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  inverse: '\x1b[7m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Bright Foreground colors
  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
};

function getMethodColorAnsi(method: string, enabled: boolean): string {
  if (!enabled) return '';
  switch (method.toUpperCase()) {
    case 'GET':
      return `${ANSI.bold}${ANSI.brightCyan}`;
    case 'POST':
      return `${ANSI.bold}${ANSI.brightGreen}`;
    case 'PUT':
      return `${ANSI.bold}${ANSI.brightYellow}`;
    case 'PATCH':
      return `${ANSI.bold}${ANSI.brightMagenta}`;
    case 'DELETE':
      return `${ANSI.bold}${ANSI.brightRed}`;
    default:
      return `${ANSI.bold}${ANSI.brightBlack}`;
  }
}

function getStatusColorAnsi(status?: number, enabled?: boolean): string {
  if (!enabled) return '';
  if (!status) return `${ANSI.bold}${ANSI.brightRed}`;
  if (status >= 200 && status < 300) return `${ANSI.bold}${ANSI.brightGreen}`;
  if (status >= 300 && status < 400) return `${ANSI.bold}${ANSI.brightCyan}`;
  if (status >= 400 && status < 500) return `${ANSI.bold}${ANSI.brightYellow}`;
  return `${ANSI.bold}${ANSI.brightRed}`;
}

// Render ANSI Waterfall bar using block elements with ANSI color gradient
export function renderWaterfallAnsi(durationMs: number, maxMs: number, barLength = 16, enabled = true): string {
  const safeBarLen = clamp(barLength, 4, 40);
  const ratio = clamp(durationMs / (maxMs || 100), 0.05, 1);
  const filled = clamp(Math.round(ratio * safeBarLen), 1, safeBarLen);
  const empty = safeBarLen - filled;

  const filledChar = '█';
  const emptyChar = '░';

  if (!enabled) {
    return filledChar.repeat(filled) + emptyChar.repeat(empty);
  }

  const barFilled = `${ANSI.cyan}${filledChar.repeat(filled)}`;
  const barEmpty = `${ANSI.brightBlack}${emptyChar.repeat(empty)}${ANSI.reset}`;

  return `${barFilled}${barEmpty}`;
}

/**
 * Zero-dependency interactive ANSI TUI Controller for Terminal DevTools
 */
export class DevtoolsTUI {
  private requests: TrackedRequest[] = [];
  private active = false;
  private selectedIndex = 0;
  private showInspector = false;
  private inspectorTab: 'all' | 'headers' | 'body' = 'all';
  private inspectorScrollOffset = 0;
  private maxInspectorScroll = 0;
  private title: string;
  private color: boolean;
  private onResizeHandler?: () => void;
  private onKeyHandler?: (chunk: Buffer) => void;

  constructor(title = 'KIATTP DEVTOOLS TUI v0.4.0', color = true) {
    this.title = title;
    this.color = color;
  }

  public start() {
    if (this.active) return;
    if (typeof process === 'undefined' || !process.stdout || !process.stdin) return;

    this.active = true;

    // Enter alternate screen buffer & hide cursor
    process.stdout.write('\x1b[?1049h\x1b[?25l');

    // Handle raw keyboard input if TTY
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();

      this.onKeyHandler = (data: Buffer) => {
        const key = data.toString();

        // Ctrl+C or 'q' -> exit TUI
        if (key === '\u0003' || key === 'q' || key === 'Q') {
          this.stop();
          process.exit(0);
        }

        // 'r' -> reload / clear request list
        if (key === 'r' || key === 'R') {
          this.clear();
        }

        // Up arrow or 'k'
        if (key === '\u001b[A' || key === 'k' || key === 'K') {
          if (this.showInspector && this.inspectorScrollOffset > 0) {
            this.inspectorScrollOffset--;
          } else if (this.selectedIndex > 0) {
            this.selectedIndex--;
            this.inspectorScrollOffset = 0;
          }
          this.render();
        }

        // Down arrow or 'j'
        if (key === '\u001b[B' || key === 'j' || key === 'J') {
          if (this.showInspector && this.inspectorScrollOffset < this.maxInspectorScroll) {
            this.inspectorScrollOffset++;
          } else if (this.selectedIndex < this.requests.length - 1) {
            this.selectedIndex++;
            this.inspectorScrollOffset = 0;
          }
          this.render();
        }

        // Enter or Space or 'i' -> Toggle Inspector Panel
        if (key === '\r' || key === '\n' || key === ' ' || key === 'i' || key === 'I') {
          this.showInspector = !this.showInspector;
          this.inspectorScrollOffset = 0;
          this.render();
        }

        // Tab -> Switch Inspector view mode (all -> headers -> body)
        if (key === '\t') {
          if (this.inspectorTab === 'all') this.inspectorTab = 'headers';
          else if (this.inspectorTab === 'headers') this.inspectorTab = 'body';
          else this.inspectorTab = 'all';
          this.inspectorScrollOffset = 0;
          this.render();
        }

        // Escape -> Close Inspector
        if (key === '\u001b') {
          this.showInspector = false;
          this.inspectorScrollOffset = 0;
          this.render();
        }
      };
      process.stdin.on('data', this.onKeyHandler);
    }

    // Handle terminal resize
    this.onResizeHandler = () => this.render();
    process.stdout.on('resize', this.onResizeHandler);

    this.render();
  }

  public stop() {
    if (!this.active) return;
    this.active = false;

    if (typeof process !== 'undefined' && process.stdout) {
      // Exit alternate screen buffer & show cursor
      process.stdout.write('\x1b[?25h\x1b[?1049l');
      if (process.stdin && process.stdin.isTTY) {
        process.stdin.setRawMode(false);
        if (this.onKeyHandler) {
          process.stdin.off('data', this.onKeyHandler);
        }
      }
      if (this.onResizeHandler) {
        process.stdout.off('resize', this.onResizeHandler);
      }
    }
  }

  public clear() {
    this.requests = [];
    this.selectedIndex = 0;
    this.showInspector = false;
    this.inspectorScrollOffset = 0;
    this.maxInspectorScroll = 0;
    this.render();
  }

  public addRequest(req: TrackedRequest) {
    this.requests.push(req);
    // Keep selection on latest item if user hasn't manually moved up
    if (this.selectedIndex === Math.max(0, this.requests.length - 2)) {
      this.selectedIndex = this.requests.length - 1;
    }
    this.render();
  }

  public updateRequest(req: TrackedRequest) {
    const idx = this.requests.findIndex((r) => r.id === req.id);
    if (idx !== -1) {
      this.requests[idx] = { ...this.requests[idx], ...req };
    } else {
      this.requests.push(req);
    }
    this.render();
  }

  public render() {
    if (!this.active || typeof process === 'undefined' || !process.stdout) return;

    // Get terminal dimensions with strict boundary checking
    const cols = clamp(process.stdout.columns || 80, 40, 300);
    const rows = clamp(process.stdout.rows || 24, 12, 200);

    // Clear screen completely and move cursor home
    let output = '\x1b[2J\x1b[H';

    const dim = this.color ? ANSI.brightBlack : '';
    const reset = this.color ? ANSI.reset : '';
    const bold = this.color ? ANSI.bold : '';
    const cyan = this.color ? ANSI.brightCyan : '';
    const green = this.color ? ANSI.brightGreen : '';
    const yellow = this.color ? ANSI.brightYellow : '';
    const magenta = this.color ? ANSI.brightMagenta : '';

    // Header box using ANSI Box Drawing characters
    const innerWidth = cols - 2; // Exact width inside left/right border
    const titlePadded = truncate(this.title, innerWidth - 2);
    const line1 = `┌${'─'.repeat(innerWidth)}┐`;
    const line2 = `│ ${bold}${cyan}${padRightAnsi(titlePadded, innerWidth - 2)}${reset} │`;
    const line3 = `├${'─'.repeat(innerWidth)}┤`;

    output += `${dim}${line1}${reset}\n${line2}\n${dim}${line3}${reset}\n`;

    // Exact Column Budget Math to prevent horizontal wrapping:
    // Outer width = cols. Inner width = cols - 2.
    // Columns: [SEL 3] │ [METHOD 6] │ [PATH var] │ [STATUS 6] │ [WATERFALL var] │ [LATENCY 8]
    // Separators: 5 x 3 (" │ ") = 15 chars. Left margin = 2 ("│ "). Right margin = 2 (" │").
    // Fixed total: 2 (left) + 3 (SEL) + 3 + 6 (METHOD) + 3 + 6 (STATUS) + 3 + 8 (LATENCY) + 2 (right) + 4 (separators) = 41.
    const remForPathAndBar = Math.max(20, cols - 41);
    const barWidth = clamp(Math.floor(remForPathAndBar * 0.35), 8, 24);
    const pathWidth = remForPathAndBar - barWidth;

    const hdrSel = padRightAnsi(`${bold}SEL${reset}`, 3);
    const hdrMethod = padRightAnsi(`${bold}METHOD${reset}`, 6);
    const hdrPath = padRightAnsi(`${bold}PATH${reset}`, pathWidth);
    const hdrStatus = padRightAnsi(`${bold}STATUS${reset}`, 6);
    const hdrBar = padRightAnsi(`${bold}WATERFALL${reset}`, barWidth);
    const hdrLatency = padRightAnsi(`${bold}LATENCY${reset}`, 8);

    const colHeader = `│ ${hdrSel} │ ${hdrMethod} │ ${hdrPath} │ ${hdrStatus} │ ${hdrBar} │ ${hdrLatency} │`;
    const sepHeader = `${dim}├${'─'.repeat(5)}┼${'─'.repeat(8)}┼${'─'.repeat(pathWidth + 2)}┼${'─'.repeat(8)}┼${'─'.repeat(barWidth + 2)}┼${'─'.repeat(10)}┤${reset}`;

    output += `${colHeader}\n${sepHeader}\n`;

    // Calculate maximum duration for waterfall scaling
    const maxMs = this.requests.reduce((max, r) => Math.max(max, r.duration || 50), 50);

    // Reserve height for Inspector Panel if active
    const availableRowsTotal = Math.max(3, rows - 8);
    let inspectorHeight = 0;
    let requestListRows = availableRowsTotal;

    if (this.showInspector) {
      requestListRows = clamp(Math.floor(availableRowsTotal * 0.35), 2, 6);
      inspectorHeight = Math.max(2, availableRowsTotal - requestListRows - 1);
    }

    // Calculate visible window slice for request list scrolling
    let startIndex = 0;
    if (this.requests.length > requestListRows) {
      startIndex = Math.max(0, Math.min(this.selectedIndex - Math.floor(requestListRows / 2), this.requests.length - requestListRows));
    }
    const visibleRequests = this.requests.slice(startIndex, startIndex + requestListRows);

    if (visibleRequests.length === 0) {
      const emptyMsg = 'No in-flight HTTP requests. Listening for kiattp calls...';
      output += `│ ${dim}${padRightAnsi(truncate(emptyMsg, innerWidth - 2), innerWidth - 2)}${reset} │\n`;
    } else {
      for (let i = 0; i < visibleRequests.length; i++) {
        const req = visibleRequests[i];
        if (!req) continue;

        const absoluteIndex = startIndex + i;
        const isSelected = absoluteIndex === this.selectedIndex;

        const methodColor = getMethodColorAnsi(req.method, this.color);
        const statusColor = getStatusColorAnsi(req.status, this.color);

        const selStr = isSelected ? padRightAnsi(`${this.color ? ANSI.brightGreen + ANSI.bold : ''}►${reset}`, 3) : padRightAnsi('', 3);
        const methodStr = padRightAnsi(`${methodColor}${req.method}${reset}`, 6);

        // Truncate path safely to pathWidth
        let pathStr = req.url;
        try {
          const parsed = new URL(req.url, 'http://localhost');
          pathStr = parsed.pathname + parsed.search;
        } catch {
          // fallback
        }
        pathStr = padRightAnsi(truncate(pathStr, pathWidth), pathWidth);

        const statusVal = req.status ? `${req.status}` : (req.endTime ? 'ERR' : '...');
        const statusStr = padLeftAnsi(`${statusColor}${statusVal}${reset}`, 6);

        const barStr = padRightAnsi(renderWaterfallAnsi(req.duration || 0, maxMs, barWidth, this.color), barWidth);
        const durationStr = padLeftAnsi(req.duration !== undefined ? `${req.duration} ms` : 'Pending', 8);

        if (isSelected && this.color) {
          output += `│ ${selStr} │ ${ANSI.inverse}${methodStr} │ ${pathStr} │ ${statusStr} │ ${barStr} │ ${durationStr}${reset} │\n`;
        } else {
          output += `│ ${selStr} │ ${methodStr} │ ${dim}${pathStr}${reset} │ ${statusStr} │ ${barStr} │ ${dim}${durationStr}${reset} │\n`;
        }
      }
    }

    // Table bottom border
    output += `${dim}├${'─'.repeat(innerWidth)}┤${reset}\n`;

    // Render Inspector Panel if active
    if (this.showInspector && this.requests.length > 0) {
      const selectedReq = this.requests[clamp(this.selectedIndex, 0, this.requests.length - 1)];
      if (selectedReq) {
        output += this.renderInspectorPanel(selectedReq, cols, inspectorHeight);
        output += `${dim}├${'─'.repeat(innerWidth)}┤${reset}\n`;
      }
    }

    // Footer summary line
    const totalReqs = this.requests.length;
    const totalErr = this.requests.filter((r) => r.error || (r.status && r.status >= 400)).length;
    const avgMs = totalReqs > 0 ? Math.round(this.requests.reduce((acc, r) => acc + (r.duration || 0), 0) / totalReqs) : 0;

    const keyNav = this.color ? `${ANSI.bold}${yellow}[↑/↓]${reset}` : '[↑/↓]';
    const keyInspect = this.color ? `${ANSI.bold}${green}[Enter/Space] Inspect${reset}` : '[Enter] Inspect';
    const keyTab = this.color ? `${ANSI.bold}${magenta}[Tab] Tab (${this.inspectorTab.toUpperCase()})${reset}` : `[Tab] (${this.inspectorTab.toUpperCase()})`;
    const keyReload = this.color ? `${ANSI.bold}${yellow}[R]eload${reset}` : '[R]eload';
    const keyQuit = this.color ? `${ANSI.bold}${yellow}[Q]uit${reset}` : '[Q]uit';

    const summaryStyled = `${keyNav} Select | ${keyInspect} | ${keyTab} | ${keyReload} | ${keyQuit}`;
    output += `│ ${padRightAnsi(summaryStyled, innerWidth - 2)} │\n`;
    output += `${dim}└${'─'.repeat(innerWidth)}┘${reset}`;

    process.stdout.write(output);
  }

  private renderInspectorPanel(req: TrackedRequest, cols: number, maxLines: number): string {
    const innerWidth = cols - 2;
    const dim = this.color ? ANSI.brightBlack : '';
    const reset = this.color ? ANSI.reset : '';
    const bold = this.color ? ANSI.bold : '';
    const cyan = this.color ? ANSI.brightCyan : '';
    const yellow = this.color ? ANSI.brightYellow : '';
    const green = this.color ? ANSI.brightGreen : '';
    const red = this.color ? ANSI.brightRed : '';

    const allLines: string[] = [];

    // Title Line
    const statusText = req.status ? `${req.status} ${req.statusText ?? ''}` : 'Pending/Failed';
    const titleText = `INSPECTOR [TAB: ${this.inspectorTab.toUpperCase()}]: ${req.method} ${req.url} (${statusText} | ${req.duration ?? 0}ms)`;
    allLines.push(`│ ${bold}${yellow}${padRightAnsi(truncate(titleText, innerWidth - 2), innerWidth - 2)}${reset} │`);
    allLines.push(`${dim}├${'─'.repeat(innerWidth)}┤${reset}`);

    // Headers View
    if (this.inspectorTab === 'all' || this.inspectorTab === 'headers') {
      if (req.requestHeaders && Object.keys(req.requestHeaders).length > 0) {
        allLines.push(`│ ${bold}${cyan}${padRightAnsi('[REQUEST HEADERS]', innerWidth - 2)}${reset} │`);
        for (const [k, v] of Object.entries(req.requestHeaders)) {
          const hLine = `  ${k}: ${v}`;
          allLines.push(`│ ${dim}${padRightAnsi(truncate(hLine, innerWidth - 2), innerWidth - 2)}${reset} │`);
        }
      }

      if (req.responseHeaders && Object.keys(req.responseHeaders).length > 0) {
        allLines.push(`│ ${bold}${cyan}${padRightAnsi('[RESPONSE HEADERS]', innerWidth - 2)}${reset} │`);
        for (const [k, v] of Object.entries(req.responseHeaders)) {
          const hLine = `  ${k}: ${v}`;
          allLines.push(`│ ${dim}${padRightAnsi(truncate(hLine, innerWidth - 2), innerWidth - 2)}${reset} │`);
        }
      }
    }

    // Body View
    if (this.inspectorTab === 'all' || this.inspectorTab === 'body') {
      if (req.requestBody !== undefined && req.requestBody !== null) {
        allLines.push(`│ ${bold}${green}${padRightAnsi('[REQUEST BODY]', innerWidth - 2)}${reset} │`);
        const bodyStr = typeof req.requestBody === 'object' ? JSON.stringify(req.requestBody, null, 2) : String(req.requestBody);
        for (const line of bodyStr.split('\n')) {
          allLines.push(`│ ${padRightAnsi(truncate(line, innerWidth - 2), innerWidth - 2)} │`);
        }
      }

      if (req.responseBody !== undefined && req.responseBody !== null) {
        allLines.push(`│ ${bold}${green}${padRightAnsi('[RESPONSE BODY]', innerWidth - 2)}${reset} │`);
        const bodyStr = typeof req.responseBody === 'object' ? JSON.stringify(req.responseBody, null, 2) : String(req.responseBody);
        for (const line of bodyStr.split('\n')) {
          allLines.push(`│ ${padRightAnsi(truncate(line, innerWidth - 2), innerWidth - 2)} │`);
        }
      }

      if (req.error) {
        allLines.push(`│ ${bold}${red}${padRightAnsi('[ERROR DETAILS]', innerWidth - 2)}${reset} │`);
        allLines.push(`│ ${red}${padRightAnsi(truncate(req.error, innerWidth - 2), innerWidth - 2)}${reset} │`);
      }
    }

    // Update max scroll tracking so Down/Up seamlessly transition between Inspector scroll & Request list!
    this.maxInspectorScroll = Math.max(0, allLines.length - maxLines);
    this.inspectorScrollOffset = clamp(this.inspectorScrollOffset, 0, this.maxInspectorScroll);

    const visibleInspectorLines = allLines.slice(this.inspectorScrollOffset, this.inspectorScrollOffset + maxLines);

    // Fill empty inspector lines to keep height constant and clean
    while (visibleInspectorLines.length < maxLines) {
      visibleInspectorLines.push(`│ ${' '.repeat(innerWidth - 2)} │`);
    }

    return visibleInspectorLines.join('\n') + '\n';
  }
}

export function devtools_plugin(options: DevtoolsOptions = {}): Plugin {
  const useColor = options.color ?? (typeof process !== 'undefined' ? !process.env.NO_COLOR : true);

  const write = options.output ?? ((msg: string) => {
    if (typeof process !== 'undefined' && process.stderr && process.stderr.write) {
      process.stderr.write(msg + '\n');
    } else {
      console.log(msg);
    }
  });

  const requests = new Map<number, TrackedRequest>();
  let maxObservedMs = 50;
  let headerPrinted = false;

  let tuiController: DevtoolsTUI | undefined;
  if (options.tui) {
    tuiController = new DevtoolsTUI(options.label ?? 'KIATTP DEVTOOLS ANSI TUI v0.4.0', useColor);
    tuiController.start();
  }

  function printHeader() {
    if (headerPrinted || options.tui) return;
    headerPrinted = true;
    const label = options.label ?? 'KIATTP DEVTOOLS v0.4.0';
    const bold = useColor ? ANSI.bold + ANSI.brightCyan : '';
    const dim = useColor ? ANSI.brightBlack : '';
    const reset = useColor ? ANSI.reset : '';

    const cols = clamp(typeof process !== 'undefined' && process.stdout?.columns ? process.stdout.columns : 80, 40, 120);
    const border = '─'.repeat(cols - 4 - label.length);
    write(`${dim}┌─ ${bold}${label}${reset}${dim} ${border}┐${reset}`);
  }

  function matchesFilter(url: string): boolean {
    if (!options.filter) return true;
    if (typeof options.filter === 'string') return url.includes(options.filter);
    return options.filter.test(url);
  }

  return {
    name: 'devtools',

    onRequest: (config: Config) => {
      const url = config.url ?? '';
      if (!matchesFilter(url)) return config;

      printHeader();

      const reqId = ++globalReqId;
      (config as Config & { _devtoolsId?: number })._devtoolsId = reqId;

      const tracked: TrackedRequest = {
        id: reqId,
        method: (config.method ?? 'GET').toUpperCase(),
        url,
        startTime: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        requestHeaders: config.headers ? { ...config.headers } : undefined,
        requestBody: config.body,
      };

      requests.set(reqId, tracked);

      if (tuiController) {
        tuiController.addRequest(tracked);
      }

      return config;
    },

    onResponse: (response: Response) => {
      const config = response.config as Config & { _devtoolsId?: number };
      const reqId = config?._devtoolsId;
      if (!reqId || !requests.has(reqId)) return response;

      const req = requests.get(reqId)!;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      req.endTime = now;
      req.duration = Math.round(now - req.startTime);
      req.status = response.status;
      req.statusText = response.statusText;
      req.responseHeaders = response.headers ? { ...response.headers } : undefined;
      req.responseBody = response.data;

      const cl = response.headers?.['content-length'];
      if (cl && !isNaN(parseInt(cl, 10))) {
        req.sizeBytes = parseInt(cl, 10);
      } else if (typeof response.data === 'string') {
        req.sizeBytes = response.data.length;
      } else if (response.data) {
        try {
          req.sizeBytes = JSON.stringify(response.data).length;
        } catch {
          req.sizeBytes = undefined;
        }
      }

      if (req.duration > maxObservedMs) {
        maxObservedMs = req.duration;
      }

      if (tuiController) {
        tuiController.updateRequest(req);
      } else {
        printRowAnsi(req, maxObservedMs, useColor, write);
        if (options.showHeaders && response.headers) {
          printHeadersAnsi(response.headers, useColor, write);
        }
      }

      return response;
    },

    onError: (error: HttpError) => {
      const config = error.config as Config & { _devtoolsId?: number };
      const devtoolsId = config?._devtoolsId;
      if (devtoolsId && requests.has(devtoolsId)) {
        const req = requests.get(devtoolsId)!;
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        req.endTime = now;
        req.duration = Math.round(now - req.startTime);
        req.status = error.status ?? 0;
        req.error = error.message;
        req.responseHeaders = error.response?.headers ? { ...error.response.headers } : undefined;
        req.responseBody = error.response?.data;

        if (req.duration > maxObservedMs) {
          maxObservedMs = req.duration;
        }

        if (tuiController) {
          tuiController.updateRequest(req);
        } else {
          printRowAnsi(req, maxObservedMs, useColor, write);
        }
      }
      throw error;
    },
  };
}

function printRowAnsi(req: TrackedRequest, maxMs: number, useColor: boolean, write: (msg: string) => void) {
  const cols = clamp(typeof process !== 'undefined' && process.stdout?.columns ? process.stdout.columns : 80, 40, 200);

  const methodColor = getMethodColorAnsi(req.method, useColor);
  const statusColor = getStatusColorAnsi(req.status, useColor);
  const dim = useColor ? ANSI.brightBlack : '';
  const reset = useColor ? ANSI.reset : '';

  const methodFormatted = padRightAnsi(`${methodColor}${req.method}${reset}`, 6);

  const maxUrlWidth = clamp(cols - 52, 15, 60);
  let displayUrl = req.url;
  try {
    const parsed = new URL(req.url, 'http://localhost');
    displayUrl = parsed.pathname + parsed.search;
  } catch {
    // keep as is
  }
  const urlFormatted = padRightAnsi(truncate(displayUrl, maxUrlWidth), maxUrlWidth);

  const statusStr = req.status ? `${req.status}` : 'ERR';
  const statusFormatted = padLeftAnsi(`${statusColor}${statusStr}${reset}`, 6);

  const bar = padRightAnsi(renderWaterfallAnsi(req.duration ?? 0, maxMs, 14, useColor), 14);
  const durationStr = padLeftAnsi(`${req.duration ?? 0}ms`, 6);
  const sizeStr = formatBytesAnsi(req.sizeBytes);
  const errMarker = req.error ? ` ${useColor ? ANSI.brightRed : ''}[ERR]${reset}` : '';

  write(
    `${dim}│${reset} ${methodFormatted} ${dim}${urlFormatted}${reset} ${statusFormatted} ${bar} ${dim}${durationStr}${reset} ${dim}${sizeStr}${reset}${errMarker}`,
  );
}

function printHeadersAnsi(headers: Record<string, string>, useColor: boolean, write: (msg: string) => void) {
  const dim = useColor ? ANSI.brightBlack : '';
  const cyan = useColor ? ANSI.brightCyan : '';
  const reset = useColor ? ANSI.reset : '';

  for (const [key, val] of Object.entries(headers)) {
    write(`${dim}│   ${cyan}${key}${dim}: ${val}${reset}`);
  }
}
