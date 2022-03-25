const teams = [
  {
    organization: {
      id: 'O_kgDOBfl5ZQ',
      teams: {
        edges: [
          {
            node: {
              id: 'T_kwDOBfl5Zc4AWHaA',
              name: 'j1-empty-team',
              url: 'https://github.com/orgs/j1-ingest/teams/j1-empty-team',
              slug: 'j1-empty-team',
              createdAt: '2022-03-14T16:40:24Z',
              updatedAt: '2022-03-14T16:40:24Z',
              databaseId: 5797504,
              description: '',
              privacy: 'VISIBLE',
            },
          },
          {
            node: {
              id: 'T_kwDOBfl5Zc4AV-Cl',
              name: 'j1-github-ingest',
              url: 'https://github.com/orgs/j1-ingest/teams/j1-github-ingest',
              slug: 'j1-github-ingest',
              createdAt: '2022-03-04T21:51:41Z',
              updatedAt: '2022-03-04T21:51:41Z',
              databaseId: 5759141,
              description: 'Testing the GitHub Integration',
              privacy: 'VISIBLE',
            },
          },
        ],
        pageInfo: {
          endCursor: 'more2come',
          hasNextPage: true,
        },
      },
    },
    rateLimit: {
      cost: 2,
    },
  },
  {
    organization: {
      id: 'O_kgDOBfl5ZQ',
      teams: {
        edges: [
          {
            node: {
              id: 'T_kwDOBfl5Zc4AWFtb',
              name: 'j1-ingest-eng',
              url: 'https://github.com/orgs/j1-ingest/teams/j1-ingest-eng',
              slug: 'j1-ingest-eng',
              createdAt: '2022-03-11T22:03:54Z',
              updatedAt: '2022-03-11T22:03:54Z',
              databaseId: 5790555,
              description: 'Test team',
              privacy: 'SECRET',
            },
          },
          {
            node: {
              id: 'T_kwDOBfl5Zc4AWFta',
              name: 'j1-nested-team',
              url: 'https://github.com/orgs/j1-ingest/teams/j1-nested-team',
              slug: 'j1-nested-team',
              createdAt: '2022-03-11T22:03:02Z',
              updatedAt: '2022-03-11T22:03:02Z',
              databaseId: 5790554,
              description: 'Is this team nested?',
              privacy: 'VISIBLE',
            },
          },
        ],
        pageInfo: {
          endCursor: 'end==',
          hasNextPage: false,
        },
      },
    },
    rateLimit: {
      cost: 1,
    },
  },
];

export { teams };
