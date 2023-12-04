import { ExecutableQuery } from '../CreateQueryExecutor';
import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  IteratePagination,
  OrgRepoQueryResponse,
  ProcessResponse,
  RepoConnectionFilters,
} from '../types';
import paginate from '../paginate';
import utils from '../utils';
import fragments from '../fragments';

interface QueryState extends BaseQueryState {
  repos: CursorState;
}

type QueryParams = RepoConnectionFilters & {
  login: string;
  maxLimit: number;
};

/**
 * Builds query and query variables for Org Repos.
 *
 * @param login
 * @param queryState
 */
const buildQuery: BuildQuery<QueryParams, QueryState> = (
  queryParams: QueryParams,
  queryState?: QueryState,
): ExecutableQuery => {
  const query = `
      query ($login: String!, $maxLimit: Int!, $repoCursor: String) {
        organization(login: $login) {
          id
          repositories(first: $maxLimit, after: $repoCursor) {
            nodes {
              id
              ...${fragments.repositoryFields(queryParams)}
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
      login: queryParams.login,
      maxLimit: queryParams.maxLimit,
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
const processResponseData: ProcessResponse<
  OrgRepoQueryResponse,
  QueryState
> = async (responseData, iteratee) => {
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
const iterateRepositories: IteratePagination<
  QueryParams,
  OrgRepoQueryResponse
> = async (queryParams, execute, iteratee, logger) => {
  return paginate(
    queryParams,
    iteratee,
    execute,
    buildQuery,
    processResponseData,
    (queryState) => !queryState?.repos?.hasNextPage ?? true,
    logger,
    'maxLimit',
  );
};

export default { iterateRepositories };
