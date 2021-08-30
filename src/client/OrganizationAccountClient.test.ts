import {
  createMockExecutionContext,
  createMockIntegrationLogger,
} from '@jupiterone/integration-sdk-testing';
import { integrationConfig } from '../../test/config';
import OrganizationAccountClient from './OrganizationAccountClient';

const throwError = jest.fn().mockImplementation(() => {
  throw new Error('404');
});

const mockLogger: any = {
  info: jest.fn(),
};
const context = createMockExecutionContext({
  instanceConfig: integrationConfig,
});
context.logger = mockLogger;

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
    context,
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
    context,
    analyzeCommitApproval: true,
  });

  test('getTeams', async () => {
    const teamsResponse = [];
    await expect(client.getTeams()).resolves.toEqual(teamsResponse);
    expect(((client as any).teams = teamsResponse));
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
  it('should create entities for pull requests', async () => {
    const mockV3GitHub = {
      pulls: {
        list: () => {
          return { data: [mockPullRequest] };
        },
      },
    };
    const client = mockClient(mockV3GitHub);
    (client as any).v3 = mockV3GitHub;
    (client as any).analyzeCommitApproval = false;

    const pullRequestEntities = await client.getPullRequestEntities(
      mockAccount,
      mockPullRequest,
      [],
      {},
      createMockIntegrationLogger(),
    );
    expect(pullRequestEntities?.length).toEqual(1);
    expect(pullRequestEntities).toMatchSnapshot();
  });

  test('should not create entities for pull requests that are older than the last successful integration run', async () => {
    const mockV3GitHub = {
      pulls: {
        list: () => {
          return {
            data: [
              {
                ...mockPullRequest,
                created_at: new Date(Date.UTC(2021, 8, 1)), // August 1st 2021
              },
            ],
          };
        },
      },
    };
    const client = mockClient(mockV3GitHub);
    (client as any).v3 = mockV3GitHub;
    (client as any).analyzeCommitApproval = false;
    (client as any).context.executionHistory = {
      lastSuccessful: {
        startedOn: new Date(Date.UTC(2021, 9, 1)), // September 1st 2021 (one month later)
      },
    };

    const pullRequestEntities = await client.getPullRequestEntities(
      mockAccount,
      mockPullRequest,
      [],
      {},
      createMockIntegrationLogger(),
    );
    expect(pullRequestEntities).toEqual([undefined]);
  });

  test('should create entities for pull requests when this is the first integration run', async () => {
    const mockV3GitHub = {
      pulls: {
        list: () => {
          return {
            data: [
              {
                ...mockPullRequest,
                created_at: new Date(Date.UTC(2021, 8, 1)), // August 1st 2021
              },
            ],
          };
        },
      },
    };
    const client = mockClient(mockV3GitHub);
    (client as any).v3 = mockV3GitHub;
    (client as any).analyzeCommitApproval = false;
    (client as any).context.executionHistory = {}; // first execution

    const pullRequestEntities = await client.getPullRequestEntities(
      mockAccount,
      mockPullRequest,
      [],
      {},
      createMockIntegrationLogger(),
    );
    expect(pullRequestEntities?.length).toEqual(1);
    expect(pullRequestEntities).toMatchSnapshot();
  });

  test('should pull commits and reviews from GitHub when when analyzeCommitApproval is enabled', async () => {
    const mockV3GitHub = {
      pulls: {
        list: () => {
          return {
            data: [
              {
                ...mockPullRequest,
                created_at: new Date(Date.UTC(2021, 8, 1)), // August 1st 2021
              },
            ],
          };
        },
      },
    };
    const client = mockClient(mockV3GitHub);
    (client as any).v3 = mockV3GitHub;
    (client as any).analyzeCommitApproval = true;
    (client as any).getPullRequestCommits = jest.fn().mockResolvedValue([]);
    (client as any).getPullRequestReviews = jest.fn().mockResolvedValue([]);

    const pullRequestEntities = await client.getPullRequestEntities(
      mockAccount,
      mockPullRequest,
      [],
      {},
      createMockIntegrationLogger(),
    );
    expect(pullRequestEntities?.length).toEqual(1);
    expect(pullRequestEntities).toMatchSnapshot();
    expect(client.getPullRequestCommits).toHaveBeenCalledTimes(1);
    expect(client.getPullRequestReviews).toHaveBeenCalledTimes(1);
  });

  test('logs info error when pulls.list fails and returns undefined', async () => {
    const mockGitHub = {
      pulls: {
        list: throwError,
      },
    };
    const client = mockClient(mockGitHub);

    await expect(
      client.getPullRequestEntities(
        mockAccount,
        mockPullRequest,
        [],
        {},
        createMockIntegrationLogger(),
      ),
    ).resolves.toBeUndefined();
    expect(mockLogger.info).toHaveBeenCalledWith(
      { err: new Error('404') },
      'pulls.list failed',
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
      client.getPullRequestEntities(
        mockAccount,
        mockPullRequest,
        [],
        {},
        createMockIntegrationLogger(),
      ),
    ).resolves.toBeUndefined();
    expect(mockGitHub.pulls.list).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      { err: { status: 403 } },
      'pulls.list failed',
    );

    jest.clearAllMocks();

    await expect(
      client.getPullRequestEntities(
        mockAccount,
        mockPullRequest,
        [],
        {},
        createMockIntegrationLogger(),
      ),
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
      client.getPullRequestReviews(mockAccount, mockPullRequest),
    ).resolves.toEqual([]);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ err: new Error('404') }),
      'pulls.listReviews failed',
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
      client.getPullRequestCommits(mockAccount, mockPullRequest),
    ).resolves.toEqual([]);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ err: new Error('404') }),
      'pulls.listCommits failed',
    );
  });
});
