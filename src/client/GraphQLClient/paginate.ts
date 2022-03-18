import {
  BaseQueryState,
  BuildQuery,
  GithubQueryResponse,
  ProcessResponse,
} from './types';
import { ResourceIteratee } from '../../client';
import { QueryExecutor } from './CreateQueryExecutor';

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
): Promise<GithubQueryResponse> {
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
    rateLimitConsumed: queryCost,
  };
}

export default paginate;
