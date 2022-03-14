const teamRepos = [
  // Page 1
  {
    organization: {
      id: 'O_kgDOBfl5ZQ',
      team: {
        id: 'T_kwDOBfl5Zc4AWFta',
        name: 'j1-nested-team',
        repositories: {
          edges: [
            {
              node: {
                id: 'R_1',
              },
              permission: 'READ',
            },
            {
              node: {
                id: 'R_2',
              },
              permission: 'READ',
            },
            {
              node: {
                id: 'R_3',
              },
              permission: 'READ',
            },
          ],
          pageInfo: {
            endCursor: 'Y3Vyc29yOnYyOpHOG_MJdQ',
            hasNextPage: true,
          },
        },
      },
    },
    rateLimit: {
      cost: 1,
    },
  },
  // Page 2
  {
    organization: {
      id: 'O_kgDOBfl5ZQ',
      team: {
        id: 'T_kwDOBfl5Zc4AWFta',
        name: 'j1-nested-team',
        repositories: {
          edges: [
            {
              node: {
                id: 'R_4',
              },
              permission: 'READ',
            },
            {
              node: {
                id: 'R_5',
              },
              permission: 'READ',
            },
            {
              node: {
                id: 'R_6',
              },
              permission: 'WRITE',
            },
          ],
          pageInfo: {
            endCursor: 'Yend',
            hasNextPage: false,
          },
        },
      },
    },
    rateLimit: {
      cost: 1,
    },
  },
];

const emptyTeamRepos = [
  // Unknown Org
  {
    organization: null,
    rateLimit: {
      cost: 1,
    },
  },
  // Unknown Team
  {
    organization: {
      id: 'O_kgDOBfl5ZQ',
      team: null,
    },
    rateLimit: {
      cost: 1,
    },
  },
  // No Associated repos
  {
    organization: {
      id: 'O_kgDOBfl5ZQ',
      team: {
        id: 'T_kwDOBfl5Zc4AWHaA',
        name: 'j1-empty-team',
        repositories: {
          edges: [],
          pageInfo: {
            endCursor: null,
            hasNextPage: false,
          },
        },
      },
    },
    rateLimit: {
      cost: 1,
    },
  },
];

export { teamRepos, emptyTeamRepos };

const orgRepos = [
  // Page 1
  {
    organization: {
      id: 'O_kgDOBfl5ZQ',
      repositories: {
        nodes: [
          {
            id: 'R_1',
            name: 'scaling-lamp',
          },
          {
            id: 'R_2',
            name: 'reimagined-barnacle',
          },
          {
            id: 'R_3',
            name: 'friendly-spork',
          },
        ],
        pageInfo: {
          endCursor: 'orgRepoCursorEnd',
          hasNextPage: true,
        },
      },
    },
    rateLimit: {
      cost: 5,
    },
  },
  // Page 2
  {
    organization: {
      id: 'O_kgDOBfl5ZQ',
      repositories: {
        nodes: [
          {
            id: 'R_4',
            name: 'automatic-parakeet',
          },
          {
            id: 'R_5',
            name: 'jumping-shrimp',
          },
        ],
        pageInfo: {
          endCursor: 'end2',
          hasNextPage: false,
        },
      },
    },
    rateLimit: {
      cost: 1,
    },
  },
];

const emptyOrgRepos = [
  {
    organization: null,
    rateLimit: {
      cost: 1,
    },
  },
  {
    organization: {
      id: 'O_kgDOBfl5ZQ',
      repositories: null,
    },
    rateLimit: {
      cost: 1,
    },
  },
];

export { orgRepos, emptyOrgRepos };
