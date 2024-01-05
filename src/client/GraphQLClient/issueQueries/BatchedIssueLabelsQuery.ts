import {
  BaseQueryState,
  BuildQuery,
  IssueLabel,
  ProcessResponse,
} from '../types';
import { ExecutableQuery } from '../CreateQueryExecutor';
import { MAX_REQUESTS_LIMIT } from '../paginate';
import utils from '../utils';
import fragments from '../fragments';

type QueryState = BaseQueryState;

type QueryParams = {
  issueIds: string[];
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
      $issueIds: [ID!]!,
      $maxLimit: Int!
    ) {
      nodes(ids: $issueIds) {
        ...on Issue {
          id
          labels(first: $maxLimit) {
            nodes {
              id
              name
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
      issueIds: queryParams.issueIds,
      maxLimit: MAX_REQUESTS_LIMIT,
    },
  };
};

/**
 * Processes response data into a resource object
 * ready to be passed to the iterator.
 * @param responseData
 * @param iteratee
 */
const processResponseData: ProcessResponse<IssueLabel, QueryState> = async (
  responseData,
  iteratee,
) => {
  if (!responseData) {
    throw new Error('responseData param is required');
  }
  const issues = responseData.nodes ?? [];

  const rateLimit = responseData.rateLimit;
  for (const issue of issues) {
    const labelNodes = issue.labels?.nodes ?? [];

    for (const labelNode of labelNodes) {
      if (!utils.hasProperties(labelNode)) {
        continue;
      }

      await iteratee({
        issueId: issue.id,
        ...labelNode,
      });
    }
  }

  return {
    rateLimit,
  };
};

/**
 * Iterate issue labels
 * Utilizes queryParams.lastExecutionTime to query the minimal amount.
 * @param queryParams
 * @param iteratee
 * @param execute
 */
const iterateIssueLabels = async (
  queryParams: QueryParams,
  execute,
  iteratee,
) => {
  let queryState: QueryState = {};
  const executable = buildQuery(queryParams, queryState);
  const response = await execute(executable);
  queryState = await processResponseData(response, iteratee);

  const queryCost = queryState?.rateLimit?.cost ?? 0;

  return {
    totalCost: queryCost,
    limit: queryState?.rateLimit?.limit,
    remaining: queryState?.rateLimit?.remaining,
    resetAt: queryState?.rateLimit?.resetAt,
  };
};

export default { iterateIssueLabels };
