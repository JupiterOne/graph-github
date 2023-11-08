import {
  BaseQueryState,
  BuildQuery,
  CollaboratorResponse,
  ProcessResponse,
} from '../types';
import { MAX_REQUESTS_LIMIT } from '../paginate';
import utils from '../utils';
import fragments from '../fragments';

type QueryState = BaseQueryState;

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
    ) {
      nodes(ids: $repoIds) {
        ...on Repository {
          id
          collaborators(first: $maxLimit) {
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
    },
  };
};

const processResponseData: ProcessResponse<
  CollaboratorResponse,
  QueryState
> = async (responseData, iteratee) => {
  const rateLimit = responseData.rateLimit;
  const repositories = responseData.nodes ?? [];

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
  };
};

/**
 * Paginates over the collaborators found on the given repo.
 * @param queryParams
 * @param execute
 * @param iteratee
 */
const iterateCollaborators = async (
  queryParams: QueryParams,
  execute,
  iteratee,
) => {
  let queryState: QueryState = {};
  const executable = buildQuery(queryParams, queryState);
  const response = await execute(executable);
  queryState = await processResponseData(response, iteratee);

  const queryCost = queryState?.rateLimit?.cost ?? 0;

  return {
    totalCost: queryCost,
    limit: queryState?.rateLimit?.limit,
    remaining: queryState?.rateLimit?.remaining,
    resetAt: queryState?.rateLimit?.resetAt,
  };
};

export default { iterateCollaborators };
