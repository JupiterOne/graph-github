const repoCollaborators = [
  {
    repository: {
      id: 'R_kgDOG_MJdQ',
      collaborators: {
        edges: [
          {
            node: {
              id: 'MDQ6VXNlcjU5MjMwMDI=',
              name: 'Samuel Poulton',
              login: 'VDubber',
            },
            permission: 'ADMIN',
          },
          {
            node: {
              id: 'U_kgDOBgq4WA',
              name: null,
              login: 'spoultonV2',
            },
            permission: 'READ',
          },
        ],
        pageInfo: {
          endCursor: 'more2come==',
          hasNextPage: true,
        },
      },
    },
    rateLimit: {
      cost: 2,
    },
  },
  {
    repository: {
      id: 'R_kgDOG_MJdQ',
      collaborators: {
        edges: [
          {
            node: {
              id: 'MDQ6VXNlcjU5MjMwMDI=',
              name: 'Harper Smith',
              login: 'HSM',
            },
            permission: 'ADMIN',
          },
          {
            node: {
              id: 'U_kgDOBgq4WA',
              name: 'Unkonw 2',
              login: 'u2',
            },
            permission: 'READ',
          },
        ],
        pageInfo: {
          endCursor: 'more2come==',
          hasNextPage: false,
        },
      },
    },
    rateLimit: {
      cost: 4,
    },
  },
];

export { repoCollaborators };
