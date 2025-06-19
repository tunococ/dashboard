export class SyncPromise<T> {
  executor: (resolve: (value: T) => void, reject: (error: any) => void) => void;

  constructor(
    executor: (resolve: (value: T) => void, reject: (error: any) => void) => void,
  ) {
    this.executor = executor;
    this.resolved = [];
    this.rejected = [];
  }

  private resolved: T[] = [];
  private rejected: any[] = [];
  private executed: boolean = false;
  private settled: boolean = false;

  private _resolve = (value: T) => {
    if (!this.settled && this.resolved.length === 0) {
      this.resolved.push(value);
      this.settled = true;
    }
  }

  private _reject = (error: any) => {
    if (!this.settled && this.rejected.length === 0) {
      this.rejected.push(error);
      this.settled = true;
    }
  }

  execute() {
    if (!this.executed) {
      this.executed = true;
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

  isExecuted() {
    return this.executed;
  }

  isSettled() {
    return this.settled;
  }

  isResolved() {
    return this.resolved.length > 0;
  }

  isRejected() {
    return this.rejected.length > 0;
  }

  get value() {
    return this.valueOr(undefined);
  }

  valueOr<U>(fallback: U) {
    return this.isResolved() ? this.resolved[0] : fallback;
  }

  get error() {
    return this.errorOr(undefined);
  }

  errorOr(fallback: any) {
    return this.isRejected() ? this.rejected[0] : fallback;
  }

  tryGet() {
    return this.tryGetOr(undefined);
  }

  tryGetOr<U>(fallback?: U) {
    this.execute();
    if (!this.settled) {
      return fallback;
    }
    if (this.isRejected()) {
      throw this.error;
    }
    return this.value;
  }

  get(): T {
    this.execute();
    if (!this.settled) {
      throw new Error("SyncPromise.get called on a promise that is not settled");
    }
    if (this.isRejected()) {
      throw this.error;
    }
    return this.value!;
  }

  then<U>(
    onResolved: (value: T) => U,
  ): SyncPromise<U>;
  then<U, V = U>(
    onResolved: (value: T) => U,
    onRejected: (error: any) => V,
  ): SyncPromise<U | V>;
  then<U, V = U>(
    onResolved: (value: T) => U,
    onRejected: (error: any) => V = (error: any) => { throw error; },
  ) {
    return new SyncPromise<U | V>(
      (resolve: (value: U | V) => void, reject: (error: any) => void) => {
        try {
          this.executor(
            (value: T) => {
              resolve(onResolved(value));
            },
            (error: any) => {
              try {
                resolve(onRejected(error));
              } catch (e) {
                reject(e);
              }
            },
          );
        } catch (error) {
          try {
            resolve(onRejected(error));
          } catch (e) {
            reject(e);
          }
        }
      });
  }

  catch<U>(onRejected: (error: any) => U) {
    return this.then(
      (value: T) => value,
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

  static resolve<T>(value: T) {
    return new SyncPromise<T>(resolve => resolve(value));
  }

  static reject<T = undefined>(error: any) {
    return new SyncPromise<T>(() => { throw error; });
  }

  static withResolvers<T>() {
    let resolve, reject;
    const promise = new SyncPromise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    promise.execute();
    return {
      promise,
      reject,
      resolve,
    }
  }

  static try<T, Args extends []>(func: (...args: Args) => T, ...args: Args) {
    return new SyncPromise<T>(res => res(func(...args)));
  }

  poll(periodMs: number = 50) {
    return (async () => {
      this.execute();
      while (!this.isSettled()) {
        await new Promise(cont => setTimeout(cont, periodMs));
      }
      return this.get();
    })();
  }
}

