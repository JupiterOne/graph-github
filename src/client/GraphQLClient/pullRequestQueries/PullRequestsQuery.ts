import { ResourceIteratee } from '../../../client';
import {
  PullRequestResponse,
  IteratePagination,
  CursorState,
  BaseQueryState,
  BuildQuery,
  RateLimitStepSummary,
} from '../types';
import utils from '../utils';
import { ExecutableQuery } from '../CreateQueryExecutor';
import fragments from '../fragments';

interface QueryState extends BaseQueryState {
  pullRequests: CursorState;
}

type QueryParams = {
  fullName: string;
  public: boolean;
  ingestStartDatetime: string;
  maxResourceIngestion: number;
  maxSearchLimit: number;
};

/**
 * Builds the leanest query possible
 * based on the provided queryState.
 * Pagination for sub-resources (commits, reviews, labels)
 * is performed separately.
 * @param queryParams
 * @param queryState
 */
export const buildQuery: BuildQuery<QueryParams, QueryState> = (
  queryParams,
  queryState,
): ExecutableQuery => {
  const query = `
      query (
        $issueQuery: String!, 
        $maxSearchLimit: Int!,
        $pullRequestsCursor: String
      ) {
        search(first: $maxSearchLimit, after: $pullRequestsCursor, type: ISSUE, query: $issueQuery) {
          issueCount
          edges {
            node {
              ${pullRequestFields(queryParams.public)}
            }
          }
          pageInfo {
            endCursor
            hasNextPage
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
      issueQuery: `is:pr repo:${queryParams.fullName} updated:>=${queryParams.ingestStartDatetime}`,
      maxSearchLimit: queryParams.maxSearchLimit,
      ...(queryState?.pullRequests?.hasNextPage && {
        pullRequestsCursor: queryState?.pullRequests.endCursor,
      }),
    },
  };
};

const pullRequestFields = (isPublicRepo: boolean) => {
  return `...on PullRequest {
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
    ${
      isPublicRepo
        ? `mergeCommit {
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
           }`
        : ''
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
};

/**
 * Processes the data, iterating over each pull request.
 * If inner resources of the pull request have multiple
 * pages, the pull request is added to a InnerResourceQuery queue
 * to be processed later.
 * @param responseData
 * @param iteratee
 * @param onInnerResourceQueryRequired
 * @param logger
 */
export const processResponseData = async (
  responseData: any,
  iteratee: ResourceIteratee<PullRequestResponse>,
): Promise<QueryState> => {
  if (!responseData) {
    throw new Error('responseData param is required.');
  }

  const rateLimit = responseData.rateLimit;
  const pullRequestEdges = responseData.search.edges;

  for (const edge of pullRequestEdges) {
    const pullRequest = edge.node;
    if (!utils.hasProperties(pullRequest)) {
      // If there's no data, pass - possible if permissions aren't correct in GHE
      continue;
    }

    await iteratee(utils.responseToResource(pullRequest));
  }

  return {
    rateLimit,
    pullRequests: responseData.search.pageInfo,
  };
};

/**
 * Using the provided params, Pull Requests are
 * iterated through.
 * Pagination is handled at the root and inner resource levels.
 * Inner resources include: commits, reviews, labels
 * See SinglePullRequestQuery.ts for more details.
 * @param queryParams
 * @param iteratee
 * @param execute
 * @param logger
 * @return Promise
 */
const iteratePullRequests: IteratePagination<
  QueryParams,
  PullRequestResponse
> = async (
  queryParams,
  execute,
  iteratee,
  logger,
): Promise<RateLimitStepSummary> => {
  const originalMaxSearchLimit = queryParams.maxSearchLimit;
  const requestLimitState = {
    isActive: false,
    count: originalMaxSearchLimit,
    limit: originalMaxSearchLimit,
  };
  let pullRequestFetched = 0;
  let queryCost = 0;
  let queryState: QueryState | undefined = undefined;
  let paginationComplete = false;

  const countIteratee = async (pullRequest: PullRequestResponse) => {
    pullRequestFetched++;
    if (requestLimitState.isActive) {
      requestLimitState.count--;
      if (requestLimitState.count === 0) {
        // reset state to continue requesting as default
        requestLimitState.isActive = false;
        requestLimitState.count = originalMaxSearchLimit;
        requestLimitState.limit = originalMaxSearchLimit;
        queryParams.maxSearchLimit = originalMaxSearchLimit;
        logger?.info(
          { queryParams, queryState },
          'Finish querying page by half the search limit.',
        );
      }
    }
    await iteratee(pullRequest);
  };

  while (!paginationComplete) {
    const executable = buildQuery(queryParams, queryState);

    let response: any;
    try {
      response = await execute(executable);
    } catch (err) {
      if (err.message?.includes('This may be the result of a timeout')) {
        requestLimitState.isActive = true;
        const newSearchLimit = Math.max(
          Math.floor(requestLimitState.limit / 2),
          1,
        );
        if (newSearchLimit === requestLimitState.limit) {
          // prevent infinite loop: newSearchLimit is 1 and it already failed using 1
          throw err;
        }
        requestLimitState.limit = newSearchLimit;
        queryParams.maxSearchLimit = newSearchLimit;
        logger?.info(
          { queryParams, queryState },
          'Search Pull Requests timeout. Start querying by half the search limit.',
        );
        continue;
      } else {
        throw err;
      }
    }

    queryState = await processResponseData(response, countIteratee);

    queryCost += queryState.rateLimit?.cost ?? 0;

    const exceededMaxResourceLimit =
      pullRequestFetched >= queryParams.maxResourceIngestion;

    paginationComplete =
      !queryState.pullRequests?.hasNextPage || exceededMaxResourceLimit;

    if (exceededMaxResourceLimit) {
      logger?.warn(
        {
          paginationComplete,
          pullRequestFetched,
          maxPullRequests: queryParams.maxResourceIngestion,
        },
        'Max PR resource ingestion was reached.',
      );
    }
  }

  return {
    totalCost: queryCost,
    limit: queryState?.rateLimit?.limit,
    remaining: queryState?.rateLimit?.remaining,
    resetAt: queryState?.rateLimit?.resetAt,
  };
};

export default { iteratePullRequests };
