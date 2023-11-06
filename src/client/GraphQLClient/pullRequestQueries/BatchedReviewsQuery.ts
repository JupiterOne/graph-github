import { BaseQueryState, BuildQuery, Review, ProcessResponse } from '../types';
import { ExecutableQuery } from '../CreateQueryExecutor';
import { MAX_SEARCH_LIMIT } from '../paginate';
import utils from '../utils';
import fragments from '../fragments';

type QueryState = BaseQueryState;

type QueryParams = {
  pullRequestIds: string[];
};

/**
 * Builds query for searching for applicable Reviews.
 * Pagination is handled at the root level but not
 * currently for inner resources.
 *
 * @param queryParams
 * @param queryState
 */
const buildQuery: BuildQuery<QueryParams, QueryState> = (
  queryParams,
  queryState,
): ExecutableQuery => {
  const query = `
    query (
      $pullRequestIds: [ID!]!,
      $maxLimit: Int!
    ) {
      nodes(ids: $pullRequestIds) {
        ...on PullRequest {
          id
          reviews(first: $maxLimit) {
            nodes {
              ...on PullRequestReview {
                commit {
                  oid
                }
                author {
                  ...on User {
                      name
                      login
                    }
                }
                state
              }
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
      pullRequestIds: queryParams.pullRequestIds,
      maxLimit: MAX_SEARCH_LIMIT,
    },
  };
};

/**
 * Processes response data into a resource object
 * ready to be passed to the iterator.
 * @param responseData
 * @param iteratee
 */
const processResponseData: ProcessResponse<Review, QueryState> = async (
  responseData,
  iteratee,
) => {
  if (!responseData) {
    throw new Error('responseData param is required');
  }
  const pullRequests = responseData.nodes ?? [];
  console.log(
    'Executed batched reviews query :>> ',
    pullRequests.map((r) => r.id),
  );

  const rateLimit = responseData.rateLimit;
  for (const pullRequest of pullRequests) {
    const reviewNodes = pullRequest.reviews?.nodes ?? [];

    for (const reviewNode of reviewNodes) {
      if (!utils.hasProperties(reviewNode)) {
        continue;
      }

      await iteratee({ pullRequestId: pullRequest.id, ...reviewNode });
    }
  }

  return {
    rateLimit,
  };
};

/**
 * Iterate issues, with pagination, up to 500.
 * Utilizes queryParams.lastExecutionTime to query the minimal amount.
 * @param queryParams
 * @param iteratee
 * @param execute
 */
const iterateReviews = async (queryParams: QueryParams, execute, iteratee) => {
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

export default { iterateReviews };
