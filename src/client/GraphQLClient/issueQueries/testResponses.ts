const issuesResponses = [
  {
    repository: {
      id: 'R_kgDOI2pL-A',
      name: 'reimagined-barnacle',
      issues: {
        nodes: [
          {
            id: '111',
            title: 'Need to add code part 1',
            assignees: {
              totalCount: 1,
            },
            labels: {
              totalCount: 2,
            },
          },
          {
            id: '2222',
            title: 'Need to add code part 2',
            assignees: {
              totalCount: 1,
            },
            labels: {
              totalCount: 2,
            },
          },
        ],
        pageInfo: {
          endCursor: 'Y3Vyc29yOjE=',
          hasNextPage: true,
        },
      },
    },
    rateLimit: {
      cost: 1,
      remaining: 4983,
    },
  },
  // Send page
  {
    repository: {
      id: 'R_kgDOI2pL-A',
      name: 'reimagined-barnacle',
      issues: {
        nodes: [
          {
            id: '333',
            title: 'Need to add code part 3',
            assignees: {
              totalCount: 1,
            },
            labels: {
              totalCount: 2,
            },
          },
        ],
        pageInfo: {
          endCursor: 'Y3Vyc29yOjE=',
          hasNextPage: false,
        },
      },
    },
    rateLimit: {
      cost: 1,
      remaining: 4982,
    },
  },
];

export { issuesResponses };
