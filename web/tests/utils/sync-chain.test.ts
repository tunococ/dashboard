import { describe, it, expect } from "vitest"; // Import Vitest functions
import { SyncChain } from "../../src/utils/sync-chain";

describe("SyncChain", () => {
  describe(".constructor", () => {
    it("stores value from \"resolve\" in .value", () => {
      const p = SyncChain.lazy<number>((res) => res(1));
      expect(p.value).toBeUndefined;
      expect(p.valueOr("fallback")).toBe("fallback");
      expect(p.error).toBeUndefined;
      expect(p.errorOr("fallback")).toBe("fallback");
      expect(p.isSettled).toBe(false);
      expect(p.isFulfilled).toBe(false);
      expect(p.isRejected).toBe(false);

      expect(p.run().value).toBe(1);
      expect(p.valueOr("fallback")).toBe(1);
      expect(p.error).toBeUndefined;
      expect(p.errorOr("fallback")).toBe("fallback");
      expect(p.isSettled).toBe(true);
      expect(p.isFulfilled).toBe(true);
      expect(p.isRejected).toBe(false);
    })

    it("stores value from \"reject\" in .error", () => {
      const p = SyncChain.lazy((_res, rej) => rej(2));
      expect(p.value).toBeUndefined;
      expect(p.valueOr("fallback")).toBe("fallback");
      expect(p.error).toBeUndefined;
      expect(p.errorOr("fallback")).toBe("fallback");
      expect(p.isSettled).toBe(false);
      expect(p.isFulfilled).toBe(false);
      expect(p.isRejected).toBe(false);

      expect(p.run().error).toBe(2);
      expect(p.errorOr("fallback")).toBe(2);
      expect(p.value).toBeUndefined;
      expect(p.valueOr("fallback")).toBe("fallback");
      expect(p.isSettled).toBe(true);
      expect(p.isFulfilled).toBe(false);
      expect(p.isRejected).toBe(true);
    })

    it("stores a thrown error in .error", () => {
      const p = SyncChain.lazy(() => { throw 3; });
      expect(p.run().error).toBe(3);
    });

    it("stores only the first settled value", () => {
      const p = SyncChain.lazy<number>((res, rej) => {
        res(1);
        rej(2);
        res(3);
      });
      p.run();
      expect(p.value).toBe(1);

      const q = SyncChain.lazy<number>((res, rej) => {
        rej(1);
        res(2);
        rej(3);
      });
      q.run();
      expect(q.error).toBe(1);
    })

    it("flattens a resolved value that is a SyncChain", () => {
      const p = SyncChain.lazy<number>(res => {
        res(SyncChain.lazy(res1 => {
          res1(1);
        }));
      });
      expect(p.get()).toBe(1);
    });

    it("flattens a rejection reason that is a SyncChain", () => {
      const p = SyncChain.lazy((_res, rej) => {
        rej(SyncChain.lazy(res1 => {
          res1(SyncChain.lazy(res2 => {
            res2(SyncChain.lazy(res3 => {
              res3(1);
            }))
          }))
        }))
      });
      expect(p.run().error).toBe(1);
    });

    it("flattens a resolved value that is a Promise", async () => {
      const p = SyncChain.eager<number>(res => {
        res(Promise.resolve(
          Promise.resolve(
            Promise.resolve(1)
          )
        ));
      });
      expect(await p.promise).toBe(1);
    });

    it("flattens a rejected value that is a Promise", async () => {
      const p = SyncChain.eager<number>((_, rej) => {
        rej(Promise.resolve("error"));
      });
      await expect(p.promise).rejects.toThrow("error");
    });
  });

  describe(".execute", () => {
    it("runs the executor in SyncChain only once", () => {
      let l = 0;
      const p = SyncChain.lazy<number>((res) => {
        ++l;
        res(l);
      });
      expect(p.hasStarted).toBe(false);
      p.run();
      expect(p.hasStarted).toBe(true);
      expect(l).toBe(1);
      p.run();
      expect(p.hasStarted).toBe(true);
      expect(l).toBe(1);
    })
  });

  describe(".resolve", () => {
    it("resolves with the given value", () => {
      expect(SyncChain.resolve(undefined).value).toBe(undefined);
      expect(SyncChain.resolve(null).value).toBe(null);
      expect(SyncChain.resolve(1).value).toBe(1);
      expect(SyncChain.resolve(0).value).toBe(0);
      expect(SyncChain.resolve(-0).value).toBe(-0);
      expect(SyncChain.resolve(Infinity).value).toBe(Infinity);
      expect(SyncChain.resolve(-Infinity).value).toBe(-Infinity);
      expect(SyncChain.resolve(NaN).value).toBe(NaN);
      expect(SyncChain.resolve(-NaN).value).toBe(-NaN);
      expect(SyncChain.resolve("").value).toBe("");
      expect(SyncChain.resolve("Hello").value).toBe("Hello");
    })

    it("flattens a nested SyncChain", () => {
      const p = SyncChain.resolve(
        SyncChain.resolve(
          SyncChain.resolve(
            SyncChain.resolve(
              SyncChain.resolve(1)
            )
          )
        )
      );
      expect(p.get()).toBe(1);
    });

    it("rejects a SyncChain that rejects", () => {
      const p = SyncChain.resolve(
        SyncChain.reject("one")
      );
      expect(p.run().error).toBe("one");
    });

    it("flattens a nested Promise", async () => {
      const p = SyncChain.resolve(
        SyncChain.resolve(
          Promise.resolve(1)
        )
      );
      expect(await p.run().promise).toBe(1);
    });

    it("rejects a Promise that rejects", async () => {
      const p = SyncChain.resolve(
        Promise.reject("one")
      );
      await expect(p.run().promise).rejects.toThrow("one");
    });
  });

  describe(".reject", () => {
    it("rejects with the given error", () => {
      const p = SyncChain.reject("Goodbye!");
      expect(p.run().error).toBe("Goodbye!");
    })

    it("flattens a nested SyncChain", () => {
      const p = SyncChain.reject(
        SyncChain.resolve(
          SyncChain.resolve(
            SyncChain.resolve(1)
          )
        )
      );
      expect(p.run().error).toBe(1);

      const q = SyncChain.resolve(
        SyncChain.reject(
          SyncChain.resolve(1)
        )
      );
      expect(q.run().error).toBe(1);

      const r = SyncChain.reject(
        SyncChain.reject(
          SyncChain.reject(
            SyncChain.reject(1)
          )
        )
      );
      expect(r.run().error).toBe(1);
    });

    it("flattens a nested Promise", async () => {
      const p = SyncChain.reject(
        Promise.resolve("one")
      );
      await expect(p.run().promise).rejects.toThrow("one");

      const q = SyncChain.reject(
        Promise.reject("two")
      );
      await expect(q.run().promise).rejects.toThrow("two");
    });
  });


  describe(".tryGet", () => {
    it("throws if the SyncChain is rejected", () => {
      const p = SyncChain.reject("Alert!");
      expect(() => p.tryGet()).toThrow("Alert!");
    });

    it("returns undefined if the SyncChain is not settled", () => {
      const p = SyncChain.lazy(() => { });
      expect(p.hasStarted).toBe(false);
      p.run();
      expect(p.hasStarted).toBe(true);
      expect(p.isSettled).toBe(false);
      expect(p.isFulfilled).toBe(false);
      expect(p.isRejected).toBe(false);
      expect(p.tryGetOr(1)).toBe(1);
      expect(p.tryGet()).toBeUndefined;
    });

    it(".tryGet returns the resolved value", () => {
      const p = SyncChain.resolve(1);
      expect(p.tryGet()).toBe(1);
    });
  });

  describe(".get", () => {
    it("throws an error if the SyncChain has not resolved", () => {
      const p = SyncChain.lazy(() => { });
      expect(() => p.get()).toThrow();

      const q = SyncChain.lazy(() => { throw 1; });
      expect(() => q.get()).toThrow();
    });

    it("returns the resolved value", () => {
      expect(SyncChain.resolve(1).get()).toBe(1);
    });
  });

  describe(".then", () => {
    it("chains operations", () => {
      const p = SyncChain.resolve(1)
        .then(x => x + 2)
        .then(x => x * 3);
      expect(p.run().value).toBe(9);
    })

    it("works on a settled SyncChain", () => {
      const p = SyncChain.eager(res => res(1));
      expect(p.value).toBe(1);

      const q = p.then(x => x + 2).then(x => x * 3);
      expect(q.run().value).toBe(9);

      const r = SyncChain.eager((_res, rej) => rej(1));
      expect(r.isRejected).toBe(true);

      const s = r.then(() => 1, x => x + 1);
      expect(s.get()).toBe(2);
    });

    it("flattens a resolved value that is a SyncChain", () => {
      const p = SyncChain.resolve(SyncChain.resolve(1))
        .then(x => SyncChain.resolve(x + 2))
        .then(x => SyncChain.resolve(x * 3))
      p.run();
      expect(p.get()).toBe(9);
    });

    it("flattens a rejected value that is a SyncChain", () => {
      const p = SyncChain.reject(SyncChain.resolve(1))
        .catch(x => { throw SyncChain.resolve(x + 2); })
        .catch(x => SyncChain.reject(x * 3))
      p.run();
      expect(p.error).toBe(9);
    });

    it("flattens a Promise", async () => {
      const p = SyncChain.resolve(1)
        .then(x => {
          return new Promise<number>(res => {
            setTimeout(() => res(x + 2), 50);
          });
        })
        .then(x => Promise.reject((x as any) * 3))
        .catch(x => x + 4);
      expect(await p.run().promise).toBe(13);
    });

    it("can be called multiple times on the same SyncChain", () => {
      const p = SyncChain.defer();
      const q = p.then(() => 1);
      const r = p.then(() => "two");
      expect(q.isSettled).toBe(false);
      expect(r.isSettled).toBe(false);
      p.run();
      expect(q.get()).toBe(1);
      expect(r.get()).toBe("two");
    });
  });

  describe(".catch", () => {
    it("converts a rejection to a fulfillment", () => {
      const p = SyncChain.reject(1)
        .catch(error => error);
      expect(p.error).toBeUndefined;
      expect(p.value).toBe(1);

      const q = SyncChain.eager<number>(() => {
        throw 5;
      }).then(x => (x + 1).toString())
        .catch(x => x.toString())
      expect(q.error).toBeUndefined;
      expect(q.value).toBe("5");
    })

    it("stores a thrown error in .error", () => {
      const p = SyncChain.reject(1).catch(() => { throw 2; });
      expect(p.run().error).toBe(2);
    })

    it("does nothing if the original promise fulfills", () => {
      const p = SyncChain.resolve(1).catch(() => 2);
      expect(p.get()).toBe(1);
    });
  });

  describe(".finally", () => {
    it(".finally adds an operation without modifying the settled value", () => {
      let count = 0;
      const p = SyncChain.resolve(1).finally(() => { ++count; });
      expect(p.get()).toBe(1);
      expect(count).toBe(1);

      const q = SyncChain.reject(1).finally(() => { ++count; });
      expect(q.run().error).toBe(1);
      expect(count).toBe(2);

      const r = SyncChain.resolve(0).finally(() => { ++count; }).then(x => x + 5);
      expect(r.get()).toBe(5);
      expect(count).toBe(3);

      const s = SyncChain.resolve(0)
        .then(() => { throw 1; })
        .finally(() => { ++count; })
        .then(() => 5)
        .catch(x => (x as number) + 10)
        .then(x => { throw x * 2; })
        .catch(x => (x as number) + 11)
      expect(s.get()).toBe(33);
      expect(count).toBe(4);
    });
  });

  describe(".addEventListener", () => {
    it("executes listeners when a SyncChain settles in the order that they are added", () => {
      let count = 0;
      let d = SyncChain.defer();
      const p = d.then(() => { count = 1; });
      expect(count).toBe(0);
      p.addEventListener("fulfilled", () => { count += 2; });
      expect(count).toBe(0);
      p.addEventListener("fulfilled", () => { count *= 3; });
      expect(count).toBe(0);
      d.run();
      expect(count).toBe(9);

      count = 0;
      d = SyncChain.defer();
      const q = d.then(() => { count = 1; throw "error"; });
      expect(count).toBe(0);
      q.addEventListener("rejected", () => { count += 2; });
      expect(count).toBe(0);
      q.addEventListener("rejected", () => { count *= 3; });
      expect(count).toBe(0);
      d.run();
      expect(count).toBe(9);
    });

    it("executes a listener immediately if the promise is already settled", () => {
      let count = 0;
      const p = SyncChain.try(() => { ++count; });
      p.addEventListener("fulfilled", () => { count += 2; });
      expect(count).toBe(3);
      p.addEventListener("fulfilled", () => { count *= 3; });
      expect(count).toBe(9);

      count = 0;
      const q = SyncChain.resolve().then(() => { ++count; throw "error"; });
      q.addEventListener("rejected", () => { count += 2; });
      expect(count).toBe(3);
      q.addEventListener("rejected", () => { count *= 3; });
      expect(count).toBe(9);
    });

    it("supplies the settled value to the listener", () => {
      let result = 0;
      const p = SyncChain.resolve(1);
      p.addEventListener("fulfilled", value => { result = value; });
      expect(result).toBe(1);
    });
  });

  describe(".onfulfilled", () => {
    it("behaves like calling removeEventListener and addEventListener when assigned to", () => {
      let count = 0;
      let listener: () => void;
      const p = SyncChain.lazy(res => { count = 1; res(); });
      p.onfulfilled = listener = () => { count += 2; };
      expect(count).toBe(0);
      // This replaces the previous listener before execution.
      p.onfulfilled = listener = () => { count *= 3; };
      expect(count).toBe(0);
      expect(p.onfulfilled).toBe(listener);
      p.run();
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
      const p = SyncChain.lazy(() => { count = 1; throw "error"; });
      p.onrejected = () => { count += 2; };
      expect(count).toBe(0);
      // This replaces the previous listener before execution.
      p.onrejected = listener = () => { count *= 3; };
      expect(count).toBe(0);
      expect(p.onrejected).toBe(listener);
      p.run();
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
    it("returns a Promise that blocks until the SyncChain is settled", async () => {
      const { resolve, promise: p } = SyncChain.withResolvers();
      expect(p.hasStarted).toBe(true);
      expect(p.isSettled).toBe(false);
      setTimeout(() => { resolve(123); }, 50);
      expect(await p.promise).toBe(123);

      const { reject, promise: q } = SyncChain.withResolvers();
      expect(q.hasStarted).toBe(true);
      expect(q.isSettled).toBe(false);
      setTimeout(() => reject("err"), 50);
      await expect(q.promise).rejects.toThrow("err");
    });
  });

  describe(".try", () => {
    it("resolves to the return value of the given function", () => {
      expect(SyncChain.try().isSettled).toBe(true);

      const p = SyncChain.try(() => 2);
      expect(p.get()).toBe(2);

      const q = SyncChain.try(x => x, "two");
      expect(q.get()).toBe("two");
    })

    it("rejects with the error thrown by the given function", () => {
      const p = SyncChain.try(() => { throw 3; });
      expect(p.run().error).toBe(3);
    })
  });

  describe(".defer", () => {
    it("resolves to the return value of the given function", () => {
      expect(SyncChain.defer().isSettled).toBe(false);

      const p = SyncChain.defer(() => 2);
      expect(p.get()).toBe(2);

      const q = SyncChain.defer(x => x, "two");
      expect(q.get()).toBe("two");
    })

    it("rejects with the error thrown by the given function", () => {
      const p = SyncChain.defer(() => { throw 3; });
      expect(p.run().error).toBe(3);
    })
  });

  describe(".withResolvers", () => {
    it("can resolve", () => {
      const { resolve, promise: p } = SyncChain.withResolvers();
      expect(p.hasStarted).toBe(true);
      expect(p.isSettled).toBe(false);
      resolve("a");
      expect(p.isSettled).toBe(true);
      expect(p.value).toBe("a");
    });

    it("can reject", () => {
      const { reject, promise: p } = SyncChain.withResolvers();
      expect(p.hasStarted).toBe(true);
      expect(p.isSettled).toBe(false);
      reject("b");
      expect(p.isSettled).toBe(true);
      expect(p.error).toBe("b");
    });
  });

  describe(".all", () => {
    it("resolves to an empty list when the list of PromiseLikes is empty", () => {
      expect(SyncChain.all([]).get()).toEqual([]);
    });

    it("resolves when all of the PromiseLikes resolve", () => {
      const { resolve: res1, promise: p1 } = SyncChain.withResolvers<number>()
      const { resolve: res2, promise: p2 } = SyncChain.withResolvers<string>()
      const p = SyncChain.all([p1, p2]);
      expect(p.isSettled).toBe(false);
      res1(1);
      expect(p.isSettled).toBe(false);
      res2("two");
      expect(p.isFulfilled).toBe(true);
      expect(p.value).toEqual([1, "two"]);
    });

    it("rejects as soon as one of the PromiseLikes rejects", () => {
      const { resolve: res1, promise: p1 } = SyncChain.withResolvers<number>()
      const { reject: rej2, promise: p2 } = SyncChain.withResolvers<void>()
      const { resolve: res3, promise: p3 } = SyncChain.withResolvers<string>()
      const p = SyncChain.all([p1, p2, p3]);
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
    it("resolves to an empty list when the list of PromiseLikes is empty", () => {
      expect(SyncChain.allSettled([]).get()).toEqual([]);
    });

    it("resolves when all PromiseLikes settle", () => {
      const { resolve: res1, promise: p1 } = SyncChain.withResolvers<number>()
      const { reject: rej2, promise: p2 } = SyncChain.withResolvers<void>()
      const { resolve: res3, promise: p3 } = SyncChain.withResolvers<string>()
      const p = SyncChain.allSettled([p1, p2, p3]);
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

    it("resolves when all PromiseLikes settle (2)", () => {
      const { resolve: res1, promise: p1 } = SyncChain.withResolvers<number>()
      const { reject: rej2, promise: p2 } = SyncChain.withResolvers<void>()
      const { resolve: res3, promise: p3 } = SyncChain.withResolvers<string>()
      const p = SyncChain.allSettled([p1, p2, p3]);
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
    it("throws when the list of PromiseLikes is empty", () => {
      expect(() => SyncChain.race([])).toThrow();
    });

    it("resolves as soon as one of the PromiseLikes resolves", () => {
      const { resolve: res1, promise: p1 } = SyncChain.withResolvers<number>()
      const { reject: rej2, promise: p2 } = SyncChain.withResolvers<void>()
      const { resolve: res3, promise: p3 } = SyncChain.withResolvers<string>()
      const p = SyncChain.race([p1, p2, p3]);
      expect(p.isSettled).toBe(false);
      res3("three");
      expect(p.isFulfilled).toBe(true);
      rej2("error");
      res1(1);
      expect(p.value).toBe("three");
    });

    it("rejects as soon as one of the PromiseLikes rejects", () => {
      const { resolve: res1, promise: p1 } = SyncChain.withResolvers<number>()
      const { reject: rej2, promise: p2 } = SyncChain.withResolvers<void>()
      const { resolve: res3, promise: p3 } = SyncChain.withResolvers<string>()
      const p = SyncChain.race([p1, p2, p3]);
      expect(p.isSettled).toBe(false);
      rej2("error");
      expect(p.isRejected).toBe(true);
      res1(1);
      res3("three");
      expect(p.error).toBe("error");
    });
  });

  describe(".any", () => {
    it("rejects when the list of PromiseLikes is empty", () => {
      expect(() => SyncChain.any([]).get()).toThrow();
    });

    it("resolves as soon as one of the PromiseLikes resolves", () => {
      const { resolve: res1, promise: p1 } = SyncChain.withResolvers<number>()
      const { reject: rej2, promise: p2 } = SyncChain.withResolvers<void>()
      const { resolve: res3, promise: p3 } = SyncChain.withResolvers<string>()
      const p = SyncChain.any([p1, p2, p3]);
      expect(p.isSettled).toBe(false);
      rej2("error");
      expect(p.isSettled).toBe(false);
      res3("three");
      expect(p.isFulfilled).toBe(true);
      res1(1);
      expect(p.value).toBe("three");
    });

    it("rejects when all of the PromiseLikes reject", () => {
      const { reject: rej1, promise: p1 } = SyncChain.withResolvers<void>()
      const { reject: rej2, promise: p2 } = SyncChain.withResolvers<void>()
      const { reject: rej3, promise: p3 } = SyncChain.withResolvers<void>()
      const p = SyncChain.any([p1, p2, p3]);
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

  describe("await", () => {
    it("works with an executed SyncChain", async () => {
      expect(await SyncChain.resolve(1).promise).toBe(1);
    });
  })
})

