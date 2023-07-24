import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  Label,
  IteratePagination,
  ProcessResponse,
} from '../types';
import { ExecutableQuery } from '../CreateQueryExecutor';
import paginate, { MAX_SEARCH_LIMIT } from '../paginate';
import utils from '../utils';
import fragments from '../fragments';

interface QueryState extends BaseQueryState {
  labels: CursorState;
}

type QueryParams = {
  repoName: string;
  repoOwner: string;
  pullRequestNumber: number;
};

/**
 * Builds query for searching for applicable Labels.
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
      $labelsCursor: String
    ) {
      repository(name: $repoName, owner: $repoOwner) {
        pullRequest(number: $pullRequestNumber) {
          labels(first: $maxLimit, after: $labelsCursor) {
            totalCount
            nodes {
              name
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
      ...(queryState?.labels?.hasNextPage && {
        labelsCursor: queryState?.labels.endCursor,
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
const processResponseData: ProcessResponse<Label, QueryState> = async (
  responseData,
  iteratee,
) => {
  if (!responseData) {
    throw new Error('responseData param is required');
  }

  const rateLimit = responseData.rateLimit;
  const labelNodes = responseData.repository.pullRequest.labels.nodes;

  for (const reviewNode of labelNodes) {
    if (!utils.hasProperties(reviewNode)) {
      continue;
    }

    await iteratee(reviewNode);
  }

  return {
    rateLimit,
    labels: responseData.repository.pullRequest.labels.pageInfo,
  };
};

/**
 * Iterate issues, with pagination, up to 500.
 * Utilizes queryParams.lastExecutionTime to query the minimal amount.
 * @param queryParams
 * @param iteratee
 * @param execute
 */
const iterateLabels: IteratePagination<QueryParams, Label> = async (
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
    (queryState) => !queryState?.labels?.hasNextPage ?? true,
  );
};

export default { iterateLabels };
