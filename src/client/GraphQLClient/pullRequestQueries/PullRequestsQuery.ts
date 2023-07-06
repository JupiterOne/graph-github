import { ResourceIteratee } from '../../../client';
import {
  PullRequestResponse,
  IteratePagination,
  CursorState,
  InnerResourceQuery,
  BaseQueryState,
  BuildQuery,
  RateLimitStepSummary,
  PullRequestConnections,
  PullRequestFields,
} from '../types';
import utils from '../utils';
import { ExecutableQuery } from '../CreateQueryExecutor';
import SinglePullRequestQuery from './SinglePullRequestQuery';
import { MAX_SEARCH_LIMIT } from '../paginate';
import fragments from '../fragments';

interface QueryState extends BaseQueryState {
  pullRequests: CursorState;
}

type InnerResourcePullRequestQuery = {
  pullRequest: PullRequestFields;
  repoName: string;
  repoOwner: string;
};

type QueryParams = {
  fullName: string;
  public: boolean;
  ingestStartDatetime: string;
  maxResourceIngestion: number;
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
        ...${fragments.rateLimit}
      }`;

  return {
    query,
    ...(queryState?.rateLimit && {
      rateLimit: queryState.rateLimit,
    }),
    queryVariables: {
      issueQuery: `is:pr repo:${queryParams.fullName} updated:>=${queryParams.ingestStartDatetime}`,
      maxSearchLimit: MAX_SEARCH_LIMIT,
      ...(queryState?.pullRequests?.hasNextPage && {
        pullRequestsCursor: queryState?.pullRequests.endCursor,
      }),
    },
  };
};

const pullRequestFields = (isPublicRepo) => {
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
 * Builds commits sub-query if repo is public.
 * @param isPublic
 */
const commitsQuery = (isPublic) => {
  if (!isPublic) {
    return '';
  }

  return `
    ... on PullRequest {
      commits(first: 1) {
        totalCount
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
      reviews(first: 1) {
        totalCount
      }
    }`;
};

const labelsQuery = `
  ... on PullRequest {
    labels(first: 1) {
      totalCount
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
 * @param logger
 */
export const processResponseData = async (
  responseData: any,
  iteratee: ResourceIteratee<PullRequestResponse>,
  onInnerResourceQueryRequired: InnerResourceQuery<InnerResourcePullRequestQuery>,
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

    if (
      utils.innerResourcePaginationRequired(pullRequest) &&
      utils.hasRepoOwnerAndName(pullRequest)
    ) {
      const repoOwnerAndName = utils.findRepoOwnerAndName(pullRequest);
      // Add pull request to queue allowing process to continue without
      // pausing for subsequent requests. This path is not as common.
      onInnerResourceQueryRequired({
        pullRequest: utils.responseToResource(pullRequest),
        repoName: repoOwnerAndName.repoName!,
        repoOwner: repoOwnerAndName.repoOwner!,
      });
    } else {
      await iteratee(utils.responseToResource(pullRequest));
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
 * @param logger
 * @return Promise
 */
const iteratePullRequests: IteratePagination<QueryParams, PullRequestResponse> =
  async (
    queryParams,
    execute,
    iteratee,
    logger,
  ): Promise<RateLimitStepSummary> => {
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
        const { repoName, repoOwner } = pullRequestQuery;
        const { number: pullRequestNumber } = pullRequestQuery.pullRequest;
        const { totalCost } = await SinglePullRequestQuery.iteratePullRequest(
          { pullRequestNumber, repoName, repoOwner, onlyConnections: true },
          execute,
          async (connections: PullRequestConnections) => {
            pullRequestFetched++;
            await iteratee({
              ...pullRequestQuery.pullRequest,
              ...connections,
            });
          },
        );

        queryCost += totalCost;
      }

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
