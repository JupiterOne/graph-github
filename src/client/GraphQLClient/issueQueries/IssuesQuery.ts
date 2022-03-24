import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  Issue,
  IteratePagination,
  ProcessResponse,
} from '../types';
import { ExecutableQuery } from '../CreateQueryExecutor';
import paginate, { MAX_REQUESTS_LIMIT, MAX_SEARCH_LIMIT } from '../paginate';

interface QueryState extends BaseQueryState {
  issues: CursorState;
}

type QueryParams = {
  repoFullName: string;
  lastExecutionTime: string;
};

const MAX_FETCHES_PER_EXECUTION = 500;

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
      $issueQuery: String!, 
      $maxSearchLimit: Int!, 
      $maxInnerLimit: Int!,
      $issuesCursor: String
    ) {
      search(
        first: $maxSearchLimit, 
        after: $issuesCursor, 
        type: ISSUE, 
        query: $issueQuery
        ) {
          issueCount
          edges {
            node {
            ...issueFields
            
            ... on Issue {
                assignees(first: $maxInnerLimit) {
                  totalCount
                  nodes {
                    name
                    login
                  }
                  pageInfo {
                    endCursor
                    hasNextPage
                  }
                }
              }
              
            ... on Issue {
                labels(first: $maxInnerLimit) {
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
              }
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
      issueQuery: `is:issue repo:${queryParams.repoFullName} updated:>=${queryParams.lastExecutionTime}`,
      maxSearchLimit: MAX_SEARCH_LIMIT,
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
const processResponseData: ProcessResponse<Issue, QueryState> = async (
  responseData,
  iteratee,
) => {
  if (!responseData) {
    throw new Error('responseData param is required');
  }

  const rateLimit = responseData.rateLimit;
  const issueEdges = responseData.search.edges;

  for (const edge of issueEdges) {
    const issue = edge.node;
    if (Object.keys(issue).length === 0) {
      // If there's no data, pass - possible if permissions aren't correct in GHE
      continue;
    }

    const resource = {
      ...issue,
      assignees: issue.assignees?.nodes ?? [],
      labels: issue.labels?.nodes ?? [],
    };

    await iteratee(resource);
  }

  return {
    rateLimit,
    issues: responseData.search.pageInfo,
  };
};

/**
 * Iterate issues, with pagination, up to 500.
 * Utilizes queryParams.lastExecutionTime to query the minimal amount.
 * @param queryParams
 * @param iteratee
 * @param execute
 */
const iterateIssues: IteratePagination<QueryParams, Issue> = async (
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
    (queryState, issuesFetched) =>
      (!queryState?.issues?.hasNextPage ?? true) ||
      issuesFetched >= MAX_FETCHES_PER_EXECUTION,
  );
};

export default { iterateIssues };
