import { ExecutableQuery } from '../CreateQueryExecutor';
import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  IteratePagination,
  OrgTeamRepoQueryResponse,
} from '../types';
import { MAX_REQUESTS_NUM } from '../queries';
import { ResourceIteratee } from '../../../client';

interface QueryState extends BaseQueryState {
  teamRepos?: CursorState;
}
type QueryParams = {
  login: string;
  teamSlug: string;
};

/**
 * Builds query based on params and queryState.
 * @param queryParams
 * @param queryState
 */
const buildQuery: BuildQuery<QueryParams, QueryState> = (
  queryParams,
  queryState,
): ExecutableQuery => {
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
      login: queryParams.login,
      teamSlug: queryParams.teamSlug,
      maxLimit: MAX_REQUESTS_NUM,
      ...(queryState?.teamRepos?.hasNextPage && {
        teamRepoCursor: queryState.teamRepos.endCursor,
      }),
    },
  };
};

/**
 * Processed response data and converting to
 * object format ready for iterator.
 * @param responseData
 * @param iteratee
 */
const processResponseData = async (
  responseData,
  iteratee: ResourceIteratee<OrgTeamRepoQueryResponse>,
): Promise<QueryState> => {
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
};

/**
 * Iterate over repositories assigned to a team.
 * @param queryParams
 * @param iteratee
 * @param execute
 */
const iterateRepositories: IteratePagination<
  QueryParams,
  OrgTeamRepoQueryResponse
> = async (queryParams, iteratee, execute) => {
  let queryCost = 0;
  let queryState: QueryState | undefined = undefined;
  let paginationComplete = false;

  while (!paginationComplete) {
    const executable = buildQuery(queryParams, queryState);

    const response = await execute(executable);

    queryState = await processResponseData(response, iteratee);

    queryCost += queryState.rateLimit?.cost ?? 0;

    paginationComplete = !queryState.teamRepos?.hasNextPage ?? true;
  }

  return {
    rateLimitConsumed: queryCost,
  };
};

export default { iterateRepositories };
