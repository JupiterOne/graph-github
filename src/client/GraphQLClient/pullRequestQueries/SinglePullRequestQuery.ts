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
import fragments from '../fragments';

interface QueryState extends BaseQueryState {
  isInitialQuery?: true;
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
              ...${pullRequestFields}
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
    additions
    author {
      ...${fragments.teamMemberFields}
    }
    authorAssociation
    baseRefName
    baseRefOid
    baseRepository {
      name
      url
      owner {
        ...${fragments.repositoryOwnerFields}
      }
    }
    body
    changedFiles
    checksUrl
    closed
    closedAt
    # comments  # Maybe someday
    createdAt
    databaseId
    deletions
    editor {
      ...${fragments.userFields}
    }
    # files # Maybe someday
    headRefName
    headRefOid
    headRepository {
      name
      owner {
        ...${fragments.repositoryOwnerFields}
      }
    }
    id
    isDraft
    lastEditedAt
    locked
    mergeCommit {
      ...${fragments.commitFields}
    }
    mergeable
    merged
    mergedAt
    mergedBy {
      ...${fragments.teamMemberFields}
    }
    number
    permalink
    publishedAt
    reviewDecision
    # reviewRequests  # Maybe someday
    state
    # suggestedReviewers  # Maybe someday
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
