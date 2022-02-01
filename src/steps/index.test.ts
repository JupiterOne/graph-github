import {
  createMockStepExecutionContext,
  Recording,
} from '@jupiterone/integration-sdk-testing';

import { IntegrationConfig, sanitizeConfig } from '../config';
import { fetchMembers } from './members';
import { fetchRepos } from './repos';
import { fetchTeams } from './teams';
import { fetchCollaborators } from './collaborators';
import { fetchPrs } from './pullRequests';
import { fetchAccountDetails } from './account';
import { fetchApps } from './apps';
import { GITHUB_REPO_SECRET_ORG_SECRET_RELATIONSHIP_TYPE } from '../constants';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import { fetchOrgSecrets } from './orgSecrets';
import { fetchRepoSecrets } from './repoSecrets';
import { fetchEnvironments } from './environments';
import { fetchIssues } from './issues';
import { fetchEnvSecrets } from './envSecrets';
import { fetchTeamRepos } from './teamRepos';
import { fetchTeamMembers } from './teamMembers';

jest.setTimeout(75000);

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
  await fetchTeamRepos(context);
  await fetchTeamMembers(context);
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
});
