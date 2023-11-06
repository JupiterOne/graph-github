import { ExecutableQuery } from '../CreateQueryExecutor';
import {
  BaseQueryState,
  BuildQuery,
  OrgTeamRepoQueryResponse,
  ProcessResponse,
} from '../types';
import { MAX_REQUESTS_LIMIT } from '../paginate';
import utils from '../utils';
import fragments from '../fragments';
import { teamReposFields } from './shared';

type QueryState = BaseQueryState;

type QueryParams = {
  teamIds: string[];
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
      $teamIds: [ID!]!
      $maxLimit: Int!
    ) {
      nodes(ids: $teamIds) {
        ...on Team {
          id
          repositories(first: $maxLimit) {
            ${teamReposFields}
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
      maxLimit: MAX_REQUESTS_LIMIT,
    },
  };
};

/**
 * Processed response data and converting to
 * object format ready for iterator.
 * @param responseData
 * @param iteratee
 */
const processResponseData: ProcessResponse<
  OrgTeamRepoQueryResponse,
  QueryState
> = async (responseData, iteratee) => {
  const rateLimit = responseData.rateLimit;
  const teams = responseData.nodes ?? [];

  console.log(
    'Executed batched query for team repos',
    teams.map((t) => t.id),
  );

  for (const team of teams) {
    const edges = team.repositories?.edges ?? [];
    for (const edge of edges) {
      if (!utils.hasProperties(edge?.node)) {
        continue;
      }
      const repo = {
        id: edge.node.id,
        permission: edge.permission,
        teamId: team.id,
      };
      await iteratee(repo);
    }
  }

  return {
    rateLimit,
  };
};

/**
 * Iterate over repositories assigned to a team.
 * @param queryParams
 * @param iteratee
 * @param execute
 */
const iterateRepositories = async (
  queryParams: QueryParams,
  execute,
  iteratee,
) => {
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

export default { iterateRepositories };
