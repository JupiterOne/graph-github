import { BaseQueryState, CursorState, Issue } from '../types';
import { ExecutableQuery, QueryExecutor } from '../CreateQueryExecutor';
import { ResourceIteratee } from '../../../client';

interface QueryState extends BaseQueryState {
  issues: CursorState;
  rateLimit?: {
    cost: number;
    limit: number;
    remaining: number;
    resetAt: string;
  };
}

const MAX_SEARCH_LIMIT = 25;
const MAX_INNER_LIMIT = 100;
const MAX_FETCHES_PER_EXECUTION = 500;

class IssuesQuery {
  public static buildQuery(
    repoFullName: string,
    lastExecutionTime: string,
    queryState?: QueryState,
  ): ExecutableQuery {
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
        issueQuery: `is:issue repo:${repoFullName} updated:>=${lastExecutionTime}`,
        maxSearchLimit: MAX_SEARCH_LIMIT,
        maxInnerLimit: MAX_INNER_LIMIT,
        ...(queryState?.issues?.hasNextPage && {
          issuesCursor: queryState?.issues.endCursor,
        }),
      },
    };
  }

  public static async processResponseData(
    responseData,
    iteratee: ResourceIteratee<Issue>,
  ): Promise<QueryState> {
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

      await iteratee(this.responseToResource(issue));
    }

    return {
      rateLimit,
      issues: responseData.search.pageInfo,
    };
  }

  private static responseToResource(node) {
    return {
      ...node,
      assignees: node.assignees?.nodes ?? [],
      labels: node.labels?.nodes ?? [],
    };
  }

  public static async iterateIssues(
    repoFullName: string,
    lastExecutionTime: string,
    iteratee: ResourceIteratee<Issue>,
    execute: QueryExecutor,
  ) {
    let issuesFetched = 0;
    let queryCost = 0;
    let queryState: QueryState | undefined = undefined;
    let paginationComplete = false;

    const countIteratee = async (issue) => {
      issuesFetched++;
      await iteratee(issue);
    };

    while (!paginationComplete) {
      const executable = this.buildQuery(
        repoFullName,
        lastExecutionTime,
        queryState,
      );

      const response = await execute(executable);

      queryState = await this.processResponseData(response, countIteratee);

      queryCost += queryState.rateLimit?.cost ?? 0;

      paginationComplete =
        !queryState.issues?.hasNextPage ||
        issuesFetched >= MAX_FETCHES_PER_EXECUTION;
    }

    return {
      rateLimitConsumed: queryCost,
    };
  }
}

export default IssuesQuery;
