const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 100;

export interface CachedStoreOptions {
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
}

export interface CachedStore<T> {
  get(key: string, load: () => Promise<T>): Promise<T>;
  clear(): void;
}

export function createCachedStore<T>(options: CachedStoreOptions = {}): CachedStore<T> {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const now = options.now ?? Date.now;

  const entries = new Map<string, { data: T; expiresAt: number }>();
  const inFlight = new Map<string, Promise<T>>();

  function prune(current: number): void {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= current) entries.delete(key);
    }

    while (entries.size >= maxEntries) {
      const oldestKey = entries.keys().next().value as string | undefined;
      if (!oldestKey) break;
      entries.delete(oldestKey);
    }
  }

  async function get(key: string, load: () => Promise<T>): Promise<T> {
    const current = now();
    const cached = entries.get(key);

    if (cached && cached.expiresAt > current) return cached.data;
    if (cached) entries.delete(key);

    const existing = inFlight.get(key);
    if (existing) return existing;

    const request = load()
      .then((data) => {
        prune(now());
        entries.set(key, { data, expiresAt: now() + ttlMs });
        return data;
      })
      .finally(() => inFlight.delete(key));

    inFlight.set(key, request);
    return request;
  }

  function clear(): void {
    entries.clear();
    inFlight.clear();
  }

  return { get, clear };
}
