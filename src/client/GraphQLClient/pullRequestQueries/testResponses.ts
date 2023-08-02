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

const oneByOneResponses = [
  {
    search: {
      issueCount: 6,
      edges: [
        {
          node: {
            author: {},
            baseRefName: 'main',
            baseRefOid: 'e0c7d998fedd115d3489d67b78b0ec4351a7d231',
            baseRepository: {
              name: 'test-repo1',
              owner: {
                login: 'JupiterOne-Sandbox',
              },
            },
            body: '',
            changedFiles: 1,
            createdAt: '2023-05-19T14:56:58Z',
            databaseId: 1357276831,
            headRefName: 'SRE-1001/ops-platform-jobs-readme-test',
            headRefOid: 'c4fc20147d1440a8bea9b000320471d02d6a4397',
            headRepository: {
              name: 'test-repo1',
              owner: {
                login: 'JupiterOne-Sandbox',
              },
            },
            id: 'PR_kwDOIudGfM5Q5maf',
            merged: true,
            mergedAt: '2023-05-20T03:50:06Z',
            mergedBy: {},
            number: 9,
            reviewDecision: 'APPROVED',
            state: 'MERGED',
            title: 'Update README.md',
            updatedAt: '2023-05-20T03:50:08Z',
            url: 'https://github.com/JupiterOne-Sandbox/test-repo1/pull/9',
          },
        },
        {
          node: {
            author: {},
            baseRefName: 'main',
            baseRefOid: '130e23d58c9978333776ac94e6f623bad7aeae4b',
            baseRepository: {
              name: 'test-repo1',
              owner: {
                login: 'JupiterOne-Sandbox',
              },
            },
            body: '',
            changedFiles: 1,
            createdAt: '2023-05-17T13:09:52Z',
            databaseId: 1354151894,
            headRefName: 'SRE-1001/ops-platform-jobs-readme-test',
            headRefOid: '718adb1eac4af9a45650be7e88a1af3c0e1a7afe',
            headRepository: {
              name: 'test-repo1',
              owner: {
                login: 'JupiterOne-Sandbox',
              },
            },
            id: 'PR_kwDOIudGfM5QtrfW',
            merged: true,
            mergedAt: '2023-05-17T16:08:22Z',
            mergedBy: {},
            number: 8,
            reviewDecision: null,
            state: 'MERGED',
            title: 'Update README.md',
            updatedAt: '2023-05-17T16:08:24Z',
            url: 'https://github.com/JupiterOne-Sandbox/test-repo1/pull/8',
          },
        },
      ],
      pageInfo: {
        endCursor: 'Y3Vyc29yOjI=',
        hasNextPage: true,
      },
    },
    rateLimit: {
      limit: 5000,
      cost: 1,
      remaining: 5000,
      resetAt: '2023-08-01T22:45:39Z',
    },
  },
  {
    search: {
      issueCount: 6,
      edges: [
        {
          node: {
            author: {},
            baseRefName: 'main',
            baseRefOid: '130e23d58c9978333776ac94e6f623bad7aeae4b',
            baseRepository: {
              name: 'test-repo1',
              owner: {
                login: 'JupiterOne-Sandbox',
              },
            },
            body: '',
            changedFiles: 1,
            createdAt: '2023-05-16T14:38:58Z',
            databaseId: 1352636957,
            headRefName: 'SRE-1001/ops-platform-jobs-readme-undo',
            headRefOid: 'd54f0613b2f2efbac213a9a120c965c412c69ba1',
            headRepository: {
              name: 'test-repo1',
              owner: {
                login: 'JupiterOne-Sandbox',
              },
            },
            id: 'PR_kwDOIudGfM5Qn5od',
            merged: false,
            mergedAt: null,
            mergedBy: null,
            number: 7,
            reviewDecision: null,
            state: 'CLOSED',
            title: 'Update README.md',
            updatedAt: '2023-05-17T13:14:09Z',
            url: 'https://github.com/JupiterOne-Sandbox/test-repo1/pull/7',
          },
        },
      ],
      pageInfo: {
        endCursor: 'Y3Vyc29yOjM=',
        hasNextPage: true,
      },
    },
    rateLimit: {
      limit: 5000,
      cost: 1,
      remaining: 5000,
      resetAt: '2023-08-01T22:45:39Z',
    },
  },
  {
    search: {
      issueCount: 6,
      edges: [
        {
          node: {
            author: {},
            baseRefName: 'main',
            baseRefOid: '01df5f40c5bf0dfc62d972e517989ce6c3cd99b9',
            baseRepository: {
              name: 'test-repo1',
              owner: {
                login: 'JupiterOne-Sandbox',
              },
            },
            body: '',
            changedFiles: 1,
            createdAt: '2023-05-16T14:12:55Z',
            databaseId: 1352592779,
            headRefName: 'SRE-1001/ops-platform-jobs-readme-test',
            headRefOid: 'abfadd770deb8eefb5ce073c87fbe7a80b1b82f2',
            headRepository: {
              name: 'test-repo1',
              owner: {
                login: 'JupiterOne-Sandbox',
              },
            },
            id: 'PR_kwDOIudGfM5Qnu2L',
            merged: true,
            mergedAt: '2023-05-16T14:20:33Z',
            mergedBy: {},
            number: 6,
            reviewDecision: null,
            state: 'MERGED',
            title: 'Update README.md',
            updatedAt: '2023-05-16T14:20:35Z',
            url: 'https://github.com/JupiterOne-Sandbox/test-repo1/pull/6',
          },
        },
      ],
      pageInfo: {
        endCursor: 'Y3Vyc29yOjQ=',
        hasNextPage: true,
      },
    },
    rateLimit: {
      limit: 5000,
      cost: 1,
      remaining: 5000,
      resetAt: '2023-08-01T22:45:39Z',
    },
  },
  {
    search: {
      issueCount: 6,
      edges: [
        {
          node: {
            author: { name: 'Neal Patel', login: 'nealajpatel' },
            baseRefName: 'main',
            baseRefOid: '47db50a18856176ab10b706076f2c9dfacfda261',
            baseRepository: {
              name: 'test-repo1',
              owner: { login: 'JupiterOne-Sandbox' },
            },
            body: '',
            changedFiles: 1,
            createdAt: '2023-05-15T14:43:37Z',
            databaseId: 1350939546,
            headRefName: 'readme-update',
            headRefOid: '728b0b8f49a324315a2fbe07222bb43df02aa7c9',
            headRepository: {
              name: 'test-repo1',
              owner: { login: 'JupiterOne-Sandbox' },
            },
            id: 'PR_kwDOIudGfM5QhbOa',
            merged: true,
            mergedAt: '2023-05-15T16:17:53Z',
            mergedBy: { name: 'Neal Patel', login: 'nealajpatel' },
            number: 3,
            reviewDecision: null,
            state: 'MERGED',
            title: 'README Update',
            updatedAt: '2023-05-15T16:17:53Z',
            url: 'https://github.com/JupiterOne-Sandbox/test-repo1/pull/3',
          },
        },
        {
          node: {
            author: { name: 'Neal Patel', login: 'nealajpatel' },
            baseRefName: 'main',
            baseRefOid: '47db50a18856176ab10b706076f2c9dfacfda261',
            baseRepository: {
              name: 'test-repo1',
              owner: { login: 'JupiterOne-Sandbox' },
            },
            body: '',
            changedFiles: 1,
            createdAt: '2023-05-15T14:27:55Z',
            databaseId: 1350916055,
            headRefName: 'readme-update',
            headRefOid: '74c0d116477dc28a51696e3dcbb84cd02dfe381a',
            headRepository: {
              name: 'test-repo1',
              owner: { login: 'JupiterOne-Sandbox' },
            },
            id: 'PR_kwDOIudGfM5QhVfX',
            merged: false,
            mergedAt: null,
            mergedBy: null,
            number: 2,
            reviewDecision: null,
            state: 'CLOSED',
            title: 'README Update',
            updatedAt: '2023-05-15T14:28:50Z',
            url: 'https://github.com/JupiterOne-Sandbox/test-repo1/pull/2',
          },
        },
      ],
      pageInfo: { endCursor: 'Y3Vyc29yOjg=', hasNextPage: false },
    },
    rateLimit: {
      limit: 5000,
      cost: 1,
      remaining: 5000,
      resetAt: '2023-08-01T22:45:39Z',
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
  oneByOneResponses,
};
