export type ResolveType<T> = (value?: T | PromiseLike<T>) => void;

type ValueType<T> = T extends PromiseLike<infer U> ? U : never;

type SyncChainValueType<T> = T extends PromiseLike<infer U> ? U : T;

type SyncChainType<T> = SyncChain<SyncChainValueType<T>>;

type AllReturnType<T extends readonly any[]> = {
  [K in keyof T]: ValueType<T[K]>;
}

type AllSettledReturnType<T extends readonly any[]> = {
  [K in keyof T]: {
    status: "fulfilled" | "rejected";
    value?: ValueType<T[K]>;
    reason?: any;
  };
}

type AnyReturnType<T extends readonly any[]> = ValueType<T[number]>;

/**
 * @brief Synchronous chain of operations
 *
 * This class exposes a Promise-like interface that allows a chain of
 * operations to be executed synchronously.
 *
 */
export class SyncChain<T = any> implements PromiseLike<T> {
  executor: (resolve: ResolveType<T>, reject: (error?: any) => void) => void;

  constructor(
    executor: (resolve: ResolveType<T>, reject: (error?: any) => void) => void,
    lazy: boolean = false,
  ) {
    this.executor = executor;
    if (!lazy) {
      this.run();
    }
  }

  static lazy<T = any>(executor: (resolve: ResolveType<T>, reject: (error?: any) => void) => void) {
    return new SyncChain<T>(executor, true);
  }

  static eager<T = any>(executor: (resolve: ResolveType<T>, reject: (error?: any) => void) => void) {
    return new SyncChain<T>(executor);
  }

  private resolved: (T | undefined)[] = [];
  private rejected: any[] = [];
  private resolving: (T | PromiseLike<T> | undefined)[] = [];
  private rejecting: (T | PromiseLike<any> | undefined)[] = [];
  private settled: boolean = false;

  private _doResolve = (value?: T) => {
    this.resolving = [value];
    this.rejecting = [];
    this.resolved = [value];
    this.settled = true;
    this.notifyListeners(true);
  }

  private _doReject = (error?: T) => {
    this.resolving = [];
    this.rejecting = [error];
    this.rejected = [error];
    this.settled = true;
    this.notifyListeners(false);
  }

  private _resolve = (value?: T | PromiseLike<any>) => {
    if (this.settled) {
      return;
    }
    if (this.resolving.length === 0 && this.rejecting.length === 0) {
      this.resolving.push(value);
    }
    if (this.resolving[0] === value) {
      if (isPromiseLike(value)) {
        if (value instanceof SyncChain) {
          value.run();
        }
        const step = value.then(
          this._doResolve,
          this._doReject,
        );
        if (step instanceof SyncChain) {
          step.run();
        }
      } else {
        this._doResolve(value as T);
      }
    }
  };

  private _reject = (error?: any) => {
    if (this.settled) {
      return;
    }
    if (this.resolving.length === 0 && this.rejecting.length === 0) {
      this.rejecting.push(error);
    }
    if (this.rejecting[0] === error) {
      if (isPromiseLike(error)) {
        if (error instanceof SyncChain) {
          error.run();
        }
        const step = error.then(
          this._doReject,
          this._doReject,
        );
        if (step instanceof SyncChain) {
          step.run();
        }
      } else {
        this._doReject(error);
      }
    }
  }

  private started: boolean = false;
  run() {
    if (!this.started) {
      this.started = true;
      try {
        this.executor(
          this._resolve,
          this._reject,
        )
      } catch (error) {
        this._reject(error);
      }
    }
    return this;
  }

  get isExecuted() {
    return this.started;
  }

  get isSettled() {
    return this.settled;
  }

  get isFulfilled() {
    return this.resolved.length > 0;
  }

  get isRejected() {
    return this.rejected.length > 0;
  }

  get value(): T | undefined {
    return this.valueOr(undefined) as T;
  }

  valueOr<U>(fallback: U): T | U {
    return this.isFulfilled ? (this.resolved[0] as T) : fallback;
  }

  get error() {
    return this.errorOr(undefined);
  }

  errorOr(fallback: any) {
    return this.isRejected ? this.rejected[0] : fallback;
  }

  tryGet() {
    return this.tryGetOr(undefined);
  }

  tryGetOr<U>(fallback?: U) {
    this.run();
    if (!this.settled) {
      return fallback;
    }
    if (this.isRejected) {
      throw this.error;
    }
    return this.value;
  }

  get(): T {
    this.run();
    if (!this.settled) {
      throw new Error("SyncChain.get called on a promise that is not settled");
    }
    if (this.isRejected) {
      throw this.error;
    }
    return this.value!;
  }

