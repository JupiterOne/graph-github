import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  Commit,
  IteratePagination,
  ProcessResponse,
} from '../types';
import { ExecutableQuery } from '../CreateQueryExecutor';
import paginate, { MAX_SEARCH_LIMIT } from '../paginate';
import utils from '../utils';
import fragments from '../fragments';

interface QueryState extends BaseQueryState {
  commits: CursorState;
}

type QueryParams = {
  repoName: string;
  repoOwner: string;
  pullRequestNumber: number;
};

/**
 * Builds query for searching for applicable Commits.
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
      $commitsCursor: String
    ) {
      repository(name: $repoName, owner: $repoOwner) {
        pullRequest(number: $pullRequestNumber) {
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
      maxLimit: MAX_SEARCH_LIMIT,
      pullRequestNumber: queryParams.pullRequestNumber,
      repoName: queryParams.repoName,
      repoOwner: queryParams.repoOwner,
      ...(queryState?.commits?.hasNextPage && {
        commitsCursor: queryState?.commits.endCursor,
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
const processResponseData: ProcessResponse<Commit, QueryState> = async (
  responseData,
  iteratee,
) => {
  if (!responseData) {
    throw new Error('responseData param is required');
  }

  const rateLimit = responseData.rateLimit;
  const commitNodes = responseData.repository.pullRequest.commits.nodes;

  for (const commitNode of commitNodes) {
    if (!utils.hasProperties(commitNode.commit)) {
      continue;
    }

    await iteratee(commitNode.commit);
  }

  return {
    rateLimit,
    commits: responseData.repository.pullRequest.commits.pageInfo,
  };
};

/**
 * Iterate issues, with pagination, up to 500.
 * Utilizes queryParams.lastExecutionTime to query the minimal amount.
 * @param queryParams
 * @param iteratee
 * @param execute
 */
const iterateCommits: IteratePagination<QueryParams, Commit> = async (
  queryParams,
  execute,
  iteratee,
) => {
  return paginate(
    queryParams,
    iteratee,
    execute,
    buildQuery,
    processResponseData,
    (queryState) => !queryState?.commits?.hasNextPage ?? true,
  );
};

export default { iterateCommits };
