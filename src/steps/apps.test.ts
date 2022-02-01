import { Recording } from '@jupiterone/integration-sdk-testing';
import { sanitizeConfig } from '../config';
import { appSteps } from './apps';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import { GITHUB_ACCOUNT_APP_RELATIONSHIP_TYPE } from '../constants';
import { invocationConfig } from '..';
import { executeStepWithDependencies } from '../../test/executeStepWithDependencies';

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchApps exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'apps', //redaction of headers is in setupGithubRecording
  });
  sanitizeConfig(integrationConfig);
  integrationConfig.installationId = 17214088; //this is the id the recordings are under

  const { collectedEntities, collectedRelationships, encounteredTypes } =
    await executeStepWithDependencies({
      stepId: appSteps[0].id,
      invocationConfig: invocationConfig as any,
      instanceConfig: integrationConfig,
    });

  expect({
    numCollectedEntities: collectedEntities.length,
    numCollectedRelationships: collectedRelationships.length,
    collectedEntities: collectedEntities,
    collectedRelationships: collectedRelationships,
    encounteredTypes: encounteredTypes,
  }).toMatchSnapshot();

  const apps = collectedEntities.filter((e) => e._type.includes('github_app'));
  expect(apps.length).toBeGreaterThan(0);

  const relationships = collectedRelationships.filter((e) =>
    e._type.includes(GITHUB_ACCOUNT_APP_RELATIONSHIP_TYPE),
  );
  expect(relationships.length).toBeGreaterThan(0);

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