  then<V>(
    onResolved: undefined,
    onRejected: (error: any) => V,
  ): SyncChain<V>;
  then<U>(
    onResolved: (value: T) => PromiseLike<U>,
  ): SyncChain<U>;
  then<U, V = U>(
    onResolved: (value: T) => PromiseLike<U>,
    onRejected: (error: any) => V,
  ): SyncChain<U | V>;
  then<U>(
    onResolved: (value: T) => U,
  ): SyncChain<U>;
  then<U, V = U>(
    onResolved: (value: T) => U,
    onRejected: (error: any) => V,
  ): SyncChain<U | V>;
  then<U, V = U>(
    onResolved: (value?: any) => U = (value?: T) => (value as unknown as U),
    onRejected: (error?: any) => V = (error: any) => { throw error; },
  ) {
    return new SyncChain<U | V>((resolve, reject) => {
      const flatReject = (error?: any) => {
        try {
          resolve(onRejected(error) as any);
        } catch (e) {
          reject(e);
        }
      };

      const flatResolve = (value?: any) => {
        try {
          resolve(onResolved(value));
        } catch (e) {
          flatReject(e);
        }
      };

      this.addEventListener("fulfilled", flatResolve);
      this.addEventListener("rejected", flatReject);
    });
    /*
    if (this.isFulfilled) {
      return SyncChain.resolve<T>(this.resolved[0] as T).then(onResolved, onRejected);
    }
    if (this.isRejected) {
      return SyncChain.reject<T>(this.rejected[0]).then(onResolved, onRejected);
    }
    return new SyncChain<U | V>(
      (resolve, reject) => {
        let flatReject: (error?: any) => void;

        const flatResolve = (value?: any) => {

          if (isPromiseLike(value)) {
            const step = value.then(flatResolve, flatReject);
            if (step instanceof SyncChain) {
              step.execute();
            }
            return;
          }
          resolve(onResolved(value));
        };

        flatReject = (error?: any) => {
          if (isPromiseLike(error)) {
            const step = error.then(flatReject, flatReject);
            if (step instanceof SyncChain) {
              step.execute();
            }
            return;
          }
          try {
            resolve(onRejected(error) as any);
          } catch (e) {
            reject(e);
          }
        };

        try {
          this.executor(
            flatResolve,
            flatReject,
          );
        } catch (error) {
          flatReject(error);
        }
      });
      */
  }

  catch<U>(onRejected: (error: any) => U) {
    return this.then(
      undefined,
      onRejected,
    );
  }

  finally(onFinally: () => void) {
    return this.then(
      (value: T) => {
        onFinally();
        return value;
      },
      (error) => {
        onFinally();
        throw error;
      },
    );
  }

  static resolve<T>(value: T | PromiseLike<T>): SyncChain<T>;
  static resolve(): SyncChain<void>;
  static resolve<T>(value?: T | SyncChain<T>) {
    return SyncChain.eager<T>(resolve => resolve(value));
  }

  static reject<T = void>(error?: PromiseLike<any>): SyncChain<T>;
  static reject<T = void>(error?: any): SyncChain<T>;
  static reject<T = void>(error?: any) {
    return SyncChain.eager<T>(() => { throw error; });
  }

  private _onfulfilled: (value?: T) => void = (_value?: T) => { };
  private _onrejected: (error?: any) => void = (_error?: any) => { };
  private _onFulfilledListeners: ((value?: T) => void)[] = [this._onfulfilled];
  private _onRejectedListeners: ((value?: T) => void)[] = [this._onrejected];

  addEventListener(eventName: "fulfilled", listener: (value: T) => void): this;
  addEventListener(eventName: "fulfilled", listener: () => void): this;
  addEventListener(eventName: "rejected", listener: (error?: any) => void): this;
  addEventListener(eventName: "fulfilled" | "rejected", listener: (value?: any) => void) {
    if (eventName === "fulfilled") {
      if (this.isFulfilled) {
        listener(this.value);
      } else if (!this.isSettled) {
        this._onFulfilledListeners.push(listener);
      }
    } else if (eventName === "rejected") {
      if (this.isRejected) {
        listener(this.error);
      } else if (!this.isSettled) {
        this._onRejectedListeners.push(listener);
      }
    }
    return this;
  }

  removeEventListener(eventName: "fulfilled" | "rejected", listener: (value?: any) => void) {
    if (eventName === "fulfilled") {
      const findIndex = this._onFulfilledListeners.findIndex(l => l === listener);
      if (findIndex >= 0) {
        this._onFulfilledListeners.splice(findIndex, 1);
      }
    } else if (eventName === "rejected") {
      const findIndex = this._onRejectedListeners.findIndex(l => l === listener);
      if (findIndex >= 0) {
        this._onRejectedListeners.splice(findIndex, 1);
      }
    }
  }

  get onfulfilled() {
    return this._onfulfilled;
  }

  set onfulfilled(listener: (value?: T) => void) {
    this.removeEventListener("fulfilled", this._onfulfilled);
    this.addEventListener("fulfilled", listener);
    this._onfulfilled = listener;
  }

  get onrejected() {
    return this._onrejected;
  }

  set onrejected(listener: (value?: T) => void) {
    this.removeEventListener("rejected", this._onrejected);
    this.addEventListener("rejected", listener);
    this._onrejected = listener;
  }

