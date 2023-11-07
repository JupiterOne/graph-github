import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  IssueResponse,
  IteratePagination,
  ProcessResponse,
} from '../types';
import { ExecutableQuery } from '../CreateQueryExecutor';
import paginate, { MAX_REQUESTS_LIMIT } from '../paginate';
import utils from '../utils';
import fragments from '../fragments';

interface QueryState extends BaseQueryState {
  issues: CursorState;
}

type QueryParams = {
  repoName: string;
  login: string;
  lastExecutionTime: string;
  maxLimit: number;
};

const MAX_RESOURCES_PER_EXECUTION = 500;

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
      $repoName: String!,
      $login: String!
      $since: DateTime!,
      $maxSearchLimit: Int!, 
      $maxInnerLimit: Int!,
      $issuesCursor: String
    ) {
      repository(name: $repoName, owner: $login) {
        id
        name
        issues(first: $maxSearchLimit, after: $issuesCursor, filterBy: { since: $since }) {
          nodes {
            ${fragments.issueFields}
            assignees(first: $maxInnerLimit) {
              nodes {
                name
                login
              }
            }
            labels(first: $maxInnerLimit) {
              nodes {
                id
                name
              }
            }
          }
          pageInfo {
            endCursor
            hasNextPage
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
      login: queryParams.login,
      repoName: queryParams.repoName,
      since: queryParams.lastExecutionTime,
      maxSearchLimit: queryParams.maxLimit,
      maxInnerLimit: MAX_REQUESTS_LIMIT,
      ...(queryState?.issues?.hasNextPage && {
        issuesCursor: queryState?.issues.endCursor,
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
const processResponseData: ProcessResponse<IssueResponse, QueryState> = async (
  responseData,
  iteratee,
) => {
  if (!responseData) {
    throw new Error('responseData param is required');
  }

  console.log('Executed query for repo collaborators');

  const rateLimit = responseData.rateLimit;
  const issues = responseData.repository?.issues?.nodes ?? [];

  for (const issue of issues) {
    if (!utils.hasProperties(issue)) {
      continue;
    }

    const resource = {
      ...issue,
      repoId: responseData.repository?.id,
      repoName: responseData.repository?.name,
      assignees: issue.assignees?.nodes ?? [],
      labels: issue.labels?.nodes ?? [],
    };

    await iteratee(resource);
  }

  return {
    rateLimit,
    issues: responseData.repository?.issues?.pageInfo,
  };
};

/**
 * Iterate issues, with pagination, up to 500.
 * Utilizes queryParams.lastExecutionTime to query the minimal amount.
 * @param queryParams
 * @param iteratee
 * @param execute
 */
const iterateIssues: IteratePagination<QueryParams, IssueResponse> = async (
  queryParams,
  execute,
  iteratee,
  logger,
) => {
  return paginate(
    queryParams,
    iteratee,
    execute,
    buildQuery,
    processResponseData,
    (queryState, issuesFetched) =>
      (!queryState?.issues?.hasNextPage ?? true) ||
      issuesFetched >= MAX_RESOURCES_PER_EXECUTION,
    logger,
    'maxLimit',
  );
};

export default { iterateIssues };
