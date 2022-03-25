import {
  BaseQueryState,
  BuildQuery,
  Collaborator,
  CursorState,
  IteratePagination,
  ProcessResponse,
} from '../types';
import { MAX_REQUESTS_LIMIT } from '../paginate';
import paginate from '../paginate';
import utils from '../utils';

interface QueryState extends BaseQueryState {
  collaborators: CursorState;
}

type QueryParams = {
  login: string;
  repoName: string;
};

const buildQuery: BuildQuery<QueryParams, QueryState> = (
  queryParams,
  queryState,
) => {
  const query = `
    query ($login: String!, $repoName: String!, $maxLimit: Int!, $collaboratorCursor: String) {
      repository(name: $repoName, owner: $login) {
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
      ...rateLimit
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

const processResponseData: ProcessResponse<Collaborator, QueryState> = async (
  responseData,
  iteratee,
) => {
  const rateLimit = responseData.rateLimit;
  const collaboratorEdges = responseData.repository?.collaborators?.edges ?? [];

  for (const edge of collaboratorEdges) {
    if (!utils.hasProperties(edge?.node)) {
      continue;
    }
    const node = edge.node;

    const collaborator: Collaborator = {
      id: node.id,
      name: node.name,
      login: node.login,
      permission: edge.permission,
      repositoryId: responseData.repository?.id,
    };

    await iteratee(collaborator);
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
const iterateCollaborators: IteratePagination<QueryParams, Collaborator> =
  async (queryParams, execute, iteratee) => {
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
