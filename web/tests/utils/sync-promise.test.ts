import { describe, it, expect } from "vitest"; // Import Vitest functions
import { SyncPromise } from "../../src/utils/sync-promise";

describe("SyncPromise", () => {
  describe(".constructor", () => {
    it("stores value from \"resolve\" in .value", () => {
      const p = new SyncPromise<number>((res) => res(1));
      expect(p.value).toBeUndefined;
      expect(p.valueOr("fallback")).toBe("fallback");
      expect(p.error).toBeUndefined;
      expect(p.errorOr("fallback")).toBe("fallback");
      expect(p.isSettled).toBe(false);
      expect(p.isFulfilled).toBe(false);
      expect(p.isRejected).toBe(false);

      expect(p.execute().value).toBe(1);
      expect(p.valueOr("fallback")).toBe(1);
      expect(p.error).toBeUndefined;
      expect(p.errorOr("fallback")).toBe("fallback");
      expect(p.isSettled).toBe(true);
      expect(p.isFulfilled).toBe(true);
      expect(p.isRejected).toBe(false);
    })

    it("stores value from \"reject\" in .error", () => {
      const p = new SyncPromise((_res, rej) => rej(2));
      expect(p.value).toBeUndefined;
      expect(p.valueOr("fallback")).toBe("fallback");
      expect(p.error).toBeUndefined;
      expect(p.errorOr("fallback")).toBe("fallback");
      expect(p.isSettled).toBe(false);
      expect(p.isFulfilled).toBe(false);
      expect(p.isRejected).toBe(false);

      expect(p.execute().error).toBe(2);
      expect(p.errorOr("fallback")).toBe(2);
      expect(p.value).toBeUndefined;
      expect(p.valueOr("fallback")).toBe("fallback");
      expect(p.isSettled).toBe(true);
      expect(p.isFulfilled).toBe(false);
      expect(p.isRejected).toBe(true);
    })

    it("stores a thrown error in .error", () => {
      const p = new SyncPromise(() => { throw 3; });
      expect(p.execute().error).toBe(3);
    });

    it("stores only the first settled value", () => {
      const p = SyncPromise.lazy<number>((res, rej) => {
        res(1);
        rej(2);
        res(3);
      });
      p.execute();
      expect(p.value).toBe(1);

      const q = SyncPromise.lazy<number>((res, rej) => {
        rej(1);
        res(2);
        rej(3);
      });
      q.execute();
      expect(q.error).toBe(1);
    })

    it("flattens a resolved value that is PromiseLike", () => {
      const p = SyncPromise.lazy<number>(res => {
        res(SyncPromise.lazy(res1 => {
          res1(SyncPromise.lazy(res2 => {
            res2(SyncPromise.lazy(res3 => {
              res3(1);
            }));
          }));
        }));
      });
      expect(p.get()).toBe(1);
    });

    it("flattens a rejection reason that is PromiseLike", () => {
      const p = SyncPromise.lazy((_res, rej) => {
        rej(SyncPromise.lazy(res1 => {
          res1(SyncPromise.lazy(res2 => {
            res2(SyncPromise.lazy(res3 => {
              res3(1);
            }))
          }))
        }))
      });
      expect(p.execute().error).toBe(1);
    });
  });

  describe(".execute", () => {
    it("runs the executor in SyncPromise only once", () => {
      let l = 0;
      const p = new SyncPromise<number>((res) => {
        ++l;
        res(l);
      });
      expect(p.isExecuted).toBe(false);
      p.execute();
      expect(p.isExecuted).toBe(true);
      expect(l).toBe(1);
      p.execute();
      expect(p.isExecuted).toBe(true);
      expect(l).toBe(1);
    })
  });

  describe(".resolve", () => {
    it("fulfills the promise with the given value", () => {
      const p = SyncPromise.resolve("Hello!");
      expect(p.execute().value).toBe("Hello!");
    })

    it("flattens nested SyncPromises", () => {
      const p = SyncPromise.resolve(
        SyncPromise.resolve(
          SyncPromise.resolve(
            SyncPromise.resolve(1)
          )
        )
      );
      expect(p.get()).toBe(1);
    });
  });

  describe(".reject", () => {
    it("rejects the promise with the given error", () => {
      const p = SyncPromise.reject("Goodbye!");
      expect(p.execute().error).toBe("Goodbye!");
    })

    it("flattens nested SyncPromises", () => {
      const p = SyncPromise.reject(
        SyncPromise.resolve(
          SyncPromise.resolve(
            SyncPromise.resolve(1)
          )
        )
      );
      expect(p.execute().error).toBe(1);

      const q = SyncPromise.resolve(
        SyncPromise.reject(
          SyncPromise.resolve(1)
        )
      );
      expect(q.execute().error).toBe(1);

      const r = SyncPromise.reject(
        SyncPromise.reject(
          SyncPromise.reject(
            SyncPromise.reject(1)
          )
        )
      );
      expect(r.execute().error).toBe(1);
    });
  });


  describe(".tryGet", () => {
    it("throws if the promise is rejected", () => {
      const p = SyncPromise.reject("Alert!");
      expect(() => p.tryGet()).toThrow("Alert!");
    });

    it("returns undefined if the promise is not settled", () => {
      const p = new SyncPromise(() => { });
      expect(p.isExecuted).toBe(false);
      p.execute();
      expect(p.isExecuted).toBe(true);
      expect(p.isSettled).toBe(false);
      expect(p.isFulfilled).toBe(false);
      expect(p.isRejected).toBe(false);
      expect(p.tryGetOr(1)).toBe(1);
      expect(p.tryGet()).toBeUndefined;
    });

    it(".tryGet returns the resolved value", () => {
      const p = SyncPromise.resolve(1);
      expect(p.tryGet()).toBe(1);
    });
  });

  describe(".get", () => {
    it(".get throws an error if the promise has not resolved", () => {
      const p = new SyncPromise(() => { });
      expect(() => p.get()).toThrow();

      const q = new SyncPromise(() => { throw 1; });
      expect(() => q.get()).toThrow();
    });

    it(".get returns the resolved value", () => {
      expect(SyncPromise.resolve(1).get()).toBe(1);
    });
  });

  describe(".then", () => {
    it("chains operations", () => {
      const p = SyncPromise.resolve(1)
        .then(x => x + 2)
        .then(x => x * 3);
      expect(p.execute().value).toBe(9);
    })

    it("works on a settled SyncPromise", () => {
      const p = SyncPromise.eager(res => res(1));
      expect(p.value).toBe(1);

      const q = p.then(x => x + 2).then(x => x * 3);
      expect(q.execute().value).toBe(9);

      const r = SyncPromise.eager((_res, rej) => rej(1));
      expect(r.isRejected).toBe(true);

      const s = r.then(() => 1, x => x + 1);
      expect(s.get()).toBe(2);
    });

    it("flattens a resolved value that is a SyncPromise", () => {
      const p = SyncPromise.resolve(SyncPromise.resolve(1))
        .then(x => SyncPromise.resolve(x + 2))
        .then(x => SyncPromise.resolve(x * 3))
      p.execute();
      expect(p.get()).toBe(9);
    });

    it("flattens a rejected value that is a SyncPromise", () => {
      const p = SyncPromise.reject(SyncPromise.resolve(1))
        .catch(x => { throw SyncPromise.resolve(x + 2); })
        .catch(x => SyncPromise.reject(x * 3))
      p.execute();
      expect(p.error).toBe(9);
    });
  });

  describe(".catch", () => {
    it("converts a rejection to a fulfillment", () => {
      const p = SyncPromise.reject(1)
        .catch(error => error);
      expect(p.execute().error).toBeUndefined;
      expect(p.value).toBe(1);

      const q = new SyncPromise<number>(() => {
        throw 5;
      }).then(x => (x + 1).toString())
        .catch(x => x.toString())
      expect(q.execute().error).toBeUndefined;
      expect(q.value).toBe("5");
    })

    it("stores a thrown error in .error", () => {
      const p = SyncPromise.reject(1).catch(() => { throw 2; });
      expect(p.execute().error).toBe(2);
    })

    it("does nothing if the original promise fulfills", () => {
      const p = SyncPromise.resolve(1).catch(() => 2);
      expect(p.get()).toBe(1);
    });
  });

  describe(".finally", () => {
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
        .then(() => 5)
        .catch(x => (x as number) + 10)
        .then(x => { throw x * 2; })
        .catch(x => (x as number) + 11)
      expect(count).toBe(3);
      expect(s.get()).toBe(33);
      expect(count).toBe(4);
    });
  });

  describe(".addEventListener", () => {
    it("executes listeners when a SyncPromise settles in the order that they are added", () => {
      let count = 0;
      const p = SyncPromise.resolve().then(() => { count = 1; });
      p.addEventListener("fulfilled", () => { count += 2; });
      p.addEventListener("fulfilled", () => { count *= 3; });
      expect(count).toBe(0);
      p.execute();
      expect(count).toBe(9);

      count = 0;
      const q = SyncPromise.resolve().then(() => { count = 1; throw "error"; });
      q.addEventListener("rejected", () => { count += 2; });
      q.addEventListener("rejected", () => { count *= 3; });
      expect(count).toBe(0);
      q.execute();
      expect(count).toBe(9);
    });

    it("executes a listener immediately if the promise is already settled", () => {
      let count = 0;
      const p = SyncPromise.resolve().then(() => { ++count; });
      expect(count).toBe(0);
      p.addEventListener("fulfilled", () => { count += 2; });
      expect(count).toBe(0);
      p.execute();
      p.addEventListener("fulfilled", () => { count *= 3; });
      expect(count).toBe(9);

      count = 0;
      const q = SyncPromise.resolve().then(() => { ++count; throw "error"; });
      expect(count).toBe(0);
      q.addEventListener("rejected", () => { count += 2; });
      expect(count).toBe(0);
      q.execute();
      q.addEventListener("rejected", () => { count *= 3; });
      expect(count).toBe(9);
    });
  });

  describe(".onfulfilled", () => {
    it("behaves like calling removeEventListener and addEventListener when assigned to", () => {
      let count = 0;
      let listener: () => void;
      const p = SyncPromise.lazy(res => { count = 1; res(); });
      p.onfulfilled = listener = () => { count += 2; };
      expect(count).toBe(0);
      // This replaces the previous listener before execution.
      p.onfulfilled = listener = () => { count *= 3; };
      expect(count).toBe(0);
      expect(p.onfulfilled).toBe(listener);
      p.execute();
      expect(count).toBe(3);
      expect(p.onfulfilled).toBe(listener);
      // Setting the listener after the promise settles will execute it immediately.
      p.onfulfilled = () => { count += 4; };
      expect(count).toBe(7);
      p.onfulfilled = () => { count *= 5; };
      expect(count).toBe(35);
    })
  });

  describe(".onrejected", () => {
    it("behaves like calling removeEventListener and addEventListener when assigned to", () => {
      let count = 0;
      let listener: () => void;
      const p = SyncPromise.lazy(() => { count = 1; throw "error"; });
      p.onrejected = () => { count += 2; };
      expect(count).toBe(0);
      // This replaces the previous listener before execution.
      p.onrejected = listener = () => { count *= 3; };
      expect(count).toBe(0);
      expect(p.onrejected).toBe(listener);
      p.execute();
      expect(count).toBe(3);
      expect(p.onrejected).toBe(listener);
      // Setting the listener after the promise settles will execute it immediately.
      p.onrejected = () => { count += 4; };
      expect(count).toBe(7);
      p.onrejected = () => { count *= 5; };
      expect(count).toBe(35);
    });
  });

  describe(".wait", () => {
    it("returns a Promise that blocks until the SyncPromise is settled", async () => {
      const { resolve, promise: p } = SyncPromise.withResolvers();
      expect(p.isExecuted).toBe(true);
      expect(p.isSettled).toBe(false);
      setTimeout(() => { resolve(123); }, 50);
      expect(await p.wait()).toBe(123);

      const { reject, promise: q } = SyncPromise.withResolvers();
      expect(q.isExecuted).toBe(true);
      expect(q.isSettled).toBe(false);
      setTimeout(() => reject("err"), 50);
      await expect(q.wait()).rejects.toThrow("err");
    });
  });

  describe(".try", () => {
    it("resolves to the return value of the given function", () => {
      const p = SyncPromise.try(() => 2);
      expect(p.get()).toBe(2);
    })

    it("rejects with the error thrown by the given function", () => {
      const p = SyncPromise.try(() => { throw 3; });
      expect(p.execute().error).toBe(3);
    })
  });

  describe(".withResolvers", () => {
    it("can resolve", () => {
      const { resolve, promise: p } = SyncPromise.withResolvers();
      expect(p.isExecuted).toBe(true);
      expect(p.isSettled).toBe(false);
      resolve("a");
      expect(p.isSettled).toBe(true);
      expect(p.value).toBe("a");
    });

    it("can reject", () => {
      const { reject, promise: p } = SyncPromise.withResolvers();
      expect(p.isExecuted).toBe(true);
      expect(p.isSettled).toBe(false);
      reject("b");
      expect(p.isSettled).toBe(true);
      expect(p.error).toBe("b");
    });
  });

  describe(".all", () => {
    it("resolves to an empty list when the list of promises is empty", () => {
      expect(SyncPromise.all([]).get()).toEqual([]);
    });

    it("resolves when all of the promises resolve", () => {
      const { resolve: res1, promise: p1 } = SyncPromise.withResolvers<number>()
      const { resolve: res2, promise: p2 } = SyncPromise.withResolvers<string>()
      const p = SyncPromise.all([p1, p2]).eager;
      expect(p.isSettled).toBe(false);
      res1(1);
      expect(p.isSettled).toBe(false);
      res2("two");
      expect(p.isFulfilled).toBe(true);
      expect(p.value).toEqual([1, "two"]);
    });

    it("rejects as soon as one of the promises rejects", () => {
      const { resolve: res1, promise: p1 } = SyncPromise.withResolvers<number>()
      const { reject: rej2, promise: p2 } = SyncPromise.withResolvers<void>()
      const { resolve: res3, promise: p3 } = SyncPromise.withResolvers<string>()
      const p = SyncPromise.all([p1, p2, p3]).eager;
      expect(p.isSettled).toBe(false);
      res1(1);
      rej2("error");
      expect(p.isRejected).toBe(true);
      res3("three");
      expect(p.isRejected).toBe(true);
      expect(p.error).toBe("error");
    });

  });

  describe(".allSettled", () => {
    it("resolves to an empty list when the list of promises is empty", () => {
      expect(SyncPromise.allSettled([]).get()).toEqual([]);
    });

    it("resolves when all promises settle", () => {
      const { resolve: res1, promise: p1 } = SyncPromise.withResolvers<number>()
      const { reject: rej2, promise: p2 } = SyncPromise.withResolvers<void>()
      const { resolve: res3, promise: p3 } = SyncPromise.withResolvers<string>()
      const p = SyncPromise.allSettled([p1, p2, p3]).eager;
      expect(p.isSettled).toBe(false);
      res1(1);
      rej2("error");
      expect(p.isSettled).toBe(false);
      res3("three");
      expect(p.isFulfilled).toBe(true);
      expect(p.value).toEqual([
        {
          status: "fulfilled",
          value: 1,
        },
        {
          status: "rejected",
          reason: "error",
        },
        {
          status: "fulfilled",
          value: "three",
        },
      ]);
    });

    it("resolves when all promises settle (2)", () => {
      const { resolve: res1, promise: p1 } = SyncPromise.withResolvers<number>()
      const { reject: rej2, promise: p2 } = SyncPromise.withResolvers<void>()
      const { resolve: res3, promise: p3 } = SyncPromise.withResolvers<string>()
      const p = SyncPromise.allSettled([p1, p2, p3]).eager;
      expect(p.isSettled).toBe(false);
      res1(1);
      res3("three");
      expect(p.isSettled).toBe(false);
      rej2("error");
      expect(p.isFulfilled).toBe(true);
      expect(p.value).toEqual([
        {
          status: "fulfilled",
          value: 1,
        },
        {
          status: "rejected",
          reason: "error",
        },
        {
          status: "fulfilled",
          value: "three",
        },
      ]);
    });

  });

  describe(".race", () => {
    it("throws when the list of promises is empty", () => {
      expect(() => SyncPromise.race([])).toThrow();
    });

    it("resolves as soon as one of the promises resolves", () => {
      const { resolve: res1, promise: p1 } = SyncPromise.withResolvers<number>()
      const { reject: rej2, promise: p2 } = SyncPromise.withResolvers<void>()
      const { resolve: res3, promise: p3 } = SyncPromise.withResolvers<string>()
      const p = SyncPromise.race([p1, p2, p3]).eager;
      expect(p.isSettled).toBe(false);
      res3("three");
      expect(p.isFulfilled).toBe(true);
      rej2("error");
      res1(1);
      expect(p.value).toBe("three");
    });

    it("rejects as soon as one of the promises rejects", () => {
      const { resolve: res1, promise: p1 } = SyncPromise.withResolvers<number>()
      const { reject: rej2, promise: p2 } = SyncPromise.withResolvers<void>()
      const { resolve: res3, promise: p3 } = SyncPromise.withResolvers<string>()
      const p = SyncPromise.race([p1, p2, p3]).eager;
      expect(p.isSettled).toBe(false);
      rej2("error");
      expect(p.isRejected).toBe(true);
      res1(1);
      res3("three");
      expect(p.error).toBe("error");
    });
  });

  describe(".any", () => {
    it("rejects when the list of promises is empty", () => {
      expect(() => SyncPromise.any([]).get()).toThrow();
    });

    it("resolves as soon as one of the promises resolves", () => {
      const { resolve: res1, promise: p1 } = SyncPromise.withResolvers<number>()
      const { reject: rej2, promise: p2 } = SyncPromise.withResolvers<void>()
      const { resolve: res3, promise: p3 } = SyncPromise.withResolvers<string>()
      const p = SyncPromise.any([p1, p2, p3]).eager;
      expect(p.isSettled).toBe(false);
      rej2("error");
      expect(p.isSettled).toBe(false);
      res3("three");
      expect(p.isFulfilled).toBe(true);
      res1(1);
      expect(p.value).toBe("three");
    });

    it("rejects when all of the promises reject", () => {
      const { reject: rej1, promise: p1 } = SyncPromise.withResolvers<void>()
      const { reject: rej2, promise: p2 } = SyncPromise.withResolvers<void>()
      const { reject: rej3, promise: p3 } = SyncPromise.withResolvers<void>()
      const p = SyncPromise.any([p1, p2, p3]).eager;
      expect(p.isSettled).toBe(false);
      rej3("three");
      expect(p.isSettled).toBe(false);
      rej1("one");
      expect(p.isSettled).toBe(false);
      rej2("two");
      expect(p.isRejected).toBe(true);
      expect(p.error.errors).toEqual([
        "one",
        "two",
        "three",
      ]);
    });
  });


})

