type StorageKey = "localStorage" | "sessionStorage";

const STORAGE_KEYS: StorageKey[] = ["localStorage", "sessionStorage"];

const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
};

const isStorageLike = (value: unknown): value is Storage => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    typeof (value as Storage).getItem === "function" &&
    typeof (value as Storage).setItem === "function" &&
    typeof (value as Storage).removeItem === "function" &&
    typeof (value as Storage).clear === "function"
  );
};

const ensureStorage = (key: StorageKey) => {
  const current = window[key];

  if (isStorageLike(current)) {
    return current;
  }

  const fallback = createMemoryStorage();
  Object.defineProperty(window, key, {
    configurable: true,
    writable: true,
    value: fallback,
  });
  return fallback;
};

export const resetBrowserStorageMocks = () => {
  if (typeof window === "undefined") {
    return;
  }

  for (const key of STORAGE_KEYS) {
    const storage = ensureStorage(key);
    storage.clear();
  }
};

