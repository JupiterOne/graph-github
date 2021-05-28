import OrganizationAccountClient from './OrganizationAccountClient';

const throwError = jest.fn().mockImplementation(() => {
  throw new Error('404');
});

const mockLogger: any = {
  info: jest.fn(),
};

const mockAccount: any = {
  login: 'account',
};

const mockPullRequest: any = {
  base: {
    repo: {
      name: 'repo-name',
    },
  },
  number: 420,
};

beforeEach(() => {
  jest.clearAllMocks();
});

function mockClient(mockGitHub: any) {
  return new OrganizationAccountClient({
    login: 'asdf',
    restClient: mockGitHub,
    graphqlClient: {} as any,
    logger: mockLogger,
    analyzeCommitApproval: true,
  });
}

describe('handles undefined resources from graphql', () => {
  const client = new OrganizationAccountClient({
    login: 'asdf',
    restClient: {} as any,
    graphqlClient: {
      fetchOrganization: jest.fn().mockResolvedValue({
        rateLimitConsumed: 1,
      }),
    } as any,
    logger: mockLogger,
    analyzeCommitApproval: true,
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
    await expect(client.getTeamRepositories()).resolves.toEqual([]);
  });

  test('getMembers', async () => {
    await expect(client.getMembers()).resolves.toEqual([]);
  });
});

describe('getPullRequests', () => {
  test('logs info error when pulls.list fails and returns undefined', async () => {
    const mockGitHub = {
      pulls: {
        list: throwError,
      },
    };
    const client = mockClient(mockGitHub);

    await expect(
      client.getPullRequestEntities(mockAccount, mockPullRequest)
    ).resolves.toBeUndefined();
    expect(mockLogger.info).toHaveBeenCalledWith(
      { err: new Error('404') },
      'pulls.list failed'
    );
  });

  test(`doesn't retry pulls.list after receiving 403`, async () => {
    const throwError = jest.fn().mockImplementation(() => {
      throw { status: 403 };
    });
    const mockGitHub = {
      pulls: {
        list: throwError,
      },
    };
    const client = mockClient(mockGitHub);

    await expect(
      client.getPullRequestEntities(mockAccount, mockPullRequest)
    ).resolves.toBeUndefined();
    expect(mockGitHub.pulls.list).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      { err: { status: 403 } },
      'pulls.list failed'
    );

    jest.clearAllMocks();

    await expect(
      client.getPullRequestEntities(mockAccount, mockPullRequest)
    ).resolves.toBeUndefined();
    expect(mockGitHub.pulls.list).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});

describe('getPullRequestReviews', () => {
  test('logs info error when pulls.listReviews fails and return empty array', async () => {
    const mockGitHub = {
      pulls: {
        listReviews: throwError,
      },
    };
    const client = mockClient(mockGitHub);

    await expect(
      client.getPullRequestReviews(mockAccount, mockPullRequest)
    ).resolves.toEqual([]);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ err: new Error('404') }),
      'pulls.listReviews failed'
    );
  });
});

describe('getPullRequestCommits', () => {
  test('logs info error when pulls.listCommits fails and return empty array', async () => {
    const mockGitHub = {
      pulls: {
        listCommits: throwError,
      },
    };
    const client = mockClient(mockGitHub);

    await expect(
      client.getPullRequestCommits(mockAccount, mockPullRequest)
    ).resolves.toEqual([]);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ err: new Error('404') }),
      'pulls.listCommits failed'
    );
  });
});
