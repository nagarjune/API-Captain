import { useState, useCallback } from 'react';

export interface CachedResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
  cachedAt: number;
}

interface CacheEntry {
  response: CachedResponse;
  expiresAt: number;
}

interface CacheStore {
  [key: string]: CacheEntry;
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

// Generate a cache key from request parameters
const generateCacheKey = (
  method: string,
  url: string,
  headers: Record<string, string>,
  body: string
): string => {
  const normalized = {
    method: method.toUpperCase(),
    url,
    headers: Object.keys(headers)
      .sort()
      .reduce((acc, key) => {
        acc[key.toLowerCase()] = headers[key];
        return acc;
      }, {} as Record<string, string>),
    body,
  };
  return btoa(JSON.stringify(normalized));
};

export function useRequestCache(ttl: number = DEFAULT_TTL) {
  const [cache, setCache] = useState<CacheStore>({});
  const [cacheEnabled, setCacheEnabled] = useState(true);

  const getCached = useCallback(
    (
      method: string,
      url: string,
      headers: Record<string, string>,
      body: string
    ): CachedResponse | null => {
      if (!cacheEnabled) return null;

      const key = generateCacheKey(method, url, headers, body);
      const entry = cache[key];

      if (!entry) return null;

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        // Remove expired entry
        setCache((prev) => {
          const updated = { ...prev };
          delete updated[key];
          return updated;
        });
        return null;
      }

      return entry.response;
    },
    [cache, cacheEnabled]
  );

  const setCached = useCallback(
    (
      method: string,
      url: string,
      headers: Record<string, string>,
      body: string,
      response: Omit<CachedResponse, 'cachedAt'>
    ) => {
      if (!cacheEnabled) return;

      const key = generateCacheKey(method, url, headers, body);
      const cachedResponse: CachedResponse = {
        ...response,
        cachedAt: Date.now(),
      };

      setCache((prev) => ({
        ...prev,
        [key]: {
          response: cachedResponse,
          expiresAt: Date.now() + ttl,
        },
      }));
    },
    [cacheEnabled, ttl]
  );

  const clearCache = useCallback(() => {
    setCache({});
  }, []);

  const getCacheSize = useCallback(() => {
    return Object.keys(cache).length;
  }, [cache]);

  const removeCacheEntry = useCallback(
    (method: string, url: string, headers: Record<string, string>, body: string) => {
      const key = generateCacheKey(method, url, headers, body);
      setCache((prev) => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    },
    []
  );

  return {
    getCached,
    setCached,
    clearCache,
    getCacheSize,
    removeCacheEntry,
    cacheEnabled,
    setCacheEnabled,
  };
}
