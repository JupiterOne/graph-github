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
  const query = `
    query ($login: String!, $maxLimit: Int!, $memberCursor: String) {
      organization(login: $login) {
        samlIdentityProvider {
          externalIdentities(first: $maxLimit, after: $memberCursor) {
            nodes {
              samlIdentity {
                attributes {
                  metadata
                  name
                  value
                }
                emails {
                  primary
                  type
                  value
                }
                familyName
                givenName
                groups
                nameId
                username
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
  OrgExternalIdentifierQueryResponse,
  QueryState
> = async (responseData, iteratee) => {
  const rateLimit = responseData.rateLimit;
  const identityNodes =
    responseData.organization?.samlIdentityProvider?.externalIdentities
      ?.nodes ?? [];

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
