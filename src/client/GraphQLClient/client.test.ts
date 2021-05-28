import { Polly } from '@pollyjs/core';
import { createMockIntegrationLogger } from '@jupiterone/integration-sdk-testing';

import polly from ../../../../test/helpers/polly';
import { setupGithubRecording } from '../../../test/recording';
import { GitHubGraphQLClient, OrganizationResource } from '.';
import resourceMetadataMap from './resourceMetadataMap';
import createGitHubAppClient from '../../util/createGitHubAppClient';

async function getAccess() {
  if (
    !process.env.GITHUB_APP_ID ||
    !process.env.GITHUB_APP_LOCAL_PRIVATE_KEY_PATH ||
    !process.env.GITHUB_INSTALLATION_ID
  ) {
    throw new Error(`
      Make sure you define all required environment variables!

      * GITHUB_APP_ID
      * GITHUB_APP_LOCAL_PRIVATE_KEY_PATH
      * GITHUB_INSTALLATION_ID
    `);
  }

  const appClient = await createGitHubAppClient(
    Number(process.env.GITHUB_INSTALLATION_ID),
    createMockIntegrationLogger()
  );
  const { token } = (await appClient.auth({ type: 'installation' })) as {
    token: string;
  };

  return token;
}

async function getClient() {
  const access = await getAccess();
  return new GitHubGraphQLClient(
    access,
    resourceMetadataMap(2),
    createMockIntegrationLogger()
  );
}

describe('results and pagination', () => {
  let p: Polly;

  afterEach(async () => {
    await p.stop();
  });

  test('single page', async () => {
    p = polly(__dirname, 'GitHubGraphQLClient.fetchOrganization.singlePage');
    const client = await getClient();

    const data = await client.fetchOrganization('github-app-test', [
      OrganizationResource.Repositories,
    ]);

    expect(data.organization).toBeDefined();
    expect(data.members).toBeUndefined();
    expect(data.repositories).toHaveLength(1);
    expect(data.teams).toBeUndefined();
    expect(data.teamMembers).toBeUndefined();
    expect(data.rateLimitConsumed).toBe(1);
  });

  test('multiple pages', async () => {
    p = polly(__dirname, 'GitHubGraphQLClient.fetchOrganization.multiplePages');
    const client = await getClient();

    const data = await client.fetchOrganization('github-app-test', [
      OrganizationResource.Members,
    ]);

    expect(data.organization).toBeDefined();
    expect(data.members).toHaveLength(3);
    expect(data.repositories).toBeUndefined();
    expect(data.teams).toBeUndefined();
    expect(data.teamMembers).toBeUndefined();
    expect(data.rateLimitConsumed).toBe(2);
  });

  test('child resource only', async () => {
    p = polly(__dirname, 'GitHubGraphQLClient.fetchOrganization.childOnly');
    const client = await getClient();

    const data = await client.fetchOrganization('github-app-test', [
      OrganizationResource.TeamMembers,
    ]);

    expect(data.organization).toHaveLength(1);
    expect(data.members).toBeUndefined();
    expect(data.repositories).toBeUndefined();
    // expect(data.teams).toBeUndefined();
    expect(data.teamMembers).toHaveLength(5);
    expect(data.teamMembers).toEqual([
      {
        id: 'MDQ6VXNlcjE1MjY0NDU=',
        login: 'fomentia',
        teams: 'MDQ6VGVhbTM0NzMyOTc=',
        role: 'MAINTAINER',
      },
      {
        id: 'MDQ6VXNlcjE1MjY0NDU=',
        login: 'fomentia',
        teams: 'MDQ6VGVhbTM0NTM4Njg=',
        role: 'MEMBER',
      },
      {
        id: 'MDQ6VXNlcjUwNjI3MTgx',
        login: 'fomentia2',
        teams: 'MDQ6VGVhbTM0NTM4Njg=',
        role: 'MAINTAINER',
      },
      {
        id: 'MDQ6VXNlcjU1NDk0NjY1',
        login: 'github-user-test',
        teams: 'MDQ6VGVhbTM0NTM4Njg=',
        role: 'MEMBER',
      },
      {
        id: 'MDQ6VXNlcjUwNjI3MTgx',
        login: 'fomentia2',
        teams: 'MDQ6VGVhbTM0NzM0MDI=',
        role: 'MAINTAINER',
      },
    ]);
    expect(data.rateLimitConsumed).toBe(3);
  });

  test('all resources', async () => {
    p = polly(__dirname, 'GitHubGraphQLClient.fetchOrganization.all');
    const client = await getClient();

    const data = await client.fetchOrganization('github-app-test', [
      OrganizationResource.TeamMembers,
      OrganizationResource.Members,
      OrganizationResource.Teams,
      OrganizationResource.Repositories,
      OrganizationResource.TeamRepositories,
    ]);

    expect(data.organization).toBeDefined();
    expect(data.members).toHaveLength(3);
    expect(data.repositories).toHaveLength(1);
    expect(data.teams).toHaveLength(3);
    expect(data.teamMembers).toHaveLength(5);
    expect(data.teamRepositories).toHaveLength(1);
    expect(data.rateLimitConsumed).toBe(3);
  });
});
