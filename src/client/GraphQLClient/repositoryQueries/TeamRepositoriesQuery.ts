import { ExecutableQuery } from '../CreateQueryExecutor';
import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  IteratePagination,
  OrgTeamRepoQueryResponse,
  ProcessResponse,
} from '../types';
import paginate from '../paginate';
import utils from '../utils';
import fragments from '../fragments';
import { teamReposFields } from './shared';

interface QueryState extends BaseQueryState {
  teamRepos?: CursorState;
}
type QueryParams = {
  login: string;
  teamSlug: string;
  maxLimit: number;
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
              repositories(first: $maxLimit, after: $teamRepoCursor) {
                ${teamReposFields}
                pageInfo {
                  endCursor
                  hasNextPage
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
      ...queryParams,
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
const processResponseData: ProcessResponse<
  OrgTeamRepoQueryResponse,
  QueryState
> = async (responseData, iteratee) => {
  const rateLimit = responseData.rateLimit;
  const edges = responseData.organization?.team?.repositories?.edges ?? [];

  for (const edge of edges) {
    if (!utils.hasProperties(edge?.node)) {
      continue;
    }

    const repo = {
      id: edge.node.id,
      permission: edge.permission,
      teamId: responseData.organization?.team?.id,
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
> = async (queryParams, execute, iteratee, logger) => {
  return paginate(
    queryParams,
    iteratee,
    execute,
    buildQuery,
    processResponseData,
    (queryState) => !queryState?.teamRepos?.hasNextPage ?? true,
    logger,
    'maxLimit',
  );
};

export default { iterateRepositories };
