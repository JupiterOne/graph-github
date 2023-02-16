import {
  BaseQueryState,
  BranchProtectionRuleResponse,
  BuildQuery,
  ProcessResponse,
} from '../types';
import { ExecutableQuery } from '../CreateQueryExecutor';
import fragments from '../fragments';
import { MAX_REQUESTS_LIMIT } from '../paginate';
import utils, { EnterpriseFeatures } from '../utils';

interface QueryState extends BaseQueryState {
  isInitialQuery?: boolean;
}

export type QueryParams = {
  repoName: string;
  repoOwner: string;
  gheServerVersion?: string;
};

interface VersionSafeFragments {
  additionalFields: string[];
}

/**
 * Depending on the version of GHE Server, provide a supported query.
 * @param gheServerVersion
 */
const buildVersionSafeFragments = (
  gheServerVersion?: string,
): VersionSafeFragments => {
  const fragments: VersionSafeFragments = {
    additionalFields: [],
  };

  if (
    utils.isSupported(
      EnterpriseFeatures.BRANCH_PROTECTION_RULES_BLOCKS_CREATIONS_FIELD,
      gheServerVersion,
    )
  ) {
    fragments.additionalFields.push('blocksCreations');
  }

  const isAppFragmentSupported = utils.isSupported(
    EnterpriseFeatures.BRANCH_PROTECTION_RULES_APP_MEMBER,
    gheServerVersion,
  );
  const actorQueryWithAppFragment = getActorQuery([
    `... on App {
        id
        name
        databaseId
      }`,
  ]);
  const actorQuery = isAppFragmentSupported
    ? actorQueryWithAppFragment
    : getActorQuery();

  fragments.additionalFields.push(
    `bypassForcePushAllowances(first: $maxLimit) {
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
          ${actorQueryWithAppFragment}
        }
      }
      reviewDismissalAllowances(first: $maxLimit) {
        nodes {
          ${actorQuery}
        }
      }`,
  );

  return fragments;
};

const buildQuery: BuildQuery<QueryParams, QueryState> = (
  queryParams,
  queryState,
): ExecutableQuery => {
  const versionSafeFragments = buildVersionSafeFragments(
    queryParams.gheServerVersion,
  );

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
                id
                requiresLinearHistory
                requiredApprovingReviewCount
                dismissesStaleReviews
                requiresCodeOwnerReviews
                requiresCommitSignatures
                isAdminEnforced
                allowsForcePushes
                allowsDeletions
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
                ${versionSafeFragments.additionalFields.join('\n')}
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

const getActorQuery = (additionalFragments: string[] = []) => `
  actor {
    __typename
    ... on Team {
      id
      name
    }
    ... on User {
      id
      login
      email
    }
    ${additionalFragments.join('\n')}
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
      repoName: responseData.repository.name,
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
    databaseId?: string;
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
