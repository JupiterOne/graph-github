import {
  BaseQueryState,
  BuildQuery,
  CollaboratorResponse,
  CursorState,
  IteratePagination,
  ProcessResponse,
} from '../types';
import { MAX_REQUESTS_LIMIT } from '../paginate';
import paginate from '../paginate';
import utils from '../utils';
import fragments from '../fragments';

interface QueryState extends BaseQueryState {
  collaborators: CursorState;
}

type QueryParams = {
  repoIds: string[];
};

const buildQuery: BuildQuery<QueryParams, QueryState> = (
  queryParams,
  queryState,
) => {
  const query = `
    query (
      $repoIds: [ID!]!
      $maxLimit: Int!
      $collaboratorCursor: String
    ) {
      nodes(ids: $repoIds) {
        ...on Repository {
          id
          collaborators(first: $maxLimit, after: $collaboratorCursor) {
            edges {
              node {
                id
                name
                login
              }
              permission
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
      maxLimit: MAX_REQUESTS_LIMIT,
      ...(queryState?.collaborators?.hasNextPage && {
        collaboratorCursor: queryState.collaborators.endCursor,
      }),
    },
  };
};

const processResponseData: ProcessResponse<
  CollaboratorResponse,
  QueryState
> = async (responseData, iteratee) => {
  const rateLimit = responseData.rateLimit;
  const repositories = responseData.nodes ?? [];

  console.log(
    'Executed batched query for repo collaborators',
    repositories.map((r) => r.id),
  );

  for (const repository of repositories) {
    const collaboratorEdges = repository.collaborators?.edges ?? [];
    for (const edge of collaboratorEdges) {
      if (!utils.hasProperties(edge?.node)) {
        continue;
      }
      const node = edge.node;

      const collaborator: CollaboratorResponse = {
        id: node.id,
        name: node.name,
        login: node.login,
        permission: edge.permission,
        repositoryId: repository?.id,
      };

      await iteratee(collaborator);
    }
  }

  return {
    rateLimit,
    collaborators: responseData.repository?.collaborators?.pageInfo,
  };
};

/**
 * Paginates over the collaborators found on the given repo.
 * @param queryParams
 * @param execute
 * @param iteratee
 */
const iterateCollaborators: IteratePagination<
  QueryParams,
  CollaboratorResponse
> = async (queryParams, execute, iteratee) => {
  return paginate(
    queryParams,
    iteratee,
    execute,
    buildQuery,
    processResponseData,
    (queryState) => !queryState?.collaborators?.hasNextPage ?? true,
  );
};

export default { iterateCollaborators };
