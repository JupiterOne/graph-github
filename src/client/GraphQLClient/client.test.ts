import { parseTimePropertyValue } from '@jupiterone/integration-sdk-core';
import {
  createMockIntegrationLogger,
  createMockStepExecutionContext,
  Recording,
} from '@jupiterone/integration-sdk-testing';

import { integrationConfig } from '../../../test/config';
import { setupGithubRecording } from '../../../test/recording';
import { IntegrationConfig, sanitizeConfig } from '../../config';
import createGitHubAppClient from '../../util/createGitHubAppClient';
import { GitHubGraphQLClient, GithubResource } from './';
import {
  MAX_REQUESTS_NUM,
  PUBLIC_REPO_PULL_REQUESTS_QUERY_STRING,
  REPOS_QUERY_STRING,
  TEAM_MEMBERS_QUERY_STRING,
  USERS_QUERY_STRING,
} from './queries';
import resourceMetadataMap from './resourceMetadataMap';
import { Commit, Label, PullRequest, Review } from './types';

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
  const { token, expiresAt } = (await appClient.auth({
    type: 'installation',
  })) as {
    token: string;
    expiresAt: string;
  };
  const tokenExpires = parseTimePropertyValue(expiresAt) || 0;
  return { token, tokenExpires, appClient };
}

async function getClient() {
  const { token, tokenExpires, appClient } = await getAccess();
  return new GitHubGraphQLClient(
    token,
    tokenExpires,
    resourceMetadataMap(),
    createMockIntegrationLogger(),
    appClient,
  );
}

//reduce page limit size so we can test pagination
const pullRequestsQueryString = PUBLIC_REPO_PULL_REQUESTS_QUERY_STRING.replace(
  `first: ${MAX_REQUESTS_NUM}`,
  'first: 2',
);
const reposQueryString = REPOS_QUERY_STRING.replace(
  `first: ${MAX_REQUESTS_NUM}`,
  'first: 2',
);
const usersQueryString = USERS_QUERY_STRING.replace(
  `first: ${MAX_REQUESTS_NUM}`,
  'first: 2',
);
const teamMembersQueryString = TEAM_MEMBERS_QUERY_STRING.replace(
  `first: ${MAX_REQUESTS_NUM}`,
  'first: 2',
);

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
      pullRequestsQueryString,
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
      pullRequestsQueryString,
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
      pullRequestsQueryString,
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
      reposQueryString,
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
      usersQueryString,
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
      teamMembersQueryString,
      GithubResource.Organization,
      [GithubResource.TeamMembers],
      { login: 'Kei-Institute' },
    );

    expect(data.organization).toHaveLength(1);
    expect(data.membersWithRole).toBeUndefined();
    expect(data.repositories).toBeUndefined();
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
