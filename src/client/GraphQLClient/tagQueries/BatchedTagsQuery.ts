import { MAX_REQUESTS_LIMIT } from '../paginate';
import {
  BaseQueryState,
  BuildQuery,
  ProcessResponse,
  TagQueryResponse,
} from '../types';
import utils from '../utils';

type QueryState = BaseQueryState;

export interface QueryParams {
  repoIds: string[];
}

const buildQuery: BuildQuery<QueryParams, QueryState> = (
  queryParams,
  queryState,
) => {
  const query = `
    query (
      $repoIds: [ID!]!,
      $maxLimit: Int!
    ) {
      nodes(ids: $repoIds) {
        ...on Repository {
          id
          refs(first: $maxLimit, refPrefix: "refs/tags/") {
            nodes {
              id
              name
            }
          }
        }
      }
    }`;

  return {
    query,
    ...(queryState?.rateLimit && {
      rateLimit: queryState.rateLimit,
    }),
    queryVariables: {
      ...queryParams,
      maxLimit: MAX_REQUESTS_LIMIT,
    },
  };
};

const processResponseData: ProcessResponse<
  TagQueryResponse,
  QueryState
> = async (responseData, iteratee) => {
  const rateLimit = responseData.rateLimit;
  const repositories = responseData?.nodes ?? [];

  for (const repository of repositories) {
    const tags = repository?.refs?.nodes ?? [];
    for (const tag of tags) {
      if (!utils.hasProperties(tag)) {
        continue;
      }

      await iteratee({
        repoId: repository.id,
        ...tag,
      });
    }
  }

  return {
    rateLimit,
  };
};

/**
 * Iterates over teams found within an organization
 * @param login aka organization
 * @param execute
 * @param iteratee
 */
const iterateTags = async (queryParams: QueryParams, execute, iteratee) => {
  let queryState: QueryState = {};
  const executable = buildQuery(queryParams, queryState);
  const response = await execute(executable);
  queryState = await processResponseData(response, iteratee);

  const queryCost = queryState?.rateLimit?.cost ?? 0;

  return {
    totalCost: queryCost,
    limit: queryState?.rateLimit?.limit,
    remaining: queryState?.rateLimit?.remaining,
    resetAt: queryState?.rateLimit?.resetAt,
  };
};

export default { iterateTags };