  private notifyListeners(resolved: boolean) {
    if (resolved) {
      for (const listener of this._onFulfilledListeners) {
        listener(this.value);
      }
    } else {
      for (const listener of this._onRejectedListeners) {
        listener(this.error);
      }
    }
    this._onFulfilledListeners = [];
    this._onRejectedListeners = [];
  }

  promise() {
    return new Promise((res, rej) => {
      this.addEventListener("fulfilled", res);
      this.addEventListener("rejected", rej);
    });
  }

  static withResolvers<T = any>() {
    let resolve, reject;
    const promise = SyncChain.eager<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return {
      promise,
      reject,
      resolve,
    }
  }

  static try<Args extends any[], F extends (...args: Args) => any>(
    func?: F,
    ...args: Args
  ): SyncChainType<ReturnType<F>>;
  static try<Args extends any[], F extends (...args: Args) => any>(
    func: F = (() => { }) as any,
    ...args: Args
  ) {
    return SyncChain.eager(res => res(func(...args)));
  }

  static defer<Args extends any[], F extends (...args: Args) => any>(
    func?: F,
    ...args: Args
  ): SyncChainType<ReturnType<F>>;
  static defer<Args extends any[], F extends (...args: Args) => any>(
    func: F = (() => { }) as any,
    ...args: Args
  ) {
    return SyncChain.lazy(res => res(func(...args)));
  }

  static all(promises: []): SyncChain<[]>;
  static all<P extends readonly any[]>(promises: P): SyncChain<AllReturnType<P>>;
  static all<P extends readonly any[]>(promiseIterable: P): SyncChain<any> {
    const promises = Array.from(promiseIterable);
    if (promises.length === 0) {
      return SyncChain.resolve([]);
    }
    return new SyncChain<any>((res, rej) => {
      const results: any[] = new Array(promises.length);
      let numSettled = 0;
      for (let i = 0; i < promises.length; ++i) {
        const promise = promises[i];
        const index = i;
        promise.addEventListener("fulfilled", (value: any) => {
          results[index] = value;
          ++numSettled;
          if (numSettled === results.length) {
            res(results);
          }
        });
        promise.addEventListener("rejected", rej);
      }
    });
  }

  static allSettled(promises: []): SyncChain<AllSettledReturnType<SyncChain<void>[]>>;
  static allSettled<P extends readonly any[]>(promises: P): SyncChain<AllSettledReturnType<P>>;
  static allSettled<P extends readonly any[]>(promiseIterable: P): SyncChain<any> {
    const promises = Array.from(promiseIterable);
    if (promises.length === 0) {
      return SyncChain.resolve([]);
    }
    return new SyncChain<any>(res => {
      const results: any[] = (new Array(promises.length));
      let numSettled = 0;
      for (let i = 0; i < promises.length; ++i) {
        const promise = promises[i];
        const index = i;
        promise.addEventListener("fulfilled", (value: any) => {
          results[index] = {
            status: "fulfilled",
            value,
          };
          ++numSettled;
          if (numSettled === results.length) {
            res(results);
          }
        });
        promise.addEventListener("rejected", (reason: any) => {
          results[index] = {
            status: "rejected",
            reason,
          };
          ++numSettled;
          if (numSettled === results.length) {
            res(results);
          }
        });
      }
    });
  }

  static any(promises: []): SyncChain<void>;
  static any<P extends readonly any[]>(promises: P): SyncChain<AnyReturnType<P>>;
  static any<P extends readonly any[]>(promiseIterable: P): SyncChain<any> {
    const promises = Array.from(promiseIterable);
    if (promises.length === 0) {
      return SyncChain.reject(new AggregateError([]));
    }
    return new SyncChain<any>((res, rej) => {
      const reasons: any[] = new Array(promises.length);
      let numSettled = 0;
      for (let i = 0; i < promises.length; ++i) {
        const promise = promises[i];
        const index = i;
        promise.addEventListener("fulfilled", res);
        promise.addEventListener("rejected", (reason: any) => {
          reasons[index] = reason;
          ++numSettled;
          if (numSettled === reasons.length) {
            rej(new AggregateError(reasons));
          }
        });
      }
    });
  }

  static race(promises: []): SyncChain<void>;
  static race<P extends readonly any[]>(promises: P): SyncChain<AnyReturnType<P>>;
  static race<P extends readonly any[]>(promiseIterable: P): SyncChain<any> {
    const promises = Array.from(promiseIterable);
    if (promises.length === 0) {
      throw new Error("SyncChain.any -- input promise list cannot be empty");
    }
    return new SyncChain<any>((res, rej) => {
      for (const promise of promises) {
        promise.addEventListener("fulfilled", res);
        promise.addEventListener("rejected", rej);
      }
    });
  }

}

function isPromiseLike<T = any>(x: any): x is PromiseLike<T> {
  return (typeof x === "object" || typeof x === "function") && typeof x.then === "function";
};

