import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  IteratePagination,
  ProcessResponse,
  TagQueryResponse,
} from '../types';
import paginate from '../paginate';
import utils from '../utils';

interface QueryState extends BaseQueryState {
  tags: CursorState;
}

export interface QueryParams {
  repoName: string;
  repoOwner: string;
  maxLimit: number;
}

const buildQuery: BuildQuery<QueryParams, QueryState> = (
  queryParams,
  queryState,
) => {
  const query = `
    query(
      $repoName: String!
      $repoOwner: String!
      $maxLimit: Int!
      $tagsCursor: String
    ) {
      repository(owner: $repoOwner, name: $repoName) {
        id
        refs(first: $maxLimit, after: $tagsCursor refPrefix: "refs/tags/") {
          nodes {
            id
            name
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }`;

  return {
    query,
    ...(queryState?.rateLimit && {
      rateLimit: queryState.rateLimit,
    }),
    queryVariables: {
      ...queryParams,
      ...(queryState?.tags?.hasNextPage && {
        tagsCursor: queryState.tags.endCursor,
      }),
    },
  };
};

const processResponseData: ProcessResponse<
  TagQueryResponse,
  QueryState
> = async (responseData, iteratee) => {
  const rateLimit = responseData.rateLimit;
  const tags = responseData.repository?.refs?.nodes ?? [];

  for (const tag of tags) {
    if (!utils.hasProperties(tag)) {
      continue;
    }

    await iteratee({
      repoId: responseData.repository?.id,
      ...tag,
    });
  }

  return {
    rateLimit,
    tags: responseData.repository?.refs?.pageInfo,
  };
};

/**
 * Iterates over teams found within an organization
 * @param login aka organization
 * @param execute
 * @param iteratee
 */
const iterateTags: IteratePagination<QueryParams, TagQueryResponse> = async (
  queryParams,
  execute,
  iteratee,
  logger,
) => {
  return paginate(
    queryParams,
    iteratee,
    execute,
    buildQuery,
    processResponseData,
    (queryState) => !queryState?.tags?.hasNextPage ?? true,
    logger,
    'maxLimit',
  );
};

export default { iterateTags };
