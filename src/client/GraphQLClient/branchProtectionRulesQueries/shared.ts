import utils, { EnterpriseFeatures } from '../utils';

export interface VersionSafeFragments {
  additionalFields: string[];
}

/**
 * Depending on the version of GHE Server, provide a supported query.
 * @param gheServerVersion
 */
export const buildVersionSafeFragments = (
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

  return fragments;
};

export const allowancesFields = (gheServerVersion?: string): string => {
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

  return `
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
        ${actorQueryWithAppFragment}
      }
    }
    reviewDismissalAllowances(first: $maxLimit) {
      nodes {
        ${actorQuery}
      }
    }`;
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

type ActorNode = {
  actor: {
    __typename: 'Team' | 'User' | 'App';
    id: string;
    name?: string;
    databaseId?: number;
    slug?: string;
    login?: string;
  };
};

export const processActors = (actorNodes: ActorNode[]) => {
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

export const branchProtectionRuleFields = (
  versionSafeFragments: VersionSafeFragments,
) => `
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
  bypassForcePushAllowances {
    totalCount
  }
  bypassPullRequestAllowances {
    totalCount
  }
  pushAllowances {
    totalCount
  }
  reviewDismissalAllowances {
    totalCount
  }
`;
