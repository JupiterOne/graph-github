/**
 * Multiple PR responses.
 */

const pullRequestsPublic = [
  {
    search: {
      issueCount: 3,
      edges: [
        {
          node: {
            id: 'MDExOlB1bGxSZXF1ZXN0MTA=',
            title: 'Update CHANGELOG.md',
            closed: false,
          },
        },
        {
          node: {
            id: 'MDExOlB1bGxSZXF1ZXN0OQ==',
            title: 'Create CHANGELOG.md #2',
            closed: false,
            mergeCommit: {
              id: 'C_kwDOIAVVA9oAKDg1NjNlOWIyZDYzMzRiNzUwZjhmN2I2MzA4NTgxODg5NTBkMmFiOTI',
              oid: '8563e9b2d6334b750f8f7b630858188950d2ab92',
              associatedPullRequests: {
                nodes: [
                  {
                    number: 2,
                    id: 'PR_kwDOIAVVA84_DshD',
                    state: 'MERGED',
                    reviewDecision: null,
                    url: 'https://github.com/j1-ingest/ubiquitous-umbrella/pull/2',
                  },
                ],
              },
            },
          },
        },
      ],
      pageInfo: {
        endCursor: 'Y3Vyc29yOjI=',
        hasNextPage: true,
      },
    },
    rateLimit: {
      cost: 2,
    },
  },
  {
    search: {
      issueCount: 3,
      edges: [
        {
          node: {
            id: 'pr3',
            title: 'Update CHANGELOG.md - page 2',
            closed: false,
          },
        },
      ],
      pageInfo: {
        endCursor: 'zxcvee=',
        hasNextPage: false,
      },
    },
    rateLimit: {
      cost: 1,
    },
  },
];

const pullRequestsPublicInnerPagination = {
  search: {
    issueCount: 3,
    edges: [
      {
        node: {
          id: 'MDExOlB1bGxSZXF1ZXN0OQ==',
          title: 'pullRequestsPublicInnerPagination',
          headRepository: {
            name: 'musical-palm-tree',
            owner: {
              login: 'J1-Test',
            },
          },
        },
      },
    ],
    pageInfo: {
      endCursor: 'Y3Vyc29yOjI=',
      hasNextPage: false,
    },
  },
  rateLimit: {
    cost: 1,
  },
};

const emptyPullRequest = [
  {
    search: {
      issueCount: 0,
      edges: [],
      pageInfo: {
        endCursor: null,
        hasNextPage: false,
      },
    },
    rateLimit: {
      cost: 1,
    },
  },
];

export {
  pullRequestsPublic,
  pullRequestsPublicInnerPagination,
  emptyPullRequest,
};

/**
 * Single Query Responses
 */

const singleQueryFullResponse = {
  repository: {
    pullRequest: {
      id: 'MDExOlB1bGxSZXF1ZXN0MTA=',
      title: 'Update CHANGELOG.md',
      mergeCommit: {
        id: 'C_kwDOIAVVA9oAKDg1NjNlOWIyZDYzMzRiNzUwZjhmN2I2MzA4NTgxODg5NTBkMmFiOTI',
        associatedPullRequests: {
          nodes: [
            {
              number: 2,
              id: 'PR_kwDOIAVVA84_DshD',
              state: 'MERGED',
              reviewDecision: null,
              url: 'https://github.com/j1-ingest/ubiquitous-umbrella/pull/2',
            },
          ],
        },
      },
      commits: {
        totalCount: 1,
        nodes: [
          {
            commit: {
              id: 'commit1',
            },
          },
        ],
        pageInfo: {
          endCursor: 'MQ',
          hasNextPage: false,
        },
      },
      reviews: {
        totalCount: 2,
        nodes: [
          {
            id: 'review1',
          },
          {
            id: 'review2',
          },
        ],
        pageInfo: {
          endCursor: 'Y3Vyc29yOnYyOpO0M',
          hasNextPage: true,
        },
      },
      labels: {
        totalCount: 4,
        nodes: [
          {
            id: 'label1=',
            name: 'bug',
          },
          {
            id: 'label2=',
            name: 'documentation',
          },
        ],
        pageInfo: {
          endCursor: 'Y3Vyc2==',
          hasNextPage: true,
        },
      },
    },
  },
  rateLimit: {
    limit: 5000,
    cost: 1,
    remaining: 4998,
    resetAt: '2022-03-07T22:04:07Z',
  },
};

const singleQueryWithPartialInnerResources = {
  repository: {
    pullRequest: {
      id: 'MDExOlB1bGxSZXF1ZXN0MTA=',
      title: 'singleQueryWithPartialInnerResources',
      commits: {
        totalCount: 1,
        nodes: [
          {
            commit: {
              id: 'MDY6',
            },
          },
        ],
        pageInfo: {
          endCursor: 'MQ',
          hasNextPage: false,
        },
      },
      labels: {
        totalCount: 3,
        nodes: [
          {
            id: 'MDU6TGFiZWwxODE=',
            name: 'bug',
          },
          {
            id: 'MDU6TGFiZWwxODI=',
            name: 'documentation',
          },
        ],
        pageInfo: {
          endCursor: 'Y3Vyc2==',
          hasNextPage: true,
        },
      },
    },
  },
  rateLimit: {
    limit: 5000,
    cost: 1,
    remaining: 4998,
    resetAt: '2022-03-07T22:04:07Z',
  },
};

