import {
  BaseQueryState,
  BranchProtectionRuleResponse,
  BuildQuery,
  ProcessResponse,
} from '../types';
import { ExecutableQuery } from '../CreateQueryExecutor';
import fragments from '../fragments';
import { MAX_REQUESTS_LIMIT } from '../paginate';
import utils from '../utils';

interface QueryState extends BaseQueryState {
  isInitialQuery?: boolean;
}

export type QueryParams = {
  repoName: string;
  repoOwner: string;
};

const buildQuery: BuildQuery<QueryParams, QueryState> = (
  queryParams,
  queryState,
): ExecutableQuery => {
  const query = `
      query (
        $repoName: String!
        $repoOwner: String!
        $maxLimit: Int!
      ) {
          repository(name: $repoName, owner: $repoOwner) {
            name
            branchProtectionRules(first: $maxLimit) {
              nodes {
                requiresLinearHistory
                requiredApprovingReviewCount
                dismissesStaleReviews
                requiresCodeOwnerReviews
                requiresCommitSignatures
                isAdminEnforced
                allowsForcePushes
                allowsDeletions
                blocksCreations
                requiresConversationResolution
                pattern
                allowsDeletions
                requiresApprovingReviews
                requiredStatusCheckContexts
                creator {
                  login
                }
                databaseId
                requiresStatusChecks
                requiresStrictStatusChecks
                restrictsPushes
                restrictsReviewDismissals
                requiredStatusChecks {
                  context
                  app {
                    id
                    name
                  }
                }
                bypassForcePushAllowances(first: $maxLimit) {
                  nodes {
                    ${actorQuery}
                  }
                }
                bypassPullRequestAllowances(first: $maxLimit) {
                  nodes {
                    ${actorQuery}
                  }
                }
                pushAllowances(first: $maxLimit) {
                  nodes {
                    ${actorQuery}
                  }
                }
                reviewDismissalAllowances(first: $maxLimit) {
                  nodes {
                    ${actorQuery}
                  }
                }
              }
            }
          }
          ...${fragments.rateLimit}
      }
  `;

  return {
    query,
    ...(queryState?.rateLimit && {
      rateLimit: queryState.rateLimit,
    }),
    queryVariables: {
      repoName: queryParams.repoName,
      repoOwner: queryParams.repoOwner,
      maxLimit: MAX_REQUESTS_LIMIT,
    },
  };
};

const actorQuery = `
    actor {
      __typename
      ... on App {
        id
        name
      }
      ... on Team {
        id
        name
      }
      ... on User {
        id
        login
        email
      }
    }`;

const processResponseData: ProcessResponse<
  BranchProtectionRuleResponse,
  QueryState
> = async (responseData, iteratee) => {
  const rateLimit = responseData.rateLimit;
  const rules = responseData.repository?.branchProtectionRules.nodes ?? [];

  for (const rule of rules) {
    if (!utils.hasProperties(rule)) {
      continue;
    }

    const processedRule = {
      ...rule,
      bypassForcePushAllowances: processActors(
        rule.bypassForcePushAllowances?.nodes,
      ),
      bypassPullRequestAllowances: processActors(
        rule.bypassPullRequestAllowances?.nodes,
      ),
      pushAllowances: processActors(rule.pushAllowances?.nodes),
      reviewDismissalAllowances: processActors(
        rule.reviewDismissalAllowances?.nodes,
      ),
    };

    await iteratee(processedRule);
  }

  return {
    rateLimit,
  };
};

type ActorNode = {
  actor: {
    __typename: 'Team' | 'User' | 'App';
    id: string;
    name: string;
    slug?: string;
    login?: string;
  };
};
const processActors = (actorNodes: ActorNode[]) => {
  if (!Array.isArray(actorNodes)) {
    actorNodes = [];
  }

  const actors = actorNodes.map((node) => node?.actor);

  return {
    teams: actors.filter((actor) => actor?.__typename === 'Team'),
    users: actors.filter((actor) => actor?.__typename === 'User'),
    apps: actors.filter((actor) => actor?.__typename === 'App'),
  };
};

const iterateBranchProtectionRules = async (
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

export default { iterateBranchProtectionRules };
