export type ResourceIteratee<T> = (each: T) => Promise<void> | void;