const singleQueryInnerResourcePaginationComplete = {
  repository: {
    pullRequest: {
      id: 'MDExOlB1bGxSZXF1ZXN0MTA=',
      title: 'innerResourcePaginationComplete',
      commits: {
        totalCount: 1,
        nodes: [],
        pageInfo: {
          endCursor: null,
          hasNextPage: false,
        },
      },
      reviews: {
        totalCount: 3,
        nodes: [
          {
            id: 'review3==',
          },
        ],
        pageInfo: {
          endCursor: 'bowek',
          hasNextPage: false,
        },
      },
      labels: {
        totalCount: 4,
        nodes: [
          {
            id: 'label3=',
            name: 'first-task',
          },
          {
            id: 'label4=',
            name: 'feature',
          },
        ],
        pageInfo: {
          endCursor: 'sdvksdf2',
          hasNextPage: false,
        },
      },
    },
  },
  rateLimit: {
    limit: 5000,
    cost: 1,
    remaining: 4999,
    resetAt: '2022-03-08T20:46:50Z',
  },
};

const commitsQueryResponse = [
  {
    repository: {
      pullRequest: {
        id: 'MDExOlB1bGxSZXF1ZXN0MTA=',
        commits: {
          totalCount: 3,
          nodes: [
            {
              commit: {
                oid: 'f5294eb2f1545eb113d3d3d5a7f3977934a13798',
                message: 'README Update',
                authoredDate: '2023-05-15T14:05:06Z',
                author: { user: { login: 'nealajpatel' } },
              },
            },
            {
              commit: {
                oid: '3b00cc1814bc8e93d2676f48494118a339d41839',
                message: 'README Update',
                authoredDate: '2023-05-15T14:04:53Z',
                author: { user: { login: 'nealajpatel' } },
              },
            },
          ],
          pageInfo: { endCursor: 'MQ', hasNextPage: true },
        },
      },
    },
    rateLimit: {
      limit: 5000,
      cost: 2,
      remaining: 5000,
      resetAt: '2023-07-17T21:41:33Z',
    },
  },
  {
    repository: {
      pullRequest: {
        id: 'MDExOlB1bGxSZXF1ZXN0MTA=',
        commits: {
          totalCount: 3,
          nodes: [
            {
              commit: {
                oid: 'c3d5ca5b1a7e39d8f541e815c437d04579677b67',
                message: 'test PR',
                authoredDate: '2023-07-10T20:54:45Z',
                author: { user: null },
              },
            },
          ],
          pageInfo: { endCursor: null, hasNextPage: false },
        },
      },
    },
    rateLimit: {
      limit: 5000,
      cost: 1,
      remaining: 4998,
      resetAt: '2023-07-17T21:41:33Z',
    },
  },
];

const labelsQueryResponse = [
  {
    repository: {
      pullRequest: {
        id: 'MDExOlB1bGxSZXF1ZXN0MTA=',
        labels: {
          totalCount: 1,
          nodes: [{ name: 'dependencies' }, { name: 'automation' }],
          pageInfo: { endCursor: 'MQ', hasNextPage: true },
        },
      },
    },
    rateLimit: {
      limit: 5000,
      cost: 2,
      remaining: 5000,
      resetAt: '2023-07-17T22:41:34Z',
    },
  },
  {
    repository: {
      pullRequest: {
        id: 'MDExOlB1bGxSZXF1ZXN0MTA=',
        labels: {
          totalCount: 1,
          nodes: [{ name: 'release' }],
          pageInfo: { endCursor: null, hasNextPage: false },
        },
      },
    },
    rateLimit: {
      limit: 5000,
      cost: 1,
      remaining: 4998,
      resetAt: '2023-07-17T22:41:34Z',
    },
  },
];

const reviewsQueryResponse = [
  {
    repository: {
      pullRequest: {
        id: 'MDExOlB1bGxSZXF1ZXN0MTA=',
        reviews: {
          totalCount: 1,
          nodes: [
            {
              commit: { oid: 'a4c090f614f3b3ed4707c549bcb2d4d5afa76805' },
              author: { name: 'Neal Patel', login: 'nealajpatel' },
              state: 'APPROVED',
            },
            {
              commit: null,
              author: { name: 'Neal Patel', login: 'nealajpatel' },
              state: 'APPROVED',
            },
          ],
          pageInfo: {
            endCursor:
              'Y3Vyc29yOnYyOpO0MjAyMy0wNS0yMFQwMzo0OTo1Nlq0MjAyMy0wNS0yMFQwMzo0OTo1NlrOVY2pjA==',
            hasNextPage: true,
          },
        },
      },
    },
    rateLimit: {
      limit: 5000,
      cost: 2,
      remaining: 5000,
      resetAt: '2023-07-17T22:41:34Z',
    },
  },
  {
    repository: {
      pullRequest: {
        id: 'MDExOlB1bGxSZXF1ZXN0MTA=',
        reviews: {
          totalCount: 1,
          nodes: [
            {
              commit: null,
              author: { name: 'Neal Patel', login: 'nealajpatel' },
              state: 'APPROVED',
            },
          ],
          pageInfo: {
            endCursor: null,
            hasNextPage: false,
          },
        },
      },
    },
    rateLimit: {
      limit: 5000,
      cost: 1,
      remaining: 4998,
      resetAt: '2023-07-17T22:41:34Z',
    },
  },
];

export {
  singleQueryFullResponse,
  singleQueryWithPartialInnerResources,
  singleQueryInnerResourcePaginationComplete,
  commitsQueryResponse,
  labelsQueryResponse,
  reviewsQueryResponse,
};
