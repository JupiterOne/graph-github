import { ResourceIteratee } from '../../../client';
import { ExecutableQuery, QueryExecutor } from '../CreateQueryExecutor';
import { IntegrationLogger } from '@jupiterone/integration-sdk-core';

export type CursorState = {
  hasNextPage?: boolean;
  endCursor?: string;
};

export type InnerResourceQuery<T> = (each: T) => void;

export type IteratePagination<P, I> = (
  queryParams: P,
  execute: QueryExecutor,
  iteratee: ResourceIteratee<I>,
  logger?: IntegrationLogger,
) => Promise<RateLimitStepSummary>;

export type RateLimitStepSummary = {
  totalCost: number;
  limit?: number;
  remaining?: number;
  resetAt?: string;
};

export type BuildQuery<P, S extends BaseQueryState> = (
  queryParams: P,
  queryState?: S,
) => ExecutableQuery;

export type ProcessResponse<I, Q> = (
  data: any,
  iteratee: ResourceIteratee<I>,
) => Promise<Q>;

export type ProcessedData<S extends BaseQueryState> = {
  resource;
  queryState: S;
};

export interface BaseQueryState {
  rateLimit?: {
    limit: number;
    cost: number;
    remaining: number;
    resetAt: string;
  };
}
