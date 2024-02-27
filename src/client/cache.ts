const cache: Record<string, unknown> = {};

export async function getFromCache<T>(
  key: string,
  actualFn: () => Promise<T>,
): Promise<T> {
  if (cache[key]) {
    return cache[key] as T;
  }

  const value = await actualFn();
  cache[key] = value;
  return value as T;
}

export function getFromCacheSync<T>(key: string, actualFn: () => T): T {
  if (cache[key]) {
    return cache[key] as T;
  }

  const value = actualFn();
  cache[key] = value;
  return value as T;
}
