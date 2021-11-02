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
import { PullRequest } from './types';
import {
  PULL_REQUESTS_QUERY_STRING,
  REPOS_QUERY_STRING,
  TEAM_MEMBERS_QUERY_STRING,
  USERS_QUERY_STRING,
} from './queries';
import { parseTimePropertyValue } from '@jupiterone/integration-sdk-core';

//tests in this file similar to those in client.test.ts, except
//that they start with an expired token. You can see that refresh worked
//because there are two calls for an access token in each polly recording,
//recorded one second apart
//
//These tests were recorded later and with slightly different test data
//from the recordings made in client.test.ts, so some values passed to
//expect items are different

async function getAccess() {
  const context = createMockStepExecutionContext<IntegrationConfig>({
    instanceConfig: integrationConfig,
  });

  const config = context.instance.config;
  sanitizeConfig(config);
  //the installid in the recordings
  config.installationId = 17214088; //this is the id the recordings are under

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

const pageLimit = 2;
async function getClient() {
  const { token, tokenExpires, appClient } = await getAccess();
  return new GitHubGraphQLClient(
    token,
    tokenExpires * 0, //making this be time zero simulates an expired token and forces a refresh
    resourceMetadataMap(pageLimit, pageLimit),
    createMockIntegrationLogger(),
    appClient,
  );
}

describe('pull request resources', () => {
  let p: Recording; //p for polly

  afterEach(async () => {
    await p.stop();
  });

  test('pullRequest pagination only', async () => {
    p = setupGithubRecording({
      directory: __dirname,
      name: 'GitHubGraphQLClient.refreshTokenInFetchPRs.singlePage',
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
    expect(response.rateLimitConsumed).toEqual(1);
    expect(pullRequests.length).toEqual(2);
    expect(pullRequests).toMatchSnapshot();
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
      name: 'GitHubGraphQLClient.refreshTokenInFetchOrg.singlePage',
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
    expect(data.repositories).toHaveLength(3);
    expect(data.teams).toBeUndefined();
    expect(data.members).toBeUndefined();
    expect(data.rateLimitConsumed).toBe(1);
  });

  test('multiple pages', async () => {
    p = setupGithubRecording({
      directory: __dirname,
      name: 'GitHubGraphQLClient.refreshTokenInFetchOrg.multiplePages',
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
    expect(data.rateLimitConsumed).toBe(1);
  });

  test('child resource only', async () => {
    p = setupGithubRecording({
      directory: __dirname,
      name: 'GitHubGraphQLClient.refreshTokenInFetchOrg.childOnly',
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
    expect(data.members).toHaveLength(6);
    expect(data.members).toEqual([
      {
        id: 'MDQ6VXNlcjUxMzUyMw==',
        login: 'erichs',
        name: 'Erich Smith',
        node: undefined,
        teams: 'MDQ6VGVhbTQ4NTgxNjk=',
        role: 'MEMBER',
      },
      {
        id: 'MDQ6VXNlcjI1NDg5NDgy',
        login: 'mknoedel',
        name: 'Michael Knoedel',
        node: undefined,
        teams: 'MDQ6VGVhbTQ4NTgxNjk=',
        role: 'MEMBER',
      },
      {
        id: 'MDQ6VXNlcjYyNDkyMDk3',
        login: 'kevincasey1222',
        name: 'Kevin Casey',
        node: undefined,
        teams: 'MDQ6VGVhbTQ4NTgxNjk=',
        role: 'MAINTAINER',
      },
      {
        id: 'MDQ6VXNlcjYyNDkyMDk3',
        login: 'kevincasey1222',
        name: 'Kevin Casey',
        node: undefined,
        teams: 'MDQ6VGVhbTQ4NTgxNzA=',
        role: 'MAINTAINER',
      },
      {
        id: 'MDQ6VXNlcjI1NDg5NDgy',
        login: 'mknoedel',
        name: 'Michael Knoedel',
        node: undefined,
        teams: 'MDQ6VGVhbTQ4NTc0OTU=',
        role: 'MEMBER',
      },
      {
        id: 'MDQ6VXNlcjYyNDkyMDk3',
        login: 'kevincasey1222',
        name: 'Kevin Casey',
        node: undefined,
        teams: 'MDQ6VGVhbTQ4NTc0OTU=',
        role: 'MAINTAINER',
      },
    ]);
    expect(data.rateLimitConsumed).toBe(1);
  });
});
