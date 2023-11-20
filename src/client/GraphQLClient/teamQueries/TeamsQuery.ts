import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  IteratePagination,
  OrgTeamQueryResponse,
  ProcessResponse,
} from '../types';
import paginate from '../paginate';
import utils from '../utils';
import fragments from '../fragments';

interface QueryState extends BaseQueryState {
  teams: CursorState;
}

type QueryParams = {
  login: string;
  maxLimit: number;
};

const buildQuery: BuildQuery<QueryParams, QueryState> = (
  queryParams,
  queryState,
) => {
  const query = `
    query ($login: String!, $maxLimit: Int!, $teamCursor: String) {
      organization(login: $login) {
        id
        teams(first: $maxLimit, after: $teamCursor) {
          edges {
            node {
              id
              ...${fragments.teamFields}
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
      ...queryParams,
      ...(queryState?.teams?.hasNextPage && {
        teamCursor: queryState.teams.endCursor,
      }),
    },
  };
};

const processResponseData: ProcessResponse<
  OrgTeamQueryResponse,
  QueryState
> = async (responseData, iteratee) => {
  const rateLimit = responseData.rateLimit;
  const teamEdges = responseData.organization?.teams?.edges ?? [];

  for (const edge of teamEdges) {
    if (!utils.hasProperties(edge?.node)) {
      continue;
    }

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
const iterateTeams: IteratePagination<
  QueryParams,
  OrgTeamQueryResponse
> = async (queryParams, execute, iteratee, logger) => {
  return paginate(
    queryParams,
    iteratee,
    execute,
    buildQuery,
    processResponseData,
    (queryState) => !queryState?.teams?.hasNextPage ?? true,
    logger,
    'maxLimit',
  );
};

export default { iterateTeams };
