import {
  BaseQueryState,
  BuildQuery,
  ProcessResponse,
  PullRequestResponse,
} from '../types';
import { MAX_REQUESTS_LIMIT } from '../paginate';
import utils from '../utils';
import fragments from '../fragments';
import { pullRequestFields } from './shared';

type QueryState = BaseQueryState;

type QueryParams = {
  repoIds: string[];
  ingestStartDatetime: string;
};

const buildQuery: BuildQuery<QueryParams, QueryState> = (
  queryParams,
  queryState,
) => {
  const query = `
    query (
      $repoIds: [ID!]!
      $maxLimit: Int!
    ) {
      nodes(ids: $repoIds) {
        ...on Repository {
          id
          pullRequests(first: $maxLimit) {
            nodes {
              ${pullRequestFields(true)}
            }
          }
        }
      }
      ...${fragments.rateLimit}
    }`;

  return {
    query,
    ...(queryState?.rateLimit && {
      rateLimit: queryState.rateLimit,
    }),
    queryVariables: {
      repoIds: queryParams.repoIds,
      maxLimit: MAX_REQUESTS_LIMIT,
    },
  };
};

const processResponseData: ProcessResponse<
  PullRequestResponse,
  QueryState
> = async (responseData, iteratee) => {
  if (!responseData) {
    throw new Error('responseData param is required.');
  }

  const rateLimit = responseData.rateLimit;
  const repositories = responseData.nodes ?? [];

  for (const repository of repositories) {
    const pullRequests = repository.pullRequests?.nodes ?? [];
    for (const pullRequest of pullRequests) {
      if (!utils.hasProperties(pullRequest)) {
        // If there's no data, pass - possible if permissions aren't correct in GHE
        continue;
      }

      await iteratee(utils.responseToResource(pullRequest));
    }
  }

  return {
    rateLimit,
  };
};

/**
 * Paginates over the pull requests found on the specified repos.
 * @param queryParams
 * @param execute
 * @param iteratee
 */
const iteratePullRequests = async (
  queryParams: QueryParams,
  execute,
  iteratee,
) => {
  let queryState: QueryState = {};
  const executable = buildQuery(queryParams, queryState);
  const response = await execute(executable);
  const filterIteratee = async (pullRequest: PullRequestResponse) => {
    if (
      new Date(pullRequest.updatedAt) >=
      new Date(queryParams.ingestStartDatetime)
    ) {
      await iteratee(pullRequest);
    }
  };
  queryState = await processResponseData(response, filterIteratee);

  const queryCost = queryState?.rateLimit?.cost ?? 0;

  return {
    totalCost: queryCost,
    limit: queryState?.rateLimit?.limit,
    remaining: queryState?.rateLimit?.remaining,
    resetAt: queryState?.rateLimit?.resetAt,
  };
};

export default { iteratePullRequests };
