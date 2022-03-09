import utils from './utils';
import { ResourceIteratee } from '../../../client';
import { PullRequest } from '../types';
import { ExecutableQuery, QueryExecutor } from '../CreateQueryExecutor';

type QueryState = {
  commits: CursorState;
  reviews: CursorState;
  labels: CursorState;
  rateLimit?: {
    limit: number;
    cost: number;
    remaining: number;
    resetAt: string;
  };
};

type CursorState = {
  hasNextPage?: boolean;
  endCursor?: string;
};

type ProcessedData = {
  resource;
  queryState: QueryState;
};

const MAX_REQUESTS_NUM = 100;

class SinglePullRequestQuery {
  /**
   * Builds the leanest query possible
   * based on the provided queryState.
   *
   * @param pullRequestNumber
   * @param repoName
   * @param repoOwner
   * @param queryState
   */
  public static buildQuery(
    pullRequestNumber: number,
    repoName: string,
    repoOwner: string,
    queryState?: QueryState,
  ): ExecutableQuery {
    const query = `
      query (
        $pullRequestNumber: Int!
        $repoName: String!
        $repoOwner: String!
        $maxCount: Int!
        ${
          queryState?.commits.hasNextPage !== false
            ? '$commitsCursor: String'
            : ''
        }
        ${
          queryState?.reviews.hasNextPage !== false
            ? '$reviewsCursor: String'
            : ''
        }
        ${
          queryState?.labels.hasNextPage !== false
            ? '$labelsCursor: String'
            : ''
        }
      ) {
          repository(name: $repoName, owner: $repoOwner) {
            pullRequest(number: $pullRequestNumber) {
              ...pullRequestFields
              ${
                queryState?.commits.hasNextPage !== false
                  ? this.commitsQuery
                  : ''
              }
              ${
                queryState?.reviews.hasNextPage !== false
                  ? this.reviewsQuery
                  : ''
              }
              ${
                queryState?.labels.hasNextPage !== false ? this.labelsQuery : ''
              } 
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
        pullRequestNumber,
        repoName,
        repoOwner,
        maxCount: MAX_REQUESTS_NUM,
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
  }

  private static commitsQuery = `
    commits(first: $maxCount, after: $commitsCursor) {
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

  private static reviewsQuery = `
    reviews(first: $maxCount, after: $reviewsCursor) {
      totalCount
      nodes {
        ...reviewFields
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }`;

  private static labelsQuery = `
    labels(first: $maxCount, after: $labelsCursor) {
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

  public static processResponseData(responseData): ProcessedData {
    const rateLimit = responseData.rateLimit;
    const pullRequest = responseData.repository.pullRequest;
    const { commits, reviews, labels } = pullRequest;

    return {
      resource: utils.responseToResource(pullRequest),
      queryState: {
        rateLimit: rateLimit,
        commits: commits?.pageInfo,
        reviews: reviews?.pageInfo,
        labels: labels?.pageInfo,
      },
    };
  }

  /**
   * Handles query pagination for inner resources.
   * Builds final resource while calculating the total cost
   * of the queries.
   * @param repository
   * @param iteratee
   * @param execute
   */
  public static async query(
    repository: {
      pullRequestNumber: number;
      repoName: string;
      repoOwner: string;
    },
    iteratee: ResourceIteratee<PullRequest>,
    execute: QueryExecutor,
  ): Promise<{ rateLimitConsumed: number }> {
    let finalResource: PullRequest | undefined = undefined;
    let queryCost = 0;
    let queryState: QueryState | undefined = undefined;
    let paginationComplete = false;

    while (!paginationComplete) {
      const executable = this.buildQuery(
        repository.pullRequestNumber,
        repository.repoName,
        repository.repoOwner,
        queryState,
      );

      const response = await execute(executable);

      const { resource: processedResource, queryState: processedQueryState } =
        this.processResponseData(response);

      finalResource = this.concatResources(processedResource, finalResource);
      queryCost += processedQueryState.rateLimit?.cost ?? 0;
      queryState = processedQueryState;
      paginationComplete = this.isPaginationComplete(processedQueryState);
    }

    if (finalResource) {
      await iteratee(finalResource);
    }

    return {
      rateLimitConsumed: queryCost,
    };
  }

  /**
   * Combines the Pull Request resource as
   * pagination occurs.
   * @param newResource
   * @param existingResource
   * @private
   */
  private static concatResources(
    newResource: PullRequest,
    existingResource?: PullRequest,
  ): PullRequest {
    if (!existingResource) {
      return newResource;
    }

    return {
      ...existingResource,
      commits: existingResource.commits!.concat(newResource?.commits ?? []),
      reviews: existingResource.reviews!.concat(newResource?.reviews ?? []),
      labels: existingResource.labels!.concat(newResource?.labels ?? []),
    };
  }

  /**
   * Determines if all inner resources have
   * completed pagination.
   * @param queryState
   * @private
   */
  private static isPaginationComplete(queryState: QueryState): boolean {
    return (
      !queryState.commits?.hasNextPage &&
      !queryState.labels?.hasNextPage &&
      !queryState.reviews?.hasNextPage
    );
  }
}

export default SinglePullRequestQuery;
