const orgMembers = [
  {
    organization: {
      id: 'O_kgDOBfl5ZQ',
      membersWithRole: {
        totalCount: 4,
        edges: [
          {
            node: {
              id: 'm_1',
              login: 'VDubber',
              name: 'Samuel Poulton',
              isSiteAdmin: false,
              company: 'JupiterOne',
              createdAt: '2013-11-12T20:20:50Z',
              databaseId: 5923002,
              email: 'samuel.poulton@jupiterone.com',
              isEmployee: false,
              location: null,
              updatedAt: '2022-03-15T15:43:54Z',
              url: 'https://github.com/VDubber',
              websiteUrl: null,
            },
            hasTwoFactorEnabled: true,
            role: 'ADMIN',
          },
          {
            node: {
              id: 'm_2',
              login: 'codestuffs',
              name: 'Jump Jack',
              isSiteAdmin: false,
              company: null,
              createdAt: '2022-03-10T21:30:13Z',
              databaseId: 101365848,
              email: 'jump@jack.com',
              isEmployee: false,
              location: null,
              updatedAt: '2022-03-10T21:30:13Z',
              url: 'https://github.com/codestuffs',
              websiteUrl: null,
            },
            hasTwoFactorEnabled: false,
            role: 'MEMBER',
          },
        ],
        pageInfo: {
          endCursor: 'more2come',
          hasNextPage: true,
        },
      },
    },
    rateLimit: {
      cost: 5,
    },
  },
  {
    organization: {
      id: 'O_kgDOBfl5ZQ',
      membersWithRole: {
        totalCount: 4,
        edges: [
          {
            node: {
              id: 'm_3',
              login: 'JP',
              name: 'Joe Poulton',
              isSiteAdmin: false,
              company: 'JupiterOne',
              createdAt: '2013-11-12T20:20:50Z',
              databaseId: 5923002,
              email: 'j.poulton@jupiterone.com',
              isEmployee: false,
              location: null,
              updatedAt: '2022-03-15T15:43:54Z',
              url: 'https://github.com/JP',
              websiteUrl: null,
            },
            hasTwoFactorEnabled: true,
            role: 'ADMIN',
          },
          {
            node: {
              id: 'm_4',
              login: 'spv2',
              name: null,
              isSiteAdmin: false,
              company: null,
              createdAt: '2022-03-10T21:30:13Z',
              databaseId: 101365848,
              email: 'spv2@j1.com',
              isEmployee: false,
              location: null,
              updatedAt: '2022-03-10T21:30:13Z',
              url: 'https://github.com/spv2',
              websiteUrl: null,
            },
            hasTwoFactorEnabled: false,
            role: 'MEMBER',
          },
        ],
        pageInfo: {
          endCursor: 'end==',
          hasNextPage: false,
        },
      },
    },
    rateLimit: {
      cost: 5,
    },
  },
];

const teamMembers = [
  {
    organization: {
      id: 'O_kgDOBfl5ZQ',
      team: {
        id: 'T_kwDOBfl5Zc4AWFtb',
        name: 'j1-ingest-eng',
        members: {
          edges: [
            {
              node: {
                id: 'm1',
                name: 'Joe Poulton',
                login: 'JP',
              },
              role: 'MAINTAINER',
            },
            {
              node: {
                id: 'm2',
                name: 'Samuel Poulton',
                login: 'VDubber',
              },
              role: 'ADMIN',
            },
            {
              node: {
                id: 'm3',
                name: 'E',
                login: 'EP',
              },
              role: 'MAINTAINER',
            },
          ],
          pageInfo: {
            endCursor: 'more2come',
            hasNextPage: true,
          },
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
      team: {
        id: 'T_kwDOBfl5Zc4AWFtb',
        name: 'j1-ingest-eng',
        members: {
          edges: [
            {
              node: {
                id: 'm4',
                name: 'Silvia Smith',
                login: 'SSM',
              },
              role: 'MAINTAINER',
            },
          ],
          pageInfo: {
            endCursor: 'end',
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

export { orgMembers, teamMembers };
