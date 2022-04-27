import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  IteratePagination,
  OrgTeamMemberQueryResponse,
  ProcessResponse,
} from '../types';
import { ExecutableQuery } from '../CreateQueryExecutor';
import paginate from '../paginate';
import utils from '../utils';
import fragments from '../fragments';

interface QueryState extends BaseQueryState {
  members: CursorState;
}

type QueryParams = {
  login: string;
  teamSlug: string;
};

const MAX_REQUESTS_LIMIT = 100;

const buildQuery: BuildQuery<QueryParams, QueryState> = (
  queryParams,
  queryState,
): ExecutableQuery => {
  const query = `query ($login: String!, $teamSlug: String!, $maxLimit: Int!, $memberCursor: String) {
      organization(login: $login) {
        id
        team(slug: $teamSlug) {
          id
          name
          members(first: $maxLimit, after: $memberCursor) {
            edges {
              node {
                id
                ...${fragments.teamMemberFields}
              }
              ...${fragments.teamMemberEdgeFields}
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
      ...(queryState?.members?.hasNextPage && {
        memberCursor: queryState.members.endCursor,
      }),
    },
  };
};

const processResponseData: ProcessResponse<
  OrgTeamMemberQueryResponse,
  QueryState
> = async (responseData, iteratee) => {
  const rateLimit = responseData.rateLimit;
  const memberEdges = responseData.organization?.team?.members?.edges ?? [];

  for (const edge of memberEdges) {
    if (!utils.hasProperties(edge?.node)) {
      continue;
    }

    const member = {
      ...edge.node,
      teamId: responseData.organization.team.id,
      role: edge.role,
    };

    await iteratee(member);
  }

  return {
    rateLimit,
    members: responseData.organization?.team?.members?.pageInfo,
  };
};

const iterateMembers: IteratePagination<
  QueryParams,
  OrgTeamMemberQueryResponse
> = async (queryParams, execute, iteratee) => {
  return paginate(
    queryParams,
    iteratee,
    execute,
    buildQuery,
    processResponseData,
    (queryState) => !queryState?.members?.hasNextPage ?? true,
  );
};

export default { iterateMembers };
