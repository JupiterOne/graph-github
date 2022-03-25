import {
  BaseQueryState,
  BuildQuery,
  ProcessResponse,
  RateLimitStepSummary,
} from './types';
import { ResourceIteratee } from '../../client';
import { QueryExecutor } from './CreateQueryExecutor';

export const MAX_REQUESTS_LIMIT = 100;
export const MAX_SEARCH_LIMIT = 25;

async function paginate<P, Q extends BaseQueryState, I>(
  queryParams: P,
  iteratee: ResourceIteratee<I>,
  execute: QueryExecutor,
  buildQuery: BuildQuery<P, Q>,
  processResponseData: ProcessResponse<I, Q>,
  isPaginationComplete: (
    queryState: Q | null | undefined,
    resourceFetchCount: number,
  ) => boolean,
): Promise<RateLimitStepSummary> {
  let resourceFetchCount = 0;
  let queryCost = 0;
  let queryState: Q | undefined = undefined;
  let paginationComplete = false;

  const countIteratee = async (resource) => {
    resourceFetchCount++;
    await iteratee(resource);
  };

  while (!paginationComplete) {
    const executable = buildQuery(queryParams, queryState);

    const response = await execute(executable);

    queryState = await processResponseData(response, countIteratee);

    queryCost += queryState?.rateLimit?.cost ?? 0;

    paginationComplete = isPaginationComplete(queryState, resourceFetchCount);
  }

  return {
    totalCost: queryCost,
    limit: queryState?.rateLimit?.limit,
    remaining: queryState?.rateLimit?.remaining,
    resetAt: queryState?.rateLimit?.resetAt,
  };
}

export default paginate;
