const issuesResponses = [
  {
    search: {
      issueCount: 3,
      edges: [
        {
          node: {
            id: '111',
            title: 'Need to add code part 1',
            assignees: {
              totalCount: 1,
              nodes: [
                {
                  name: null,
                  login: 'spoultonV2',
                },
              ],
              pageInfo: {
                endCursor: 'Y3Vyc29yOnYyOpHOBgq4WA==',
                hasNextPage: false,
              },
            },
            labels: {
              totalCount: 9,
              nodes: [
                {
                  id: 'LA_kwDOG5ypUc7mjrvd',
                  name: 'bug',
                },
                {
                  id: 'LA_kwDOG5ypUc7mjrvi',
                  name: 'feature',
                },
              ],
              pageInfo: {
                endCursor:
                  'Y3Vyc29yOnYyOpK5MjAyMi0wMi0yNFQxMTowNDo1OC0wNzowMM7mjrwE',
                hasNextPage: false,
              },
            },
          },
        },
        {
          node: {
            id: '2222',
            title: 'Need to add code part 2',
            assignees: {
              totalCount: 1,
              nodes: [
                {
                  name: null,
                  login: 'maxmin',
                },
              ],
              pageInfo: {
                endCursor: 'Y3Vyc29yOnYyOpHOBgq4WA==',
                hasNextPage: false,
              },
            },
            labels: {
              totalCount: 9,
              nodes: [
                {
                  id: 'LA_kwDOG5ypUc7mjrvd',
                  name: 'bug',
                },
                {
                  id: 'LA_kwDOG5ypUc7mjrvi',
                  name: 'critical',
                },
              ],
              pageInfo: {
                endCursor:
                  'Y3Vyc29yOnYyOpK5MjAyMi0wMi0yNFQxMTowNDo1OC0wNzowMM7mjrwE',
                hasNextPage: false,
              },
            },
          },
        },
      ],
      pageInfo: {
        endCursor: 'Y3Vyc29yOjE=',
        hasNextPage: true,
      },
    },
  },
  // Send page
  {
    search: {
      issueCount: 3,
      edges: [
        {
          node: {
            id: '333',
            title: 'Need to add code part 3',
            assignees: {
              totalCount: 1,
              nodes: [
                {
                  name: null,
                  login: 'chris3',
                },
              ],
              pageInfo: {
                endCursor: 'Y3Vyc29yOnYyOpHOBgq4WA==',
                hasNextPage: false,
              },
            },
            labels: {
              totalCount: 9,
              nodes: [
                {
                  id: 'LA_kwDOG5ypUc7mjrvd',
                  name: 'defect',
                },
                {
                  id: 'LA_kwDOG5ypUc7mjrvi',
                  name: 'easy',
                },
              ],
              pageInfo: {
                endCursor:
                  'Y3Vyc29yOnYyOpK5MjAyMi0wMi0yNFQxMTowNDo1OC0wNzowMM7mjrwE',
                hasNextPage: false,
              },
            },
          },
        },
      ],
      pageInfo: {
        endCursor: 'Y3Vyc29yOjE=',
        hasNextPage: false,
      },
    },
    rateLimit: {
      cost: 3,
      remaining: 4983,
    },
  },
];

export { issuesResponses };
