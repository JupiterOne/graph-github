import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  IteratePagination,
  OrgTeamQueryResponse,
  ProcessResponse,
} from '../types';
import { MAX_REQUESTS_NUM } from '../queries';
import paginate from '../paginate';

interface QueryState extends BaseQueryState {
  teams: CursorState;
}

const buildQuery: BuildQuery<string, QueryState> = (login, queryState) => {
  const query = `
    query ($login: String!, $maxLimit: Int!, $teamCursor: String) {
      organization(login: $login) {
        id
        teams(first: $maxLimit, after: $teamCursor) {
          edges {
            node {
              id
            ...teamFields
            }
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
      maxLimit: MAX_REQUESTS_NUM,
      ...(queryState?.teams?.hasNextPage && {
        teamCursor: queryState.teams.endCursor,
      }),
    },
  };
};

const processResponseData: ProcessResponse<OrgTeamQueryResponse, QueryState> =
  async (responseData, iteratee) => {
    const rateLimit = responseData.rateLimit;
    const teamEdges = responseData.organization?.teams?.edges ?? [];

    for (const edge of teamEdges) {
      const team = edge.node;

      await iteratee(team);
    }

    return {
      rateLimit,
      teams: responseData.organization?.teams?.pageInfo,
    };
  };

/**
 * Iterates over teams found within an organization
 * @param login aka organization
 * @param execute
 * @param iteratee
 */
const iterateTeams: IteratePagination<string, OrgTeamQueryResponse> = async (
  login,
  execute,
  iteratee,
) => {
  return paginate(
    login,
    iteratee,
    execute,
    buildQuery,
    processResponseData,
    (queryState) => !queryState?.teams?.hasNextPage ?? true,
  );
};

export default { iterateTeams };
