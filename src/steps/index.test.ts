import {
  createMockStepExecutionContext,
  Recording,
} from '@jupiterone/integration-sdk-testing';

import { IntegrationConfig, sanitizeConfig } from '../config';
import { fetchMembers } from './members';
import { fetchRepos } from './repos';
import { fetchTeams } from './teams';
import { fetchCollaborators } from './collaborators';
import { fetchPrs } from './pullrequests';
import { fetchAccountDetails } from './account';
import { fetchApps } from './apps';
import {
  GITHUB_COLLABORATOR_ENTITY_TYPE,
  GITHUB_REPO_USER_RELATIONSHIP_TYPE,
  GITHUB_REPO_SECRET_ORG_SECRET_RELATIONSHIP_TYPE,
  GITHUB_ENV_SECRET_ORG_SECRET_RELATIONSHIP_TYPE,
  GITHUB_ENV_SECRET_REPO_SECRET_RELATIONSHIP_TYPE,
} from '../constants';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import { fetchOrgSecrets } from './orgsecrets';
import { fetchRepoSecrets } from './reposecrets';
import { fetchEnvironments } from './environments';
import { fetchIssues } from './issues';
import { fetchEnvSecrets } from './envsecrets';

jest.setTimeout(20000);

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('should collect data', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'steps', //redaction of headers is in setupGithubRecording
  });

  sanitizeConfig(integrationConfig);
  integrationConfig.installationId = 17214088; //this is the id the recordings are under

  const context = createMockStepExecutionContext<IntegrationConfig>({
    instanceConfig: integrationConfig,
  });

  // Simulates dependency graph execution.
  // See https://github.com/JupiterOne/sdk/issues/262.
  await fetchAccountDetails(context);
  await fetchApps(context);
  await fetchMembers(context);
  await fetchRepos(context);
  await fetchTeams(context);
  await fetchCollaborators(context);
  await fetchPrs(context);
  await fetchIssues(context);
  await fetchEnvironments(context);
  await fetchOrgSecrets(context);
  await fetchRepoSecrets(context);
  await fetchEnvSecrets(context);

  // Review snapshot, failure is a regression
  expect({
    numCollectedEntities: context.jobState.collectedEntities.length,
    numCollectedRelationships: context.jobState.collectedRelationships.length,
    collectedEntities: context.jobState.collectedEntities,
    collectedRelationships: context.jobState.collectedRelationships,
    encounteredTypes: context.jobState.encounteredTypes,
  }).toMatchSnapshot();

  const accounts = context.jobState.collectedEntities.filter((e) =>
    e._class.includes('Account'),
  );
  expect(accounts.length).toBeGreaterThan(0);
  expect(accounts).toMatchGraphObjectSchema({
    _class: ['Account'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_account' },
        accountType: { type: 'string' },
        accountId: { type: 'string' },
        login: { type: 'string' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['accountId'],
    },
  });

  const apps = context.jobState.collectedEntities.filter((e) =>
    e._class.includes('Application'),
  );
  expect(apps.length).toBeGreaterThan(0);
  expect(apps).toMatchGraphObjectSchema({
    _class: ['Application'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_app' },
        name: { type: 'string' },
        displayName: { type: 'string' },
        webLink: { type: 'string' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['name', 'displayName', 'webLink', 'createdOn'],
    },
  });

  const users = context.jobState.collectedEntities.filter((e) =>
    e._class.includes('User'),
  );
  expect(users.length).toBeGreaterThan(0);
  expect(users).toMatchGraphObjectSchema({
    _class: ['User'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_user' },
        username: { type: 'string' },
        displayName: { type: 'string' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['username', 'displayName'],
    },
  });

  const userGroups = context.jobState.collectedEntities.filter((e) =>
    e._class.includes('UserGroup'),
  );
  expect(userGroups.length).toBeGreaterThan(0);
  expect(userGroups).toMatchGraphObjectSchema({
    _class: ['UserGroup'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_team' },
        webLink: { type: 'string' },
        displayName: { type: 'string' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['webLink', 'displayName'],
    },
  });

  const repos = context.jobState.collectedEntities.filter((e) =>
    e._class.includes('CodeRepo'),
  );
  expect(repos.length).toBeGreaterThan(0);
  expect(repos).toMatchGraphObjectSchema({
    _class: ['CodeRepo'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_repo' },
        webLink: { type: 'string' },
        displayName: { type: 'string' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['webLink', 'displayName'],
    },
  });

  const prs = context.jobState.collectedEntities.filter((e) =>
    e._class.includes('PR'),
  );
  expect(prs.length).toBeGreaterThan(0);
  expect(prs).toMatchGraphObjectSchema({
    _class: ['PR'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_pullrequest' },
        webLink: { type: 'string' },
        displayName: { type: 'string' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['webLink', 'displayName'],
    },
  });

  const repoUserRelationships = context.jobState.collectedRelationships.filter(
    (r) => r._type === GITHUB_REPO_USER_RELATIONSHIP_TYPE,
  );
  expect(repoUserRelationships.length).toBeGreaterThan(0);

  const outsideCollaboratorEntities = context.jobState.collectedEntities.filter(
    (e) => e._type === GITHUB_COLLABORATOR_ENTITY_TYPE && e.role === 'OUTSIDE',
  );
  expect(outsideCollaboratorEntities.length).toBeGreaterThan(0);

  const orgSecrets = context.jobState.collectedEntities.filter(
    (e) => e._class.includes('Secret') && e._type.includes('github_org_secret'),
  );
  expect(orgSecrets.length).toBeGreaterThan(0);
  expect(orgSecrets).toMatchGraphObjectSchema({
    _class: ['Secret'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_org_secret' },
        webLink: { type: 'string' },
        displayName: { type: 'string' },
        name: { type: 'string' },
        createdOn: { type: 'number' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['webLink', 'displayName', 'name', 'createdOn'],
    },
  });

  const repoSecrets = context.jobState.collectedEntities.filter(
    (e) =>
      e._class.includes('Secret') && e._type.includes('github_repo_secret'),
  );
  expect(repoSecrets.length).toBeGreaterThan(0);
  expect(repoSecrets).toMatchGraphObjectSchema({
    _class: ['Secret'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_repo_secret' },
        webLink: { type: 'string' },
        displayName: { type: 'string' },
        name: { type: 'string' },
        createdOn: { type: 'number' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['webLink', 'displayName', 'name', 'createdOn'],
    },
  });

  const secretRepoOrgOverrideRelationships =
    context.jobState.collectedRelationships.filter(
      (r) => r._type === GITHUB_REPO_SECRET_ORG_SECRET_RELATIONSHIP_TYPE,
    );
  expect(secretRepoOrgOverrideRelationships.length).toBeGreaterThan(0);

  const envs = context.jobState.collectedEntities.filter((e) =>
    e._class.includes('Configuration'),
  );
  expect(envs.length).toBeGreaterThan(0);
  expect(envs).toMatchGraphObjectSchema({
    _class: ['Configuration'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_environment' },
        name: { type: 'string' },
        displayName: { type: 'string' },
        webLink: { type: 'string' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['name', 'displayName', 'webLink', 'createdOn'],
    },
  });

  const envSecrets = context.jobState.collectedEntities.filter(
    (e) => e._class.includes('Secret') && e._type.includes('github_env_secret'),
  );
  expect(envSecrets.length).toBeGreaterThan(0);
  expect(envSecrets).toMatchGraphObjectSchema({
    _class: ['Secret'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_env_secret' },
        webLink: { type: 'string' },
        displayName: { type: 'string' },
        name: { type: 'string' },
        createdOn: { type: 'number' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['webLink', 'displayName', 'name', 'createdOn'],
    },
  });

  const secretEnvOrgOverrideRelationships =
    context.jobState.collectedRelationships.filter(
      (r) => r._type === GITHUB_ENV_SECRET_ORG_SECRET_RELATIONSHIP_TYPE,
    );
  expect(secretEnvOrgOverrideRelationships.length).toBeGreaterThan(0);

  const secretEnvRepoOverrideRelationships =
    context.jobState.collectedRelationships.filter(
      (r) => r._type === GITHUB_ENV_SECRET_REPO_SECRET_RELATIONSHIP_TYPE,
    );
  expect(secretEnvRepoOverrideRelationships.length).toBeGreaterThan(0);

  const issues = context.jobState.collectedEntities.filter(
    (e) => e._class.includes('Issue') && e._type.includes('github_issue'),
  );
  expect(issues.length).toBeGreaterThan(0);
  expect(issues).toMatchGraphObjectSchema({
    _class: ['Issue'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'github_issue' },
        webLink: { type: 'string' },
        displayName: { type: 'string' },
        name: { type: 'string' },
        createdOn: { type: 'number' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['webLink', 'displayName', 'name', 'createdOn'],
    },
  });
});
