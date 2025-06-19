import { describe, it, expect } from "vitest"; // Import Vitest functions
import { SyncPromise } from "../../src/utils/sync-promise";

describe("SyncPromise", () => {
  it("constructor's resolve call stores value in .value", () => {
    const p = new SyncPromise((res) => res(1));
    expect(p.value).toBeUndefined;
    expect(p.valueOr("fallback")).toBe("fallback");
    expect(p.error).toBeUndefined;
    expect(p.errorOr("fallback")).toBe("fallback");
    expect(p.isSettled()).toBe(false);
    expect(p.isResolved()).toBe(false);
    expect(p.isRejected()).toBe(false);

    expect(p.execute().value).toBe(1);
    expect(p.valueOr("fallback")).toBe(1);
    expect(p.error).toBeUndefined;
    expect(p.errorOr("fallback")).toBe("fallback");
    expect(p.isSettled()).toBe(true);
    expect(p.isResolved()).toBe(true);
    expect(p.isRejected()).toBe(false);
  })

  it("constructor's reject call stores value in .error", () => {
    const p = new SyncPromise((res, rej) => rej(2));
    expect(p.value).toBeUndefined;
    expect(p.valueOr("fallback")).toBe("fallback");
    expect(p.error).toBeUndefined;
    expect(p.errorOr("fallback")).toBe("fallback");
    expect(p.isSettled()).toBe(false);
    expect(p.isResolved()).toBe(false);
    expect(p.isRejected()).toBe(false);

    expect(p.execute().error).toBe(2);
    expect(p.errorOr("fallback")).toBe(2);
    expect(p.value).toBeUndefined;
    expect(p.valueOr("fallback")).toBe("fallback");
    expect(p.isSettled()).toBe(true);
    expect(p.isResolved()).toBe(false);
    expect(p.isRejected()).toBe(true);
  })

  it("error during construction is stored in .error", () => {
    const p = new SyncPromise(() => { throw 3; });
    expect(p.execute().error).toBe(3);
  })

  it("settled SyncPromise cannot change its state", () => {
    const p = new SyncPromise((res, rej) => {
      res(1); rej(2); res(3);
    });
    p.execute();
    expect(p.value).toBe(1);

    const q = new SyncPromise((res, rej) => {
      rej(1);
      res(2);
      rej(3);
    });
    q.execute();
    expect(q.error).toBe(1);
  })

  it(".execute runs the task only once", () => {
    let l = 0;
    const p = new SyncPromise((res) => {
      ++l;
      res(l);
    });
    expect(p.isExecuted()).toBe(false);
    p.execute();
    expect(p.isExecuted()).toBe(true);
    expect(l).toBe(1);
    p.execute();
    expect(p.isExecuted()).toBe(true);
    expect(l).toBe(1);
  })

  it("SyncPromise.resolve settles the promise with given value", () => {
    const p = SyncPromise.resolve("Hello!");
    expect(p.execute().value).toBe("Hello!");
  })

  it("SyncPromise.reject settles the promise with the given error", () => {
    const p = SyncPromise.reject("Goodbye!");
    expect(p.execute().error).toBe("Goodbye!");
  })

  it(".tryGet throws if the promise is rejected", () => {
    const p = SyncPromise.reject("Alert!");
    expect(() => p.tryGet()).toThrow("Alert!");
  });

  it(".tryGet returns undefined if the promise is not settled", () => {
    const p = new SyncPromise(() => { });
    expect(p.isExecuted()).toBe(false);
    p.execute();
    expect(p.isExecuted()).toBe(true);
    expect(p.isSettled()).toBe(false);
    expect(p.isResolved()).toBe(false);
    expect(p.isRejected()).toBe(false);
    expect(p.tryGetOr(1)).toBe(1);
    expect(p.tryGet()).toBeUndefined;
  });

  it(".tryGet returns the resolved value", () => {
    const p = SyncPromise.resolve(1);
    expect(p.tryGet()).toBe(1);
  });

  it(".get throws an error if the promise has not resolved", () => {
    const p = new SyncPromise(() => { });
    expect(() => p.get()).toThrow();

    const q = new SyncPromise(() => { throw 1; });
    expect(() => q.get()).toThrow();
  });

  it(".get returns the resolved value", () => {
    expect(SyncPromise.resolve(1).get()).toBe(1);
  });

  it(".then can chain operations", () => {
    const p = SyncPromise.resolve(1)
      .then(x => x + 2)
      .then(x => x * 3);
    expect(p.execute().value).toBe(9);
  })

  it(".catch can convert rejection to resolution", () => {
    const p = SyncPromise.reject(1)
      .catch(error => error);
    expect(p.execute().error).toBeUndefined;
    expect(p.value).toBe(1);

    const q = new SyncPromise<number>((res, rej) => {
      throw 5;
    }).then(x => (x + 1).toString())
      .catch(x => x.toString())
    expect(q.execute().error).toBeUndefined;
    expect(q.value).toBe("5");
  })

  it("error thrown inside .catch will be stored in .error", () => {
    const p = SyncPromise.reject(1).catch(() => { throw 2; });
    expect(p.execute().error).toBe(2);
  })

  it(".finally adds an operation without modifying the settled value", () => {
    let count = 0;
    const p = SyncPromise.resolve(1).finally(() => { ++count; });
    expect(count).toBe(0);
    expect(p.get()).toBe(1);
    expect(count).toBe(1);

    const q = SyncPromise.reject(1).finally(() => { ++count; });
    expect(count).toBe(1);
    expect(q.execute().error).toBe(1);
    expect(count).toBe(2);

    const r = SyncPromise.resolve(0).finally(() => { ++count; }).then(x => x + 5);
    expect(count).toBe(2);
    expect(r.get()).toBe(5);
    expect(count).toBe(3);

    const s = SyncPromise.resolve(0)
      .then(() => { throw 1; })
      .finally(() => { ++count; })
      .then(x => x + 5)
      .catch(x => (x as number) + 10)
      .then(x => { throw x * 2; })
      .catch(x => (x as number) + 11)
    expect(count).toBe(3);
    expect(s.get()).toBe(33);
    expect(count).toBe(4);
  });

  it(".try resolves to the return value of the given function", () => {
    const p = SyncPromise.try(() => 2);
    expect(p.get()).toBe(2);
  })

  it(".try rejects with the error thrown by the given function", () => {
    const p = SyncPromise.try(() => { throw 3; });
    expect(p.execute().error).toBe(3);
  })

  it(".withResolvers can resolve", () => {
    const { resolve, promise: p } = SyncPromise.withResolvers();
    expect(p.isExecuted()).toBe(true);
    expect(p.isSettled()).toBe(false);
    resolve("a");
    expect(p.isSettled()).toBe(true);
    expect(p.value).toBe("a");
  });

  it(".withResolvers can reject", () => {
    const { reject, promise: p } = SyncPromise.withResolvers();
    expect(p.isExecuted()).toBe(true);
    expect(p.isSettled()).toBe(false);
    reject("b");
    expect(p.isSettled()).toBe(true);
    expect(p.error).toBe("b");
  });

  it(".poll blocks until the promise is settled", async () => {
    const { resolve, promise: p } = SyncPromise.withResolvers();
    expect(p.isExecuted()).toBe(true);
    expect(p.isSettled()).toBe(false);
    setTimeout(() => resolve(123), 50);
    expect(await p.poll(5)).toBe(123);

    const { reject, promise: q } = SyncPromise.withResolvers();
    expect(q.isExecuted()).toBe(true);
    expect(q.isSettled()).toBe(false);
    setTimeout(() => reject("err"), 50);
    await expect(q.poll(5)).rejects.toThrow("err");

  });
})


