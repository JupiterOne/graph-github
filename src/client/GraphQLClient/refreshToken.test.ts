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
    tokenExpires * 0, //making this be time zero simulates an expired token and forces a refresh
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

describe('GraphQLClient.query', () => {
  let polly: Recording;

  afterEach(async () => {
    await polly.stop();
  });

  test('#query', async () => {
    polly = setupGithubRecording({
      directory: __dirname,
      name: 'GitHubGraphQLClient.refreshTokenQuery',
      options: {
        matchRequestsBy: {
          headers: false, //must not set order:false
        },
      },
    });
    const client = await getClient();

    const query = `
      query ($login: String!) {
      organization(login: $login) {
        id
        name
        description
      }
      rateLimit {
        cost
        remaining
      }
    }`;
    const queryVariables = {
      login: 'j1-ingest',
    };

    const response = await client.query(query, queryVariables);
    expect(response).toBeDefined();
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
      reposQueryString,
      GithubResource.Organization,
      [GithubResource.Repositories],
      { login: 'j1-ingest' },
    );

    expect(data.organization).toBeDefined();
    expect(data.membersWithRole).toBeUndefined();
    expect(data.repositories).toHaveLength(6);
    expect(data.teams).toBeUndefined();
    expect(data.members).toBeUndefined();
    expect(data.rateLimitConsumed).toBe(3);
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
      usersQueryString,
      GithubResource.Organization,
      [GithubResource.OrganizationMembers],
      { login: 'j1-ingest' },
    );

    expect(data.organization).toBeDefined();
    expect(data.membersWithRole).toHaveLength(2);
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
      SINGLE_TEAM_MEMBERS_QUERY_STRING,
      GithubResource.Organization,
      [GithubResource.TeamMembers],
      { login: 'j1-ingest', slug: 'j1-github-ingest' },
    );

    expect(data.organization).toHaveLength(1);
    expect(data.membersWithRole).toBeUndefined();
    expect(data.repositories).toBeUndefined();
    expect(data.members).toHaveLength(2);
    expect(data.members).toMatchSnapshot();
    expect(data.rateLimitConsumed).toBe(1);
  });
});
