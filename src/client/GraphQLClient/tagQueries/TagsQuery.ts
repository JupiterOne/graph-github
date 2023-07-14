import {
  BaseQueryState,
  BuildQuery,
  CursorState,
  IteratePagination,
  ProcessResponse,
  TagQueryResponse,
} from '../types';
import { MAX_REQUESTS_LIMIT } from '../paginate';
import paginate from '../paginate';
import utils from '../utils';

interface QueryState extends BaseQueryState {
  tags: CursorState;
}

export interface QueryParams {
  repoName: string;
  repoOwner: string;
}

// ... on Tag {
//   id
//   message
//   name
//   oid
//   commitUrl
//   commitResourcePath
//   abbreviatedOid
//   tagger {
//     name
//     email
//   }
// }
//
//
//           nodes {
// id
// name
// target {
//   ... on Commit {

//   }
// }
// }

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
        refs(first: $maxLimit, after: $tagsCursor refPrefix: "refs/tags/") {
          edges {
            node {
              ...refInfo
            }
          }
          totalCount
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }

    fragment refInfo on Ref {
      id
      name
      target {
        commitUrl
        oid
        ... on Commit {
          message
          committedDate
          author {
            name
            email
            date
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
      repoName: queryParams.repoName,
      repoOwner: queryParams.repoOwner,
      maxLimit: MAX_REQUESTS_LIMIT,
      ...(queryState?.tags?.hasNextPage && {
        tagsCursor: queryState.tags.endCursor,
      }),
    },
  };
};

const processResponseData: ProcessResponse<TagQueryResponse, QueryState> =
  async (responseData, iteratee) => {
    const rateLimit = responseData.rateLimit;
    const tagEdges = responseData.repository?.refs?.edges ?? [];

    for (const edge of tagEdges) {
      if (!utils.hasProperties(edge?.node)) {
        continue;
      }

      const tag = edge.node;

      await iteratee(tag);
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
) => {
  return paginate(
    queryParams,
    iteratee,
    execute,
    buildQuery,
    processResponseData,
    (queryState) => !queryState?.tags?.hasNextPage ?? true,
  );
};

export default { iterateTags };
