import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  Review,
  IteratePagination,
  ProcessResponse,
} from '../types';
import { ExecutableQuery } from '../CreateQueryExecutor';
import paginate from '../paginate';
import utils from '../utils';
import fragments from '../fragments';

interface QueryState extends BaseQueryState {
  reviews: CursorState;
}

type QueryParams = {
  repoName: string;
  repoOwner: string;
  isPublicRepo: boolean;
  pullRequestNumber: number;
  maxLimit: number;
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
      $pullRequestNumber: Int!
      $repoName: String!
      $repoOwner: String!
      $maxLimit: Int!
      $reviewsCursor: String
    ) {
      repository(name: $repoName, owner: $repoOwner) {
        pullRequest(number: $pullRequestNumber) {
          reviews(first: $maxLimit, after: $reviewsCursor) {
            totalCount
            nodes {
              ...on PullRequestReview {
                ${
                  queryParams.isPublicRepo
                    ? `commit {
                      oid
                    }`
                    : ''
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
            pageInfo {
              endCursor
              hasNextPage
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
      maxLimit: queryParams.maxLimit,
      pullRequestNumber: queryParams.pullRequestNumber,
      repoName: queryParams.repoName,
      repoOwner: queryParams.repoOwner,
      ...(queryState?.reviews?.hasNextPage && {
        reviewsCursor: queryState?.reviews.endCursor,
      }),
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

  const rateLimit = responseData.rateLimit;
  const reviewNodes = responseData.repository.pullRequest.reviews.nodes;

  for (const reviewNode of reviewNodes) {
    if (!utils.hasProperties(reviewNode)) {
      continue;
    }

    await iteratee(reviewNode);
  }

  return {
    rateLimit,
    reviews: responseData.repository.pullRequest.reviews.pageInfo,
  };
};

/**
 * Iterate issues, with pagination, up to 500.
 * Utilizes queryParams.lastExecutionTime to query the minimal amount.
 * @param queryParams
 * @param iteratee
 * @param execute
 */
const iterateReviews: IteratePagination<QueryParams, Review> = async (
  queryParams,
  execute,
  iteratee,
  logger,
) => {
  return paginate(
    queryParams,
    iteratee,
    execute,
    buildQuery,
    processResponseData,
    (queryState) => !queryState?.reviews?.hasNextPage ?? true,
    logger,
    'maxLimit',
  );
};

export default { iterateReviews };
