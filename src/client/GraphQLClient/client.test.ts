import {
  createMockStepExecutionContext,
  Recording,
  createMockIntegrationLogger,
} from '@jupiterone/integration-sdk-testing';
import { setupGithubRecording } from '../../../test/recording';
import { GitHubGraphQLClient, GithubResource } from '.';
import resourceMetadataMap from './resourceMetadataMap';
import createGitHubAppClient from '../../util/createGitHubAppClient';
import { IntegrationConfig, sanitizeConfig } from '../../config';
import { integrationConfig } from '../../../test/config';
import { Commit, Label, PullRequest, Review } from './types';
import {
  PULL_REQUESTS_QUERY_STRING,
  REPOS_QUERY_STRING,
  TEAM_MEMBERS_QUERY_STRING,
  USERS_QUERY_STRING,
} from './queries';

async function getAccess() {
  const context = createMockStepExecutionContext<IntegrationConfig>({
    instanceConfig: integrationConfig,
  });

  const config = context.instance.config;
  sanitizeConfig(config);
  //the installid in the recordings
  config.installationId = 7498286;

  const appClient = createGitHubAppClient(
    config,
    createMockIntegrationLogger(),
  );
  const { token } = (await appClient.auth({ type: 'installation' })) as {
    token: string;
  };

  return token;
}

const pageLimit = 2;
async function getClient() {
  const access = await getAccess();
  return new GitHubGraphQLClient(
    access,
    resourceMetadataMap(pageLimit, pageLimit),
    createMockIntegrationLogger(),
  );
}

describe('pull request resources', () => {
  let p: Recording; //p for polly

  afterEach(async () => {
    await p.stop();
  });

  test('no extra resources', async () => {
    p = setupGithubRecording({
      directory: __dirname,
      name: 'GitHubGraphQLClient.fetchPullRequests.noExtraResources',
    });
    const client = await getClient();

    const query = 'is:pr repo:JupiterOne/graph-whitehat is:open';
    const pullRequests: PullRequest[] = [];
    const response = await client.iteratePullRequests(
      PULL_REQUESTS_QUERY_STRING,
      query,
      [],
      (pr) => {
        pullRequests.push(pr);
      },
    );
    expect(response.rateLimitConsumed).toEqual(3);
    expect(pullRequests.length).toEqual(6);
    expect(
      pullRequests.reduce(
        (agg, pr) => agg.concat(pr.commits ?? []),
        [] as Commit[],
      ).length,
    ).toEqual(0);
    expect(
      pullRequests.reduce(
        (agg, pr) => agg.concat(pr.reviews ?? []),
        [] as Review[],
      ).length,
    ).toEqual(0);
    expect(
      pullRequests.reduce(
        (agg, pr) => agg.concat(pr.labels ?? []),
        [] as Label[],
      ).length,
    ).toEqual(0);
    expect(pullRequests).toMatchSnapshot();
  });

  test('pullRequest pagination only', async () => {
    p = setupGithubRecording({
      directory: __dirname,
      name: 'GitHubGraphQLClient.fetchPullRequests.singlePage',
    });
    const client = await getClient();

    const query = 'is:pr repo:Kei-Institute/Test-repo is:open';
    const pullRequests: PullRequest[] = [];
    const response = await client.iteratePullRequests(
      PULL_REQUESTS_QUERY_STRING,
      query,
      [GithubResource.Commits, GithubResource.Reviews, GithubResource.Labels],
      (pr) => {
        pullRequests.push(pr);
      },
    );
    expect(response.rateLimitConsumed).toEqual(3);
    expect(pullRequests.length).toEqual(6);
    expect(pullRequests).toMatchSnapshot();
  });

  test('pullRequest with inner pagination', async () => {
    p = setupGithubRecording({
      directory: __dirname,
      name: 'GitHubGraphQLClient.fetchPullRequests.innerPagination',
    });
    const client = await getClient();

    const query =
      'is:pr repo:JupiterOne/graph-whitehat is:closed updated:<=2019-04-01 ';
    const pullRequests: PullRequest[] = [];
    const data = await client.iteratePullRequests(
      PULL_REQUESTS_QUERY_STRING,
      query,
      [GithubResource.Commits, GithubResource.Reviews, GithubResource.Labels],
      (pr) => {
        pullRequests.push(pr);
      },
    );
    expect(pullRequests.length).toEqual(4); // 2 rate limits
    expect(data.rateLimitConsumed).toEqual(9); // 7 unaccounted for extras
    let pullRequest = pullRequests[0]; // 2 extra
    expect(pullRequest.commits?.length).toEqual(4); // 1 extra rate limit (Actually 2 because 1 commit got filtered out)
    expect(pullRequest.reviews?.length).toEqual(4); // 1 extra rate limit
    expect(pullRequest.labels?.length).toEqual(0);
    pullRequest = pullRequests[1]; // 1 extra
    expect(pullRequest.commits?.length).toEqual(4); // 1 extra rate limit
    expect(pullRequest.reviews?.length).toEqual(3); // 1 extra rate limit
    expect(pullRequest.labels?.length).toEqual(0);
    pullRequest = pullRequests[2]; // 4 extra
    expect(pullRequest.commits?.length).toEqual(4); // 1 extra rate limit
    expect(pullRequest.reviews?.length).toEqual(9); // 4 extra rate limits
    expect(pullRequest.labels?.length).toEqual(0);
    pullRequest = pullRequests[3]; // 0 extra
    expect(pullRequest.commits?.length).toEqual(1);
    expect(pullRequest.reviews?.length).toEqual(1);
    expect(pullRequest.labels?.length).toEqual(0);
  });
});

