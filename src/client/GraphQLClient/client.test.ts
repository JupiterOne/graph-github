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
  REPOS_QUERY_STRING,
  SINGLE_TEAM_MEMBERS_QUERY_STRING,
  USERS_QUERY_STRING,
} from './queries';
import resourceMetadataMap from './resourceMetadataMap';

async function getAccess() {
  const context = createMockStepExecutionContext<IntegrationConfig>({
    instanceConfig: integrationConfig,
  });

  const config = context.instance.config;
  sanitizeConfig(config);
  //the installid in the recordings
  config.installationId = 7498286;

  const appClient = createGitHubAppClient(
    'https://api.github.com',
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
    'https://api.github.com/graphql',
    token,
    tokenExpires,
    resourceMetadataMap(),
    createMockIntegrationLogger(),
    appClient,
  );
}

//reduce page limit size so we can test pagination
const reposQueryString = REPOS_QUERY_STRING.replace(
  `first: ${MAX_REQUESTS_NUM}`,
  'first: 2',
);
const usersQueryString = USERS_QUERY_STRING.replace(
  `first: ${MAX_REQUESTS_NUM}`,
  'first: 2',
);

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
      SINGLE_TEAM_MEMBERS_QUERY_STRING,
      GithubResource.Organization,
      [GithubResource.TeamMembers],
      { login: 'Kei-Institute', slug: 'betterteam' },
    );

    expect(data.organization).toHaveLength(1);
    expect(data.membersWithRole).toBeUndefined();
    expect(data.repositories).toBeUndefined();
    expect(data.members).toHaveLength(3);
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
    ]);
    expect(data.rateLimitConsumed).toBe(1);
  });
});
