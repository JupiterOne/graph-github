import { ResourceIteratee } from '../../../client';
import {
  GithubQueryResponse,
  PullRequest,
  IteratePagination,
  CursorState,
  InnerResourceQuery,
  BaseQueryState,
  BuildQuery,
} from '../types';
import utils from './utils';
import { ExecutableQuery } from '../CreateQueryExecutor';
import SinglePullRequestQuery from './SinglePullRequestQuery';

interface QueryState extends BaseQueryState {
  pullRequests: CursorState;
}

type InnerResourcePullRequestQuery = {
  pullRequestNumber: number;
  repoName: string;
  repoOwner: string;
};

type QueryParams = {
  fullName: string;
  public: boolean;
  lastExecutionTime: string;
};

const MAX_SEARCH_LIMIT = 25;
const MAX_INNER_RESOURCE_LIMIT = 100;
const MAX_FETCHES_PER_EXECUTION = 500;

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
        $maxLimit: Int!,
        $pullRequestsCursor: String
      ) {
        search(first: $maxSearchLimit, after: $pullRequestsCursor, type: ISSUE, query: $issueQuery) {
          issueCount
          edges {
            node {
              ${
                queryParams.public
                  ? '...pullRequestFields'
                  : '...privateRepoPullRequestFields'
              }
              ${commitsQuery(queryParams.public)}
              ${reviewsQuery(queryParams.public)}
              ${labelsQuery} 
            }
          }
          pageInfo {
            endCursor
            hasNextPage
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
      issueQuery: `is:pr repo:${queryParams.fullName} updated:>=${queryParams.lastExecutionTime}`,
      maxSearchLimit: MAX_SEARCH_LIMIT,
      maxLimit: MAX_INNER_RESOURCE_LIMIT,
      ...(queryState?.pullRequests?.hasNextPage && {
        pullRequestsCursor: queryState?.pullRequests.endCursor,
      }),
    },
  };
};

/**
 * Builds commits sub-query if repo is public.
 * @param isPublic
 */
const commitsQuery = (isPublic) => {
  if (!isPublic) {
    return '';
  }

  return `
    ... on PullRequest {
      commits(first: $maxLimit) {
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
      }
    }`;
};

/**
 * Builds reviews sub-query.
 * @param isPublic
 */
const reviewsQuery = (isPublic) => {
  return `
    ... on PullRequest {
      reviews(first: $maxLimit) {
        totalCount
        nodes {
          ${isPublic ? '...reviewFields' : '...privateRepoPRReviewFields'}
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }`;
};

const labelsQuery = `
  ... on PullRequest {
    labels(first: $maxLimit) {
      totalCount
      nodes {
        id
        name
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }`;

/**
 * Processes the data, iterating over each pull request.
 * If inner resources of the pull request have multiple
 * pages, the pull request is added to a InnerResourceQuery queue
 * to be processed later.
 * @param responseData
 * @param iteratee
 * @param onInnerResourceQueryRequired
 */
export const processResponseData = async (
  responseData,
  iteratee: ResourceIteratee<PullRequest>,
  onInnerResourceQueryRequired: InnerResourceQuery<InnerResourcePullRequestQuery>,
): Promise<QueryState> => {
  if (!responseData) {
    throw new Error('responseData param is required.');
  }

  const rateLimit = responseData.rateLimit;
  const pullRequestEdges = responseData.search.edges;

  for (const edge of pullRequestEdges) {
    const pullRequest = edge.node;
    if (Object.keys(pullRequest).length === 0) {
      // If there's no data, pass - possible if permissions aren't correct in GHE
      continue;
    }

    if (
      utils.innerResourcePaginationRequired(pullRequest) &&
      utils.hasRepoOwnerAndName(pullRequest)
    ) {
      const repoOwnerAndName = utils.findRepoOwnerAndName(pullRequest);
      // Add pull request to queue allowing process to continue without
      // pausing for subsequent requests. This path is not as common.
      onInnerResourceQueryRequired({
        pullRequestNumber: pullRequest.number,
        repoName: repoOwnerAndName.repoName!,
        repoOwner: repoOwnerAndName.repoOwner!,
      });
    } else {
      await iteratee(utils.responseToResource(edge.node));
    }
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
 * @return {rateLimitConsumed}
 */
const iteratePullRequests: IteratePagination<QueryParams, PullRequest> = async (
  queryParams,
  execute,
  iteratee,
): Promise<GithubQueryResponse> => {
  let pullRequestFetched = 0;
  let queryCost = 0;
  let queryState: QueryState | undefined = undefined;
  let paginationComplete = false;

  const countIteratee = async (pullRequest) => {
    pullRequestFetched++;
    await iteratee(pullRequest);
  };

  while (!paginationComplete) {
    // Queue of pull requests that have inner resources
    // and require a separate query to gather complete data.
    const innerResourceQueries: InnerResourcePullRequestQuery[] = [];

    const executable = buildQuery(queryParams, queryState);

    const response = await execute(executable);

    queryState = await processResponseData(response, countIteratee, (query) =>
      innerResourceQueries.push(query),
    );

    queryCost += queryState.rateLimit?.cost ?? 0;

    for (const pullRequestQuery of innerResourceQueries) {
      const { rateLimitConsumed } =
        await SinglePullRequestQuery.iteratePullRequest(
          pullRequestQuery,
          execute,
          countIteratee,
        );

      queryCost += rateLimitConsumed;
    }

    paginationComplete =
      !queryState.pullRequests?.hasNextPage ||
      pullRequestFetched >= MAX_FETCHES_PER_EXECUTION;
  }

  return {
    rateLimitConsumed: queryCost,
  };
};

export default { iteratePullRequests };
