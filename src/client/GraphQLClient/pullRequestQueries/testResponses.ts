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
            commits: {
              totalCount: 1,
              nodes: [
                {
                  commit: {
                    id: 'MDY6Q29tbWl0MjE6YmVkZDliNDIzNmY3NzNlMTAxNDIwYzVjNzU3OWIyMDNmODVkNmVkNw==',
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
                  id: 'MDE3OlB1bGxSZXF1ZXN0UmV2aWV3Mg==',
                },
                {
                  id: 'MDE3OlB1bGxSZXF1ZXN0UmV2aWV3Mw==',
                },
              ],
              pageInfo: {
                endCursor:
                  'Y3Vyc29yOnYyOpO0MjAyMi0wMy0wNFQyMjo1NDozMVq0MjAyMi0wMy0wNFQyMjo1NDozMVoD',
                hasNextPage: false,
              },
            },
            labels: {
              totalCount: 4,
              nodes: [
                {
                  id: 'MDU6TGFiZWwxODE=',
                  name: 'bug',
                },
                {
                  id: 'MDU6TGFiZWwxODI=',
                  name: 'documentation',
                },
                {
                  id: 'MDU6TGFiZWwxODM=',
                  name: 'duplicate',
                },
                {
                  id: 'MDU6TGFiZWwxODU=',
                  name: 'good first issue',
                },
              ],
              pageInfo: {
                endCursor: 'Y3Vyc29yOnYyOpK0MjAyMi0wMi0yNFQxMzozOToyNFrMuQ==',
                hasNextPage: false,
              },
            },
          },
        },
        {
          node: {
            id: 'MDExOlB1bGxSZXF1ZXN0OQ==',
            title: 'Create CHANGELOG.md #2',
            closed: false,
            commits: {
              totalCount: 1,
              nodes: [
                {
                  commit: {
                    id: 'MDY6Q29tbWl0MjE6Y2FmNWNjYzA2MjYyMzAxYzFiNjg4NWJkYjc2NzllNTQ0NjVkZmQ5ZA==',
                  },
                },
              ],
              pageInfo: {
                endCursor: 'MQ',
                hasNextPage: false,
              },
            },
            reviews: {
              totalCount: 0,
              nodes: [],
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
              },
            },
            labels: {
              totalCount: 0,
              nodes: [],
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
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
            commits: {
              totalCount: 1,
              nodes: [
                {
                  commit: {
                    id: 'pr3-commit1==',
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
                  id: 'pr3-review1==',
                },
                {
                  id: 'pr3-review2==',
                },
              ],
              pageInfo: {
                endCursor: 'sdflkj',
                hasNextPage: false,
              },
            },
            labels: {
              totalCount: 2,
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
                endCursor: 'pom==',
                hasNextPage: false,
              },
            },
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
          commits: {
            totalCount: 2,
            nodes: [
              {
                commit: {
                  id: 'MDY6Q29tbWl0MjE6Y2FmNWNjYzA2MjYyMzAxYzFiNjg4NWJkYjc2NzllNTQ0NjVkZmQ5ZA==',
                },
              },
            ],
            pageInfo: {
              endCursor: 'commitEndCursor',
              hasNextPage: true,
            },
          },
          reviews: {
            totalCount: 0,
            nodes: [],
            pageInfo: {
              endCursor: null,
              hasNextPage: false,
            },
          },
          labels: {
            totalCount: 0,
            nodes: [],
            pageInfo: {
              endCursor: null,
              hasNextPage: false,
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

export {
  singleQueryFullResponse,
  singleQueryWithPartialInnerResources,
  singleQueryInnerResourcePaginationComplete,
};
