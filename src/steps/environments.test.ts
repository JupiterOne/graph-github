import { Recording } from '@jupiterone/integration-sdk-testing';
import { sanitizeConfig } from '../config';
import { environmentSteps } from './environments';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';
import {
  GithubEntities,
  GITHUB_REPO_ENVIRONMENT_RELATIONSHIP_TYPE,
} from '../constants';
import { invocationConfig } from '..';
import { executeStepWithDependencies } from '../../test/executeStepWithDependencies';

jest.setTimeout(20000);

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchEnvironments exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'environments',
  });
  sanitizeConfig(integrationConfig);

  const { collectedEntities, collectedRelationships, encounteredTypes } =
    await executeStepWithDependencies({
      stepId: environmentSteps[0].id,
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

  const environments = collectedEntities.filter(
    (e) => e._type === GithubEntities.GITHUB_ENVIRONMENT._type,
  );
  expect(environments.length).toBeGreaterThan(0);
  expect(environments).toMatchGraphObjectSchema(
    GithubEntities.GITHUB_ENVIRONMENT,
  );
  // relationships
  const relationships = collectedRelationships.filter(
    (e) => e._type === GITHUB_REPO_ENVIRONMENT_RELATIONSHIP_TYPE,
  );
  expect(relationships.length).toBeGreaterThan(0);
});
