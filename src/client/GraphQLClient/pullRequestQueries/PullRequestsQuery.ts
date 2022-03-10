import { ResourceIteratee } from '../../../client';
import { PullRequest } from '../types';
import utils from './utils';
import { ExecutableQuery, QueryExecutor } from '../CreateQueryExecutor';
import SinglePullRequestQuery from './SinglePullRequestQuery';

type QueryState = {
  pullRequests: CursorState;
  rateLimit?: {
    cost: number;
    limit: number;
    remaining: number;
    resetAt: string;
  };
};

type CursorState = {
  hasNextPage?: boolean;
  endCursor?: string;
};

type InnerResourceQuery<T> = (each: T) => void;

type InnerResourcePullRequestQuery = {
  pullRequestNumber: number;
  repoName: string;
  repoOwner: string;
};

const MAX_SEARCH_LIMIT = 25;
const MAX_INNER_RESOURCE_LIMIT = 100;
const MAX_FETCHES_PER_EXECUTION = 500;

class PullRequestsQuery {
  /**
   * Builds the leanest query possible
   * based on the provided queryState.
   * Pagination for sub-resources (commits, reviews, labels)
   * is performed separately.
   * @param repoFullName
   * @param repoIsPublic
   * @param lastExecutionTime
   * @param queryState
   */
  public static buildQuery(
    repoFullName: string,
    repoIsPublic: boolean,
    lastExecutionTime: string,
    queryState?: QueryState,
  ): ExecutableQuery {
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
                repoIsPublic
                  ? '...pullRequestFields'
                  : '...privateRepoPullRequestFields'
              }
              ${this.commitsQuery(repoIsPublic)}
              ${this.reviewsQuery(repoIsPublic)}
              ${this.labelsQuery} 
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
        issueQuery: `is:pr repo:${repoFullName} updated:>=${lastExecutionTime}`,
        maxSearchLimit: MAX_SEARCH_LIMIT,
        maxLimit: MAX_INNER_RESOURCE_LIMIT,
        ...(queryState?.pullRequests?.hasNextPage && {
          pullRequestsCursor: queryState?.pullRequests.endCursor,
        }),
      },
    };
  }

  private static commitsQuery(isPublic) {
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
  }

  private static reviewsQuery(isPublic) {
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
  }

  private static labelsQuery = `
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
   * @param addToQueue
   */
  public static async processResponseData(
    responseData,
    iteratee: ResourceIteratee<PullRequest>,
    addToQueue: InnerResourceQuery<InnerResourcePullRequestQuery>,
  ): Promise<QueryState> {
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
        addToQueue({
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
  }

  /**
   * Using the provided params, Pull Requests are
   * iterated through.
   * Pagination is handled
   * @param repository
   * @param lastExecutionTime
   * @param iteratee
   * @param execute
   * @return {rateLimitConsumed}
   */
  public static async iteratePullRequests(
    repository: { fullName: string; public: boolean },
    lastExecutionTime: string,
    iteratee: ResourceIteratee<PullRequest>,
    execute: QueryExecutor,
  ) {
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
      const queue: InnerResourcePullRequestQuery[] = [];

      const executable = this.buildQuery(
        repository.fullName,
        repository.public,
        lastExecutionTime,
        queryState,
      );

      const response = await execute(executable);

      queryState = await this.processResponseData(
        response,
        countIteratee,
        (query) => queue.push(query),
      );

      queryCost += queryState.rateLimit?.cost ?? 0;

      for (const pullRequestQuery of queue) {
        const { rateLimitConsumed } = await SinglePullRequestQuery.query(
          pullRequestQuery,
          countIteratee,
          execute,
        );

        queryCost += rateLimitConsumed;
      }

      paginationComplete =
        !queryState.pullRequests.hasNextPage ||
        pullRequestFetched >= MAX_FETCHES_PER_EXECUTION;
    }

    return {
      rateLimitConsumed: queryCost,
    };
  }
}

export default PullRequestsQuery;
