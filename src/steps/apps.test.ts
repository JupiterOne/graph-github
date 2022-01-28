import {
  createMockStepExecutionContext,
  Recording,
} from '@jupiterone/integration-sdk-testing';
import { IntegrationConfig, sanitizeConfig } from '../config';
import { fetchApps } from './apps';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import { DATA_ACCOUNT_ENTITY } from './account';
import { createMockAccountEntity } from '../../test/mockEntities';
import { GITHUB_ACCOUNT_APP_RELATIONSHIP_TYPE } from '../constants';

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

describe('fetchApps exec handler', () => {
  let apps;
  let context;

  test('execution and snapshot', async () => {
    recording = setupGithubRecording({
      directory: __dirname,
      name: 'apps', //redaction of headers is in setupGithubRecording
    });
    sanitizeConfig(integrationConfig);
    integrationConfig.installationId = 17214088; //this is the id the recordings are under
    const accountEntity = createMockAccountEntity();
    context = createMockStepExecutionContext<IntegrationConfig>({
      instanceConfig: integrationConfig,
      setData: {
        [DATA_ACCOUNT_ENTITY]: accountEntity,
      },
    });

    // Simulates dependency graph execution.
    // See https://github.com/JupiterOne/sdk/issues/262.
    await fetchApps(context);

    // Review snapshot, failure is a regression
    expect({
      numCollectedEntities: context.jobState.collectedEntities.length,
      numCollectedRelationships: context.jobState.collectedRelationships.length,
      collectedEntities: context.jobState.collectedEntities,
      collectedRelationships: context.jobState.collectedRelationships,
      encounteredTypes: context.jobState.encounteredTypes,
    }).toMatchSnapshot();

    apps = context.jobState.collectedEntities.filter((e) =>
      e._class.includes('Application'),
    );
    expect(apps.length).toBeGreaterThan(0);

    const relationships = context.jobState.collectedRelationships.filter((e) =>
      e._type.includes(GITHUB_ACCOUNT_APP_RELATIONSHIP_TYPE),
    );
    expect(relationships.length).toBeGreaterThan(0);
  });

  test('schema match', () => {
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
  });
});
