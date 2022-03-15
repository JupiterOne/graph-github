import { ResourceIteratee } from '../../../client';
import { ExecutableQuery, QueryExecutor } from '../CreateQueryExecutor';
import { GithubQueryResponse } from './client';

export type CursorState = {
  hasNextPage?: boolean;
  endCursor?: string;
};

export type InnerResourceQuery<T> = (each: T) => void;

export type IteratePagination<P, I> = (
  queryParams: P,
  iteratee: ResourceIteratee<I>,
  execute: QueryExecutor,
) => Promise<GithubQueryResponse>;

export type BuildQuery<P, S extends BaseQueryState> = (
  queryParams: P,
  queryState?: S,
) => ExecutableQuery;

export type ProcessedData<Q> = {
  resource;
  queryState: Q;
};

export interface BaseQueryState {
  rateLimit?: {
    limit: number;
    cost: number;
    remaining: number;
    resetAt: string;
  };
}
