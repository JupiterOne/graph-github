import utils from '../utils';
import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  IteratePagination,
  ProcessedData,
  PullRequestConnections,
  PullRequestResponse,
} from '../types';
import { ExecutableQuery } from '../CreateQueryExecutor';
import fragments from '../fragments';

interface QueryState extends BaseQueryState {
  isInitialQuery?: true;
  commits?: CursorState;
  reviews?: CursorState;
  labels?: CursorState;
}

export type QueryParams = {
  pullRequestNumber: number;
  repoName: string;
  repoOwner: string;
  onlyConnections?: boolean;
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
          queryState?.isInitialQuery ||
          queryState?.commits?.hasNextPage === true
            ? '$commitsCursor: String'
            : ''
        }
        ${
          queryState?.isInitialQuery ||
          queryState?.reviews?.hasNextPage === true
            ? '$reviewsCursor: String'
            : ''
        }
        ${
          queryState?.isInitialQuery || queryState?.labels?.hasNextPage === true
            ? '$labelsCursor: String'
            : ''
        }
      ) {
          repository(name: $repoName, owner: $repoOwner) {
            pullRequest(number: $pullRequestNumber) {
              ${!queryParams.onlyConnections ? `...${pullRequestFields}` : ''}
              ${
                queryState?.isInitialQuery ||
                queryState?.commits?.hasNextPage === true
                  ? commitsQuery
                  : ''
              }
              ${
                queryState?.isInitialQuery ||
                queryState?.reviews?.hasNextPage === true
                  ? reviewsQuery
                  : ''
              }
              ${
                queryState?.isInitialQuery ||
                queryState?.labels?.hasNextPage === true
                  ? labelsQuery
                  : ''
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

const pullRequestFields = `
  on PullRequest {
    author {
      ...${fragments.teamMemberFields}
    }
    baseRefName
    baseRefOid
    baseRepository {
      name
      owner {
        ...on RepositoryOwner {
          login
        }
      }
    }
    body
    changedFiles
    createdAt
    databaseId
    headRefName
    headRefOid
    headRepository {
      name
      owner {
        ...on RepositoryOwner {
          login
        }
      }
    }
    id
    mergeCommit {
      ...on Commit {
        commitUrl
        oid
      }
      associatedPullRequests(first: 1) {
        nodes {
          id
          number
        }
      }
    }
    merged
    mergedAt
    mergedBy {
      ...${fragments.teamMemberFields}
    }
    number
    reviewDecision
    state
    title
    updatedAt
    url
  }`;

const commitsQuery = `
    commits(first: $maxLimit, after: $commitsCursor) {
      totalCount
      nodes {
        commit {
          ...${fragments.commitFields}
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
        ...${fragments.reviewFields}
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
const iteratePullRequest: IteratePagination<
  QueryParams,
  PullRequestResponse | PullRequestConnections
> = async (queryParams, execute, iteratee) => {
  let finalResource: PullRequestResponse | undefined = undefined;
  let queryCost = 0;
  let queryState: QueryState = { isInitialQuery: true };
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
  newResource: PullRequestResponse,
  existingResource?: PullRequestResponse,
): PullRequestResponse => {
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
