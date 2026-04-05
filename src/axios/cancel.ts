export class CancelToken {
  private _promise: Promise<void>;
  private _resolve!: () => void;
  private _reason?: string;
  private _aborted = false;

  constructor(executor: (cancel: (message?: string) => void) => void) {
    this._promise = new Promise<void>((resolve) => {
      this._resolve = resolve;
    });
    executor((message?: string) => {
      this._reason = message;
      this._aborted = true;
      this._resolve();
    });
  }

  get promise(): Promise<void> {
    return this._promise;
  }

  get reason(): string | undefined {
    return this._reason;
  }

  throwIfRequested(): void {
    if (this._aborted) {
      const err = new Error(this._reason);
      err.name = 'CanceledError';
      throw err;
    }
  }

  static source(): { token: CancelToken; cancel: (message?: string) => void } {
    let cancelFn: ((message?: string) => void) | undefined;
    const token = new CancelToken((cancel) => {
      cancelFn = cancel;
    });
    return {
      token,
      cancel: cancelFn!,
    };
  }
}

export function isCancel(value: unknown): boolean {
  return value instanceof Error && value.name === 'CanceledError';
}
