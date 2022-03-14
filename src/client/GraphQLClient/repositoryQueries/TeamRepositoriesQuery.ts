import { ExecutableQuery, QueryExecutor } from '../CreateQueryExecutor';
import {
  BaseQueryState,
  CursorState,
  OrgTeamRepoQueryResponse,
} from '../types';
import { MAX_REQUESTS_NUM } from '../queries';
import { ResourceIteratee } from '../../../client';

interface QueryState extends BaseQueryState {
  teamRepos?: CursorState;
}

class TeamRepositoriesQuery {
  private static buildQuery(
    login: string,
    teamSlug: string,
    queryState?: QueryState,
  ): ExecutableQuery {
    const query = `
      query (
        $login: String!
        $teamSlug: String!
        $maxLimit: Int!
        $teamRepoCursor: String
      ) {
          organization(login: $login) {
            id
            team(slug: $teamSlug) {
              id
              name
              repositories(first: $maxLimit, after: $teamRepoCursor) {
                edges {
                  node {
                    id
                  }
                  ...teamRepositoryEdgeFields
                }
                pageInfo {
                  endCursor
                  hasNextPage
                }
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
        teamSlug,
        maxLimit: MAX_REQUESTS_NUM,
        ...(queryState?.teamRepos?.hasNextPage && {
          teamRepoCursor: queryState.teamRepos.endCursor,
        }),
      },
    };
  }

  private static async processResponseData(
    responseData,
    iteratee: ResourceIteratee<OrgTeamRepoQueryResponse>,
  ): Promise<QueryState> {
    const rateLimit = responseData.rateLimit;
    const edges = responseData.organization?.team?.repositories?.edges ?? [];

    for (const edge of edges) {
      if (Object.keys(edge).length === 0) {
        // If there's no data, pass - possible if permissions aren't correct in GHE
        continue;
      }

      const repo = {
        id: edge.node.id,
        permission: edge.permission,
      };

      await iteratee(repo);
    }

    return {
      rateLimit,
      teamRepos: responseData.organization?.team?.repositories?.pageInfo,
    };
  }

  /**
   * Iterate over repositories assigned to a team.
   * @param login
   * @param teamSlug
   * @param iteratee
   * @param execute
   */
  public static async iterateRepositories(
    login: string,
    teamSlug: string,
    iteratee: ResourceIteratee<OrgTeamRepoQueryResponse>,
    execute: QueryExecutor,
  ) {
    let queryCost = 0;
    let queryState: QueryState | undefined = undefined;
    let paginationComplete = false;

    while (!paginationComplete) {
      const executable = this.buildQuery(login, teamSlug, queryState);

      const response = await execute(executable);

      queryState = await this.processResponseData(response, iteratee);

      queryCost += queryState.rateLimit?.cost ?? 0;

      paginationComplete = !queryState.teamRepos?.hasNextPage ?? true;
    }

    return {
      rateLimitConsumed: queryCost,
    };
  }
}

export default TeamRepositoriesQuery;
