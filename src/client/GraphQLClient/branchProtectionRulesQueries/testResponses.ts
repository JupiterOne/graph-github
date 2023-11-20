const branchProtectionRulesResponses = [
  {
    repository: {
      repoId: 'R_kgDOI2pL-A',
      name: 'reimagined-barnacle',
      branchProtectionRules: {
        nodes: [
          {
            id: 'BPR_sdflk_slkwefoi',
            requiresLinearHistory: false,
            requiredApprovingReviewCount: 2,
            dismissesStaleReviews: false,
            requiresCodeOwnerReviews: false,
            requiresCommitSignatures: true,
            isAdminEnforced: false,
            allowsForcePushes: false,
            allowsDeletions: false,
            blocksCreations: false,
            requiresConversationResolution: false,
            pattern: 'release-*',
            requiresApprovingReviews: true,
            requiredStatusCheckContexts: [],
            creator: {
              login: 'VDubber',
            },
            databaseId: 25221868,
            requiresStatusChecks: false,
            requiresStrictStatusChecks: true,
            restrictsPushes: false,
            restrictsReviewDismissals: false,
            requiredStatusChecks: [],
            bypassPullRequestAllowances: {
              nodes: [
                {
                  actor: {
                    __typename: 'Team',
                    id: 'T_kwDOBfl5Zc4AWFta',
                    name: 'j1-nested-team',
                  },
                },
                {
                  actor: {
                    __typename: 'User',
                    id: 'MDQ6VXNlcjU1NzcxODIz',
                    login: 'adam-in-ict',
                    email: '',
                  },
                },
              ],
            },
          },
          {
            requiresLinearHistory: false,
            requiredApprovingReviewCount: 1,
            dismissesStaleReviews: true,
            requiresCodeOwnerReviews: false,
            requiresCommitSignatures: false,
            isAdminEnforced: true,
            allowsForcePushes: false,
            allowsDeletions: false,
            blocksCreations: false,
            requiresConversationResolution: false,
            pattern: 'main',
            requiresApprovingReviews: true,
            requiredStatusCheckContexts: [],
            creator: {
              login: 'electricgull',
            },
            databaseId: 27924631,
            requiresStatusChecks: true,
            requiresStrictStatusChecks: false,
            restrictsPushes: false,
            restrictsReviewDismissals: false,
            requiredStatusChecks: [],
            bypassPullRequestAllowances: {
              nodes: [
                {
                  actor: {
                    __typename: 'Team',
                    id: 'T_kwDOBfl5Zc4AWFta',
                    name: 'j1-nested-team',
                  },
                },
                {
                  actor: {
                    __typename: 'User',
                    id: 'MDQ6VXNlcjE2NTYyMDg1',
                    login: 'electricgull',
                    email: '',
                  },
                },
              ],
            },
          },
        ],
      },
    },
  },
];

export { branchProtectionRulesResponses };
