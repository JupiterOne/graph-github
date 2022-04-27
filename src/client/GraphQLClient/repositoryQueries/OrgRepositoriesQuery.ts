import { ExecutableQuery } from '../CreateQueryExecutor';
import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  IteratePagination,
  OrgRepoQueryResponse,
  ProcessResponse,
} from '../types';
import paginate from '../paginate';
import utils from '../utils';
import fragments from '../fragments';

interface QueryState extends BaseQueryState {
  repos: CursorState;
}

const MAX_REQUESTS_LIMIT = 100;

/**
 * Builds query and query variables for Org Repos.
 *
 * @param login
 * @param queryState
 */
const buildQuery: BuildQuery<string, QueryState> = (
  login: string,
  queryState?: QueryState,
): ExecutableQuery => {
  const query = `
      query ($login: String!, $maxLimit: Int!, $repoCursor: String) {
        organization(login: $login) {
          id
          repositories(first: $maxLimit, after: $repoCursor) {
            nodes {
              id
					    ...${fragments.repositoryFields}
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
      login,
      maxLimit: MAX_REQUESTS_LIMIT,
      ...(queryState?.repos?.hasNextPage && {
        repoCursor: queryState.repos.endCursor,
      }),
    },
  };
};

/**
 * Processes response data, formatting
 * it in a ready to consumer shape for the iterator.
 * @param responseData
 * @param iteratee
 */
const processResponseData: ProcessResponse<OrgRepoQueryResponse, QueryState> =
  async (responseData, iteratee) => {
    const rateLimit = responseData.rateLimit;
    const repos = responseData.organization?.repositories?.nodes ?? [];

    for (const repo of repos) {
      if (!utils.hasProperties(repo)) {
        continue;
      }

      await iteratee(repo);
    }

    return {
      rateLimit,
      repos: responseData.organization?.repositories?.pageInfo,
    };
  };

/**
 * Iterates, via pagination, over all Org Repositories.
 * @param login - aka the organization id.
 * @param iteratee
 * @param execute
 */
const iterateRepositories: IteratePagination<string, OrgRepoQueryResponse> =
  async (login, execute, iteratee) => {
    return paginate(
      login,
      iteratee,
      execute,
      buildQuery,
      processResponseData,
      (queryState) => !queryState?.repos?.hasNextPage ?? true,
    );
  };

export default { iterateRepositories };
