import { ExecutableQuery, QueryExecutor } from '../CreateQueryExecutor';
import { BaseQueryState, CursorState, OrgRepoQueryResponse } from '../types';
import { ResourceIteratee } from '../../../client';

interface QueryState extends BaseQueryState {
  repos: CursorState;
}

const MAX_REQUESTS_LIMIT = 100;

class OrgRepositoriesQuery {
  public static buildQuery(
    login: string,
    queryState?: QueryState,
  ): ExecutableQuery {
    const query = `
      query ($login: String!, $maxLimit: Int!, $repoCursor: String) {
        organization(login: $login) {
          id
          repositories(first: $maxLimit, after: $repoCursor) {
            nodes {
              id
					    ...repositoryFields
            }
            pageInfo {
              endCursor
              hasNextPage
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
        login,
        maxLimit: MAX_REQUESTS_LIMIT,
        ...(queryState?.repos?.hasNextPage && {
          repoCursor: queryState.repos.endCursor,
        }),
      },
    };
  }

  public static async processResponseData(
    responseData,
    iteratee: ResourceIteratee<OrgRepoQueryResponse>,
  ): Promise<QueryState> {
    const rateLimit = responseData.rateLimit;
    const repos = responseData.organization?.repositories?.nodes ?? [];

    for (const repo of repos) {
      if (Object.keys(repo).length === 0) {
        // If there's no data, pass - possible if permissions aren't correct in GHE
        continue;
      }

      await iteratee(repo);
    }

    return {
      rateLimit,
      repos: responseData.organization?.repositories?.pageInfo,
    };
  }

  public static async iterateRepositories(
    login: string,
    iteratee: ResourceIteratee<OrgRepoQueryResponse>,
    execute: QueryExecutor,
  ) {
    let queryCost = 0;
    let queryState: QueryState | undefined = undefined;
    let paginationComplete = false;

    while (!paginationComplete) {
      const executable = this.buildQuery(login, queryState);

      const response = await execute(executable);

      queryState = await this.processResponseData(response, iteratee);

      queryCost += queryState.rateLimit?.cost ?? 0;

      paginationComplete = !queryState.repos?.hasNextPage ?? true;
    }

    return {
      rateLimitConsumed: queryCost,
    };
  }
}

export default OrgRepositoriesQuery;
