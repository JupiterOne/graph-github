import { ExecutableQuery } from '../CreateQueryExecutor';
import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  IteratePagination,
  OrgMemberQueryResponse,
  ProcessResponse,
} from '../types';
import paginate from '../paginate';
import utils from '../utils';
import fragments from '../fragments';

interface QueryState extends BaseQueryState {
  members: CursorState;
}

type QueryParams = {
  login: string;
  maxLimit: number;
};

/**
 * Builds query and query variables for Org Members.
 * @param login
 * @param queryState
 */
const buildQuery: BuildQuery<QueryParams, QueryState> = (
  queryParams,
  queryState,
): ExecutableQuery => {
  const query = `
    query ($login: String!, $maxLimit: Int!, $memberCursor: String) {
      organization(login: $login) {
        id
        membersWithRole(first: $maxLimit, after: $memberCursor) {
          edges {
            node {
              id
              ...${fragments.userFields}
            }
            ...${fragments.userEdgeFields}
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
      ...(queryState?.members?.hasNextPage && {
        memberCursor: queryState.members.endCursor,
      }),
    },
  };
};

/**
 * Processes data into a shape ready for the iterator.
 * @param responseData
 * @param iteratee
 */
const processResponseData: ProcessResponse<
  OrgMemberQueryResponse,
  QueryState
> = async (responseData, iteratee) => {
  const rateLimit = responseData.rateLimit;
  const memberEdges = responseData.organization?.membersWithRole?.edges ?? [];

  for (const edge of memberEdges) {
    if (!utils.hasProperties(edge?.node)) {
      continue;
    }

    const member = {
      ...edge.node,
      organization: responseData.organization?.id,
      hasTwoFactorEnabled: edge.hasTwoFactorEnabled,
      role: edge.role,
    };

    await iteratee(member);
  }

  return {
    rateLimit,
    members: responseData.organization?.membersWithRole?.pageInfo,
  };
};

const iterateMembers: IteratePagination<
  QueryParams,
  OrgMemberQueryResponse
> = async (queryParams, execute, iteratee, logger) => {
  return paginate(
    queryParams,
    iteratee,
    execute,
    buildQuery,
    processResponseData,
    (queryState) => !queryState?.members?.hasNextPage ?? true,
    logger,
    'maxLimit',
  );
};

export default { iterateMembers };