describe('organization resources', () => {
  let p: Recording; //p for polly

  afterEach(async () => {
    await p.stop();
  });

  test('single page', async () => {
    p = setupGithubRecording({
      directory: __dirname,
      name: 'GitHubGraphQLClient.fetchOrganization.singlePage',
      options: {
        matchRequestsBy: {
          headers: false, //must not set order:false
        },
      },
    });
    const client = await getClient();

    const data = await client.fetchFromSingle(
      REPOS_QUERY_STRING,
      GithubResource.Organization,
      [GithubResource.Repositories],
      { login: 'Kei-Institute' },
    );

    expect(data.organization).toBeDefined();
    expect(data.membersWithRole).toBeUndefined();
    expect(data.repositories).toHaveLength(1);
    expect(data.teams).toBeUndefined();
    expect(data.members).toBeUndefined();
    expect(data.rateLimitConsumed).toBe(1);
  });

  test('multiple pages', async () => {
    p = setupGithubRecording({
      directory: __dirname,
      name: 'GitHubGraphQLClient.fetchOrganization.multiplePages',
      options: {
        matchRequestsBy: {
          headers: false, //must not set order:false
        },
      },
    });
    const client = await getClient();

    const data = await client.fetchFromSingle(
      USERS_QUERY_STRING,
      GithubResource.Organization,
      [GithubResource.OrganizationMembers],
      { login: 'Kei-Institute' },
    );

    expect(data.organization).toBeDefined();
    expect(data.membersWithRole).toHaveLength(3);
    expect(data.repositories).toBeUndefined();
    expect(data.teams).toBeUndefined();
    expect(data.members).toBeUndefined();
    expect(data.rateLimitConsumed).toBe(2);
  });

  test('child resource only', async () => {
    p = setupGithubRecording({
      directory: __dirname,
      name: 'GitHubGraphQLClient.fetchOrganization.childOnly',
      options: {
        matchRequestsBy: {
          headers: false, //must not set order:false
        },
      },
    });
    const client = await getClient();

    const data = await client.fetchFromSingle(
      TEAM_MEMBERS_QUERY_STRING,
      GithubResource.Organization,
      [GithubResource.TeamMembers],
      { login: 'Kei-Institute' },
    );

    expect(data.organization).toHaveLength(1);
    expect(data.membersWithRole).toBeUndefined();
    expect(data.repositories).toBeUndefined();
    // expect(data.teams).toBeUndefined();
    expect(data.members).toHaveLength(6);
    expect(data.members).toEqual([
      {
        id: 'MDQ6VXNlcjUxMzUyMw==',
        login: 'erichs',
        node: undefined,
        teams: 'MDQ6VGVhbTQ4NTgxNjk=',
        role: 'MEMBER',
      },
      {
        id: 'MDQ6VXNlcjI1NDg5NDgy',
        login: 'mknoedel',
        node: undefined,
        teams: 'MDQ6VGVhbTQ4NTgxNjk=',
        role: 'MEMBER',
      },
      {
        id: 'MDQ6VXNlcjYyNDkyMDk3',
        login: 'kevincasey1222',
        node: undefined,
        teams: 'MDQ6VGVhbTQ4NTgxNzA=',
        role: 'MAINTAINER',
      },
      {
        id: 'MDQ6VXNlcjYyNDkyMDk3',
        login: 'kevincasey1222',
        node: undefined,
        teams: 'MDQ6VGVhbTQ4NTgxNjk=',
        role: 'MAINTAINER',
      },
      {
        id: 'MDQ6VXNlcjI1NDg5NDgy',
        login: 'mknoedel',
        node: undefined,
        teams: 'MDQ6VGVhbTQ4NTc0OTU=',
        role: 'MEMBER',
      },
      {
        id: 'MDQ6VXNlcjYyNDkyMDk3',
        login: 'kevincasey1222',
        node: undefined,
        teams: 'MDQ6VGVhbTQ4NTc0OTU=',
        role: 'MAINTAINER',
      },
    ]);
    expect(data.rateLimitConsumed).toBe(3);
  });
});
