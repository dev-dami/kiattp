import type { Plugin, Config, Response } from '../types';

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

export interface LoggerOptions {
  level?: LogLevel;
  format?: (config: Config, response?: Response) => string;
  output?: (message: string) => void;
}

export function logger_plugin(opts: LoggerOptions = {}): Plugin {
  const { level = 'info', format = defaultFormat, output = console.log } = opts;
  const threshold = LOG_LEVELS[level];

  return {
    name: 'logger',
    onRequest: (config: Config) => {
      if (LOG_LEVELS.debug >= threshold) {
        output(format(config));
      }
      return config;
    },
    onResponse: (response: Response) => {
      if (LOG_LEVELS.info >= threshold) {
        output(format(response.config, response));
      }
      return response;
    },
  };
}

function defaultFormat(config: Config, response?: Response): string {
  if (response) {
    return `[${config.method}] ${config.url} → ${response.status}`;
  }
  return `[${config.method}] ${config.url}`;
}
