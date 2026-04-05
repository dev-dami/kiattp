import type { AdapterName } from './types';

export function detectAdapter(): AdapterName {
  if (typeof globalThis.fetch === 'function') {
    return 'fetch';
  }
  return 'http';
}
