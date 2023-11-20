import {
  BaseQueryState,
  BuildQuery,
  ProcessResponse,
  RateLimitStepSummary,
} from './types';
import { ResourceIteratee } from '../../client';
import { QueryExecutor } from './CreateQueryExecutor';
import { buildTimeoutHandler } from './timeoutHandler';
import { IntegrationLogger } from '@jupiterone/integration-sdk-core';

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
  logger?: IntegrationLogger,
  maxLimitKey?: keyof P,
): Promise<RateLimitStepSummary> {
  let resourceFetchCount = 0;
  let queryCost = 0;
  let queryState: Q | undefined = undefined;
  let paginationComplete = false;

  const countIteratee: ResourceIteratee<I> = async (resource) => {
    resourceFetchCount++;
    await iteratee(resource);
  };

  let withTimeoutHandler: ReturnType<typeof buildTimeoutHandler> | undefined;
  if (maxLimitKey) {
    withTimeoutHandler = buildTimeoutHandler({
      queryParams,
      maxLimitKey,
      logger,
    });
  }

  while (!paginationComplete) {
    const executable = buildQuery(queryParams, queryState);

    let response: any;
    if (withTimeoutHandler) {
      const result = await withTimeoutHandler(() => execute(executable));
      if (result.retry) {
        continue;
      }
      response = result.response;
    } else {
      response = await execute(executable);
    }

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
