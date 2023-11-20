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
              nodes: [
                {
                  name: null,
                  login: 'spoultonV2',
                },
              ],
            },
            labels: {
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
          {
            id: '2222',
            title: 'Need to add code part 2',
            assignees: {
              nodes: [
                {
                  name: null,
                  login: 'maxmin',
                },
              ],
            },
            labels: {
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
              nodes: [
                {
                  name: null,
                  login: 'chris3',
                },
              ],
            },
            labels: {
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
