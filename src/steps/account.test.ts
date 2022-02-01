import { Recording } from '@jupiterone/integration-sdk-testing';
import { sanitizeConfig } from '../config';
import { DATA_ACCOUNT_ENTITY, accountSteps } from './account';
import { integrationConfig } from '../../test/config';
import { invocationConfig } from '..';
import { setupGithubRecording } from '../../test/recording';
import { executeStepWithDependencies } from '../../test/executeStepWithDependencies';
import { GithubEntities } from '../constants';

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchAccountDetails exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'account',
  });
  sanitizeConfig(integrationConfig);
  integrationConfig.installationId = 17214088; //this is the id the recordings are under

  const {
    collectedEntities,
    collectedRelationships,
    encounteredTypes,
    jobState,
  } = await executeStepWithDependencies({
    stepId: accountSteps[0].id,
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
  expect(collectedEntities.length).toEqual(1);
  expect(collectedEntities).toMatchGraphObjectSchema(
    GithubEntities.GITHUB_ACCOUNT,
  );

  // ensure that we are setting the account entity in the jobState as expected
  const entityFromConstant = await jobState.getData(DATA_ACCOUNT_ENTITY);
  expect(entityFromConstant).toEqual(collectedEntities[0]);
});
