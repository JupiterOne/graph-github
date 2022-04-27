import { ExecutableQuery } from '../CreateQueryExecutor';
import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  IteratePagination,
  OrgTeamRepoQueryResponse,
  ProcessResponse,
} from '../types';
import { MAX_REQUESTS_LIMIT } from '../paginate';
import paginate from '../paginate';
import utils from '../utils';
import fragments from '../fragments';

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
                  ...on TeamRepositoryEdge {
                    permission
                  }
                }
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
      login: queryParams.login,
      teamSlug: queryParams.teamSlug,
      maxLimit: MAX_REQUESTS_LIMIT,
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
> = async (queryParams, execute, iteratee) => {
  return paginate(
    queryParams,
    iteratee,
    execute,
    buildQuery,
    processResponseData,
    (queryState) => !queryState?.teamRepos?.hasNextPage ?? true,
  );
};

export default { iterateRepositories };
