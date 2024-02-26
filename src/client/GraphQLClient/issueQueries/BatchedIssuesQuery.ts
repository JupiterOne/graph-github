import {
  BaseQueryState,
  BuildQuery,
  IssueResponse,
  ProcessResponse,
} from '../types';
import { ExecutableQuery } from '../CreateQueryExecutor';
import { MAX_REQUESTS_LIMIT } from '../paginate';
import utils from '../utils';
import fragments from '../fragments';

type QueryState = BaseQueryState;

type QueryParams = {
  repoIds: string[];
  ingestStartDatetime: string;
};

/**
 * Builds query for searching for applicable Issues.
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
    query(
      $repoIds: [ID!]!,
      $since: DateTime!,
      $maxSearchLimit: Int!, 
    ) {
      nodes(ids: $repoIds) {
        ...on Repository {
          id
          name
          issues(first: $maxSearchLimit, filterBy: { since: $since }) {
            nodes {
              ${fragments.issueFields}
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
      repoIds: queryParams.repoIds,
      since: queryParams.ingestStartDatetime,
      maxSearchLimit: MAX_REQUESTS_LIMIT,
    },
  };
};

/**
 * Processes response data into a resource object
 * ready to be passed to the iterator.
 * @param responseData
 * @param iteratee
 */
const processResponseData: ProcessResponse<IssueResponse, QueryState> = async (
  responseData,
  iteratee,
) => {
  if (!responseData) {
    throw new Error('responseData param is required');
  }

  const rateLimit = responseData.rateLimit;
  const repositories = responseData.nodes ?? [];

  for (const repository of repositories) {
    const issues = repository?.issues?.nodes ?? [];
    for (const issue of issues) {
      if (!utils.hasProperties(issue)) {
        continue;
      }

      const resource = {
        ...issue,
        repoId: repository.id,
        repoName: repository.name,
        assignees: { totalCount: issue.assignees?.totalCount ?? 0 },
        labels: { totalCount: issue.labels?.totalCount ?? 0 },
      };

      await iteratee(resource);
    }
  }

  return {
    rateLimit,
  };
};

/**
 * Iterate issues, with pagination, up to 500.
 * Utilizes queryParams.ingestStartDatetime to query the minimal amount.
 * @param queryParams
 * @param iteratee
 * @param execute
 */
const iterateIssues = async (queryParams: QueryParams, execute, iteratee) => {
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

export default { iterateIssues };
