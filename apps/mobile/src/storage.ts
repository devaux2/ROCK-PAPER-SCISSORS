/**
 * Pluggable key-value storage. Defaults to in-memory (used by tests);
 * the app root swaps in SecureStore/AsyncStorage at startup.
 */
export interface KVStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const memory = new Map<string, string>();

let impl: KVStorage = {
  async get(key) {
    return memory.get(key) ?? null;
  },
  async set(key, value) {
    memory.set(key, value);
  },
  async remove(key) {
    memory.delete(key);
  },
};

export function setStorageImpl(storage: KVStorage): void {
  impl = storage;
}

export const storage: KVStorage = {
  get: (key) => impl.get(key),
  set: (key, value) => impl.set(key, value),
  remove: (key) => impl.remove(key),
};
