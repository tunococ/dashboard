import { SyncChain } from "../utils/sync-chain";

export function requestChain(request: IDBOpenDBRequest, onupgradeneeded?: (db: IDBDatabase) => void): SyncChain<IDBDatabase>;
export function requestChain(request: IDBRequest): SyncChain<any>;
export function requestChain(
  request: IDBRequest,
  onupgradeneeded?: (db: IDBDatabase) => void,
) {
  return SyncChain.eager((res, rej) => {
    request.onsuccess = () => {
      res(request.result);
    };
    request.onerror = () => {
      rej(request.error);
    };
    if (onupgradeneeded) {
      (request as IDBOpenDBRequest).onupgradeneeded = () => {
        onupgradeneeded(request.result as IDBDatabase);
      }
    }
  })
}

export function idbDatabase(
  dbName: string,
  version?: number,
  onupgradeneeded?: (db: IDBDatabase) => void,
): SyncChain<IDBDatabase> {
  return requestChain(indexedDB.open(dbName, version), onupgradeneeded);
}

export function idbTransaction(
  db: IDBDatabase,
  storeNames: string[],
  mode: "readwrite" | "readonly" = "readonly",
): [IDBTransaction, SyncChain<Event>] {
  const { promise: committed, resolve, reject } = SyncChain.withResolvers();
  const transaction = db.transaction(storeNames, mode);
  transaction.oncomplete = (event: Event) => resolve(event);
  transaction.onabort = (event: Event) => reject(event);
  transaction.onerror = (event: Event) => reject(event);
  return [transaction, committed!];
}

