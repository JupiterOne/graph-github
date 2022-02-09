import { Recording } from '@jupiterone/integration-sdk-testing';
import { sanitizeConfig } from '../config';
import { appSteps } from './apps';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import {
  GithubEntities,
  GITHUB_ACCOUNT_APP_RELATIONSHIP_TYPE,
} from '../constants';
import { invocationConfig } from '..';
import { executeStepWithDependencies } from '../../test/executeStepWithDependencies';

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchApps exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'apps',
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
  const apps = collectedEntities.filter(
    (e) => e._type === GithubEntities.GITHUB_APP._type,
  );
  expect(apps.length).toBeGreaterThan(0);
  expect(apps).toMatchGraphObjectSchema(GithubEntities.GITHUB_APP);

  const relationships = collectedRelationships.filter(
    (e) => e._type === GITHUB_ACCOUNT_APP_RELATIONSHIP_TYPE,
  );
  expect(relationships.length).toBeGreaterThan(0);
});
