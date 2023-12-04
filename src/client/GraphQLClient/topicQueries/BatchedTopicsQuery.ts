import {
  BaseQueryState,
  BuildQuery,
  ProcessResponse,
  TopicQueryResponse,
} from '../types';
import { MAX_REQUESTS_LIMIT } from '../paginate';
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
          repositoryTopics(first: $maxLimit) {
            nodes {
              topic {
                id
                name
              }
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
  TopicQueryResponse,
  QueryState
> = async (responseData, iteratee) => {
  const rateLimit = responseData.rateLimit;
  const repositories = responseData?.nodes ?? [];

  for (const repository of repositories) {
    const topics = repository?.repositoryTopics?.nodes ?? [];

    for (const topic of topics.map((t) => t.topic)) {
      if (!utils.hasProperties(topic)) {
        continue;
      }

      await iteratee({
        repoId: repository.id,
        ...topic,
      });
    }
  }

  return {
    rateLimit,
  };
};

/**
 * Iterates over topics found in a repository
 * @param queryParams
 * @param execute
 * @param iteratee
 */
const iterateTopics = async (queryParams: QueryParams, execute, iteratee) => {
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

export default { iterateTopics };
