import {
  BaseQueryState,
  BuildQuery,
  OrgTeamMemberQueryResponse,
  ProcessResponse,
} from '../types';
import { ExecutableQuery } from '../CreateQueryExecutor';
import { MAX_REQUESTS_LIMIT } from '../paginate';
import utils from '../utils';
import fragments from '../fragments';

type QueryState = BaseQueryState;

type QueryParams = {
  teamIds: string[];
};

const buildQuery: BuildQuery<QueryParams, QueryState> = (
  queryParams,
  queryState,
): ExecutableQuery => {
  const query = `
    query (
      $teamIds: [ID!]!,
      $maxLimit: Int!
    ) {
      nodes(ids: $teamIds) {
        ...on Team {
          id
          name
          members(first: $maxLimit) {
            edges {
              node {
                id
                ...${fragments.teamMemberFields}
              }
              ...${fragments.teamMemberEdgeFields}
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
      teamIds: queryParams.teamIds,
      maxLimit: MAX_REQUESTS_LIMIT,
    },
  };
};

const processResponseData: ProcessResponse<
  OrgTeamMemberQueryResponse,
  QueryState
> = async (responseData, iteratee) => {
  const rateLimit = responseData.rateLimit;
  const teams = responseData.nodes ?? [];

  for (const team of teams) {
    const memberEdges = team?.members?.edges ?? [];

    for (const edge of memberEdges) {
      if (!utils.hasProperties(edge?.node)) {
        continue;
      }

      const member = {
        ...edge.node,
        teamId: team.id,
        teamName: team.name,
        role: edge.role,
      };

      await iteratee(member);
    }
  }

  return {
    rateLimit,
    members: responseData.organization?.team?.members?.pageInfo,
  };
};

const iterateMembers = async (queryParams: QueryParams, execute, iteratee) => {
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

export default { iterateMembers };
