import { ResourceIteratee } from '../../types';
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
import { buildTimeoutHandler } from '../timeoutHandler';
import { pullRequestFields } from './shared';

interface QueryState extends BaseQueryState {
  pullRequests: CursorState;
  issueCount?: number;
}

type QueryParams = {
  repoOwner: string;
  repoName: string;
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
  const issueCountQuery = `
    search(first: $maxSearchLimit, type: ISSUE, query: $searchQuery) {
      issueCount
    }
  `;

  const query = `
      query (
        ${!queryState?.issueCount ? '$searchQuery: String!,' : ''}
        $repoOwner: String!,
        $repoName: String!,
        $maxSearchLimit: Int!,
        $pullRequestsCursor: String
      ) {
        ${!queryState?.issueCount ? issueCountQuery : ''}
        repository(owner: $repoOwner, name: $repoName) {
          pullRequests(orderBy: { field: UPDATED_AT, direction: DESC }, first: $maxSearchLimit, after: $pullRequestsCursor) {
            nodes {
              ${pullRequestFields(queryParams.public)}
            }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
        ...${fragments.rateLimit}
      }`;

  const fullName = `${queryParams.repoOwner}/${queryParams.repoName}`;
  return {
    query,
    ...(queryState?.rateLimit && {
      rateLimit: queryState.rateLimit,
    }),
    queryVariables: {
      ...(!queryState?.issueCount && {
        searchQuery: `is:pr repo:${fullName} updated:>=${queryParams.ingestStartDatetime}`,
      }),
      repoOwner: queryParams.repoOwner,
      repoName: queryParams.repoName,
      maxSearchLimit: queryParams.maxSearchLimit,
      ...(queryState?.pullRequests?.hasNextPage && {
        pullRequestsCursor: queryState?.pullRequests.endCursor,
      }),
    },
  };
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
  const pullRequestNodes = responseData.repository?.pullRequests?.nodes ?? [];

  for (const pullRequest of pullRequestNodes) {
    if (!utils.hasProperties(pullRequest)) {
      // If there's no data, pass - possible if permissions aren't correct in GHE
      continue;
    }

    await iteratee(utils.responseToResource(pullRequest));
  }

  return {
    rateLimit,
    pullRequests: responseData.repository?.pullRequests?.pageInfo,
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
  let pullRequestFetched = 0;
  let queryCost = 0;
  let queryState: QueryState | undefined = undefined;
  let paginationComplete = false;
  let issueCount: number | undefined;

  const countIteratee: ResourceIteratee<PullRequestResponse> = async (
    pullRequest: PullRequestResponse,
  ) => {
    if (
      new Date(pullRequest.updatedAt) >=
      new Date(queryParams.ingestStartDatetime)
    ) {
      pullRequestFetched++;
      await iteratee(pullRequest);
    }
  };

  const withTimeoutHandler = buildTimeoutHandler({
    queryParams,
    maxLimitKey: 'maxSearchLimit',
    logger,
  });

  while (!paginationComplete) {
    const executable = buildQuery(
      queryParams,
      queryState ? { ...queryState, issueCount } : undefined,
    );
    const { response, retry } = await withTimeoutHandler(async () =>
      execute(executable),
    );

    if (retry) {
      continue;
    }

    issueCount = issueCount ?? response.search.issueCount;
    queryState = await processResponseData(response, countIteratee);

    queryCost += queryState.rateLimit?.cost ?? 0;

    const exceededMaxResourceLimit =
      pullRequestFetched >= queryParams.maxResourceIngestion;

    const exceededTotalUpdatedPrs = Boolean(
      issueCount && pullRequestFetched >= issueCount,
    );

    paginationComplete =
      !queryState.pullRequests?.hasNextPage ||
      exceededMaxResourceLimit ||
      exceededTotalUpdatedPrs;

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
