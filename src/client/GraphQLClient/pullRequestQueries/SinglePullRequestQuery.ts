import utils from '../utils';
import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  IteratePagination,
  ProcessedData,
  PullRequest,
} from '../types';
import { ExecutableQuery } from '../CreateQueryExecutor';

interface QueryState extends BaseQueryState {
  commits?: CursorState;
  reviews?: CursorState;
  labels?: CursorState;
}

type QueryParams = {
  pullRequestNumber: number;
  repoName: string;
  repoOwner: string;
};

const MAX_REQUESTS_LIMIT = 100;

/**
 * Builds the leanest query possible
 * based on the provided queryState.
 *
 * @param queryParams
 * @param queryState
 */
export const buildQuery: BuildQuery<QueryParams, QueryState> = (
  queryParams,
  queryState,
): ExecutableQuery => {
  const query = `
      query (
        $pullRequestNumber: Int!
        $repoName: String!
        $repoOwner: String!
        $maxLimit: Int!
        ${
          queryState?.commits?.hasNextPage !== false
            ? '$commitsCursor: String'
            : ''
        }
        ${
          queryState?.reviews?.hasNextPage !== false
            ? '$reviewsCursor: String'
            : ''
        }
        ${
          queryState?.labels?.hasNextPage !== false
            ? '$labelsCursor: String'
            : ''
        }
      ) {
          repository(name: $repoName, owner: $repoOwner) {
            pullRequest(number: $pullRequestNumber) {
              ...pullRequestFields
              ${queryState?.commits?.hasNextPage !== false ? commitsQuery : ''}
              ${queryState?.reviews?.hasNextPage !== false ? reviewsQuery : ''}
              ${queryState?.labels?.hasNextPage !== false ? labelsQuery : ''} 
            }
          }
          ...rateLimit
      }`;

  return {
    query,
    ...(queryState?.rateLimit && {
      rateLimit: queryState.rateLimit,
    }),
    queryVariables: {
      pullRequestNumber: queryParams.pullRequestNumber,
      repoName: queryParams.repoName,
      repoOwner: queryParams.repoOwner,
      maxLimit: MAX_REQUESTS_LIMIT,
      ...(queryState?.commits?.hasNextPage && {
        commitsCursor: queryState?.commits.endCursor,
      }),
      ...(queryState?.reviews?.hasNextPage && {
        reviewsCursor: queryState?.reviews.endCursor,
      }),
      ...(queryState?.labels?.hasNextPage && {
        labelsCursor: queryState?.labels.endCursor,
      }),
    },
  };
};

const commitsQuery = `
    commits(first: $maxLimit, after: $commitsCursor) {
      totalCount
      nodes {
        commit {
          ...commitFields
        }
      }
      
      pageInfo {
        endCursor
        hasNextPage
      }
    }`;

const reviewsQuery = `
    reviews(first: $maxLimit, after: $reviewsCursor) {
      totalCount
      nodes {
        ...reviewFields
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }`;

const labelsQuery = `
    labels(first: $maxLimit, after: $labelsCursor) {
      totalCount
      nodes {
        id
        name
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }`;

export const processResponseData = (
  responseData,
): ProcessedData<QueryState> => {
  const rateLimit = responseData.rateLimit;
  const pullRequest = responseData.repository?.pullRequest;

  return {
    resource: utils.responseToResource(pullRequest),
    queryState: {
      rateLimit: rateLimit,
      commits: pullRequest?.commits?.pageInfo,
      reviews: pullRequest?.reviews?.pageInfo,
      labels: pullRequest?.labels?.pageInfo,
    },
  };
};

/**
 * Handles query pagination for inner resources.
 * Builds final resource while calculating the total cost
 * of the queries.
 * @param queryParams
 * @param iteratee
 * @param execute
 */
const iteratePullRequest: IteratePagination<QueryParams, PullRequest> = async (
  queryParams,
  execute,
  iteratee,
) => {
  let finalResource: PullRequest | undefined = undefined;
  let queryCost = 0;
  let queryState: QueryState | undefined = undefined;
  let paginationComplete = false;

  while (!paginationComplete) {
    const executable = buildQuery(queryParams, queryState);

    const response = await execute(executable);

    const { resource: processedResource, queryState: processedQueryState } =
      processResponseData(response);

    finalResource = joinInnerResources(processedResource, finalResource);
    queryCost += processedQueryState.rateLimit?.cost ?? 0;
    queryState = processedQueryState;
    paginationComplete = isPaginationComplete(processedQueryState);
  }

  if (finalResource) {
    await iteratee(finalResource);
  }

  return {
    totalCost: queryCost,
    limit: queryState?.rateLimit?.limit,
    remaining: queryState?.rateLimit?.remaining,
    resetAt: queryState?.rateLimit?.resetAt,
  };
};

/**
 * Combines the Pull Request resource as
 * pagination occurs.
 * @param newResource
 * @param existingResource
 * @private
 */
const joinInnerResources = (
  newResource: PullRequest,
  existingResource?: PullRequest,
): PullRequest => {
  if (!existingResource) {
    return newResource;
  }

  return {
    ...existingResource,
    commits: existingResource.commits!.concat(newResource?.commits ?? []),
    reviews: existingResource.reviews!.concat(newResource?.reviews ?? []),
    labels: existingResource.labels!.concat(newResource?.labels ?? []),
  };
};

/**
 * Determines if all inner resources have
 * completed pagination.
 * @param queryState
 * @private
 */
const isPaginationComplete = (queryState: QueryState): boolean => {
  return (
    !queryState.commits?.hasNextPage &&
    !queryState.labels?.hasNextPage &&
    !queryState.reviews?.hasNextPage
  );
};

export default { iteratePullRequest };
