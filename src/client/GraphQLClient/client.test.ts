import {
  createMockStepExecutionContext,
  Recording,
  createMockIntegrationLogger,
} from '@jupiterone/integration-sdk-testing';
import { setupGithubRecording } from '../../../test/recording';
import { GitHubGraphQLClient, OrganizationResource } from '.';
import resourceMetadataMap from './resourceMetadataMap';
import createGitHubAppClient from '../../util/createGitHubAppClient';
import { IntegrationConfig, sanitizeConfig } from '../../config';
import { integrationConfig } from '../../../test/config';

async function getAccess() {
  const context = createMockStepExecutionContext<IntegrationConfig>({
    instanceConfig: integrationConfig,
  });

  const config = context.instance.config;
  sanitizeConfig(config);
  //the installid in the recordings
  config.installationId = 17214088;

  const appClient = createGitHubAppClient(
    config,
    createMockIntegrationLogger(),
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
    createMockIntegrationLogger(),
  );
}

describe('results and pagination', () => {
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

    const data = await client.fetchOrganization('Kei-Institute', [
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

    const data = await client.fetchOrganization('Kei-Institute', [
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

    const data = await client.fetchOrganization('Kei-Institute', [
      OrganizationResource.TeamMembers,
    ]);

    expect(data.organization).toHaveLength(1);
    expect(data.members).toBeUndefined();
    expect(data.repositories).toBeUndefined();
    // expect(data.teams).toBeUndefined();
    expect(data.teamMembers).toHaveLength(6);
    expect(data.teamMembers).toEqual([
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

  test('all resources', async () => {
    p = setupGithubRecording({
      directory: __dirname,
      name: 'GitHubGraphQLClient.fetchOrganization.all',
      options: {
        matchRequestsBy: {
          headers: false, //must not set order:false
        },
      },
    });
    const client = await getClient();

    const data = await client.fetchOrganization('Kei-Institute', [
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
    expect(data.teamMembers).toHaveLength(6);
    //there's just one repo, but it's in a team that is a child of another team
    //that means repos (above) = 1 but teamRepos (below) = 2
    expect(data.teamRepositories).toHaveLength(2);
    expect(data.rateLimitConsumed).toBe(3);
  });
});
