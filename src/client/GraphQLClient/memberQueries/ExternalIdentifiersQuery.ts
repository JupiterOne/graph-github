import { ExecutableQuery } from '../CreateQueryExecutor';
import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  IteratePagination,
  OrgExternalIdentifierQueryResponse,
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
  /**
   * If enterpriseSlug is set then the query will be made on enterprise-level.
   */
  enterpriseSlug: string | undefined;
  maxLimit: number;
};

/**
 * Builds query and query variables for Org external identifiers.
 * @param login
 * @param queryState
 */
const buildQuery: BuildQuery<QueryParams, QueryState> = (
  queryParams,
  queryState,
): ExecutableQuery => {
  const query = rootQuery(
    queryParams,
    `samlIdentityProvider {
        externalIdentities(first: $maxLimit, after: $memberCursor) {
          nodes {
            samlIdentity {
              nameId
            }
            user {
              login
            }
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }`,
  );

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

function rootQuery(queryParams: QueryParams, subQuery: string) {
  if (queryParams.enterpriseSlug) {
    return `query ($enterpriseSlug: String!, $maxLimit: Int!, $memberCursor: String) {
      enterprise(slug: $enterpriseSlug) {
        ownerInfo {
          ${subQuery}
        }
      }
      ...${fragments.rateLimit}
    }`;
  }

  return `query ($login: String!, $maxLimit: Int!, $memberCursor: String) {
    organization(login: $login) {
      ${subQuery}
    }
    ...${fragments.rateLimit}
  }`;
}

/**
 * Processes data into a shape ready for the iterator.
 * @param responseData
 * @param iteratee
 */
const processResponseData: ProcessResponse<
  OrgExternalIdentifierQueryResponse,
  QueryState
> = async (responseData, iteratee) => {
  const rateLimit = responseData.rateLimit;

  let root = responseData.organization;
  if (!root) {
    root = responseData.enterprise?.ownerInfo;
  }
  const identityNodes =
    root?.samlIdentityProvider?.externalIdentities?.nodes ?? [];

  for (const node of identityNodes) {
    if (!utils.hasProperties(node)) {
      continue;
    }

    await iteratee(node);
  }

  return {
    rateLimit,
    members:
      responseData.organization?.samlIdentityProvider?.externalIdentities
        ?.pageInfo,
  };
};

const iterateExternalIdentifiers: IteratePagination<
  QueryParams,
  OrgExternalIdentifierQueryResponse
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

export default { iterateExternalIdentifiers };
