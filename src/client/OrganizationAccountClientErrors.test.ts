import OrganizationAccountClient from './OrganizationAccountClient';

const mockLogger: any = {
  info: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('handles undefined resources from graphql', () => {
  const client = new OrganizationAccountClient({
    login: 'asdf',
    restClient: {} as any,
    graphqlClient: {
      fetchFromSingle: jest.fn().mockResolvedValue({
        rateLimitConsumed: 1,
      }),
    } as any,
    logger: mockLogger,
  });

  test('getTeams', async () => {
    await expect(client.getTeams()).resolves.toEqual([]);
  });

  test('getTeamMembers', async () => {
    await expect(client.getTeamMembers()).resolves.toEqual([]);
  });

  test('getRepositories', async () => {
    await expect(client.getRepositories()).resolves.toEqual([]);
  });

  test('getTeamRepositories', async () => {
    await expect(client.getTeamRepositories([])).resolves.toEqual([]);
  });

  test('getMembers', async () => {
    await expect(client.getMembers()).resolves.toEqual([]);
  });
});
