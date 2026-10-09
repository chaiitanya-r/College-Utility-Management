
import { isRateLimitError } from "./apiError";

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const rateLimitUntil = new Map<string, number>();

const DEFAULT_TTL_MS = 30_000;
const RATE_LIMIT_COOLDOWN_MS = 15_000;

export function invalidateRequestCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    inflight.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
}

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  const now = Date.now();

  const cooldown = rateLimitUntil.get(key);
  if (cooldown && cooldown > now) {
    const hit = cache.get(key) as CacheEntry<T> | undefined;
    if (hit) return hit.data;
    throw new Error("Too many requests. Please wait a moment and try again.");
  }

  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > now) {
    return hit.data;
  }

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = fetcher()
    .then((data) => {
      rateLimitUntil.delete(key);
      cache.set(key, { data, expiresAt: Date.now() + ttlMs });
      return data;
    })
    .catch((err) => {
      if (isRateLimitError(err)) {
        rateLimitUntil.set(key, Date.now() + RATE_LIMIT_COOLDOWN_MS);
      }
      throw err;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}
