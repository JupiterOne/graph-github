import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  IteratePagination,
  ProcessResponse,
  TopicQueryResponse,
} from '../types';
import paginate from '../paginate';
import utils from '../utils';

interface QueryState extends BaseQueryState {
  topics: CursorState;
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
      $topicsCursor: String
    ) {
      repository(owner: $repoOwner, name: $repoName) {
        id
        repositoryTopics(first: $maxLimit, after: $topicsCursor) {
          nodes {
            topic {
              id
              name
            }
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
      ...(queryState?.topics?.hasNextPage && {
        topicsCursor: queryState.topics.endCursor,
      }),
    },
  };
};

const processResponseData: ProcessResponse<
  TopicQueryResponse,
  QueryState
> = async (responseData, iteratee) => {
  const rateLimit = responseData.rateLimit;
  const topics = responseData.repository?.repositoryTopics?.nodes ?? [];

  for (const topic of topics.map((t) => t.topic)) {
    if (!utils.hasProperties(topic)) {
      continue;
    }

    await iteratee({
      repoId: responseData.repository?.id,
      ...topic,
    });
  }

  return {
    rateLimit,
    topics: responseData.repository?.repositoryTopics?.pageInfo,
  };
};

/**
 * Iterates over topics found in a repository
 * @param queryParams
 * @param execute
 * @param iteratee
 */
const iterateTopics: IteratePagination<
  QueryParams,
  TopicQueryResponse
> = async (queryParams, execute, iteratee, logger) => {
  return paginate(
    queryParams,
    iteratee,
    execute,
    buildQuery,
    processResponseData,
    (queryState) => !queryState?.topics?.hasNextPage ?? true,
    logger,
    'maxLimit',
  );
};

export default { iterateTopics };
