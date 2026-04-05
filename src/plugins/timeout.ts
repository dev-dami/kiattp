import type { Plugin, Config } from '../types';

export interface TimeoutOptions {
  timeout: number;
}

export function timeout_plugin(opts: TimeoutOptions): Plugin {
  const { timeout } = opts;

  return {
    name: 'timeout',
    onRequest: (config: Config) => {
      if (!config.timeout) {
        config.timeout = timeout;
      }
      return config;
    },
  };
}
